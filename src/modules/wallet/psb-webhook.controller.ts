import {
  Controller,
  Post,
  Body,
  Query,
  Req,
  Logger,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeController } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { WalletService } from './wallet.service';
import { PsbWaasService } from '../../integrations/psb-waas/psb-waas.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PsbWebhookDto } from './dto/psb-webhook.dto';

/**
 * Backward-compatible webhook controller for 9PSB
 *
 * The old Greencard codebase had the webhook at /api/auth/9psb-webhook
 * AND a typo version at /api/auth/9psb-webook (missing 'h')
 * This controller provides both endpoints for backward compatibility.
 */
@ApiTags('9PSB Webhook (Legacy)')
@ApiExcludeController() // Hide from Swagger - internal use only
@Controller('api/auth')
export class PsbWebhookController {
  private readonly logger = new Logger(PsbWebhookController.name);

  constructor(
    private readonly walletService: WalletService,
    private readonly psbWaasService: PsbWaasService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @Post('9psb-webhook')
  @ApiOperation({
    summary: '9PSB Inflow Webhook',
    description: 'Endpoint at /api/auth/9psb-webhook for 9PSB notifications',
  })
  async handle9psbWebhook(
    @Req() req: Request,
    @Body() webhookDto: PsbWebhookDto,
    @Query('event') event: string,
  ) {
    return this.processWebhook(req, webhookDto, event, 'webhook');
  }

  // Old code had a TYPO: "9psb-webook" (missing 'h') - 9PSB might be configured to call this
  @Post('9psb-webook')
  @ApiOperation({
    summary: '9PSB Inflow Webhook (Typo URL)',
    description: 'Endpoint at /api/auth/9psb-webook (typo) for 9PSB notifications',
  })
  async handle9psbWebook(
    @Req() req: Request,
    @Body() webhookDto: PsbWebhookDto,
    @Query('event') event: string,
  ) {
    return this.processWebhook(req, webhookDto, event, 'webook-typo');
  }

  /**
   * Shared webhook processing logic
   */
  private async processWebhook(
    req: Request,
    webhookDto: PsbWebhookDto,
    event: string,
    source: string,
  ) {
    this.logger.log(`========== 9PSB WEBHOOK (${source}) START ==========`);
    this.logger.log(`Event: ${event}`);
    this.logger.log(`Webhook Payload: ${JSON.stringify(webhookDto)}`);

    // Log the incoming webhook immediately
    try {
      await this.prisma.webhookLog.create({
        data: {
          source: `9PSB-${source}`,
          rawPayload: { event, ...webhookDto },
          status: 'RECEIVED',
          message: `Account: ${webhookDto.accountnumber}, Amount: ${webhookDto.amount}, Ref: ${webhookDto.transactionref}`,
        },
      });
      this.logger.log('Webhook logged to database');
    } catch (logError: any) {
      this.logger.error(`Failed to log webhook: ${logError.message}`);
    }

    // Validate Basic Auth
    const authHeader = req.headers['authorization'];
    this.logger.log(`Auth header present: ${!!authHeader}`);

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      this.logger.error('Missing or invalid Authorization header');
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    // Only handle transfer events
    if (event !== 'transfer') {
      this.logger.warn(`Unsupported event type: ${event}`);
      throw new NotFoundException(`Unsupported event type: ${event}`);
    }

    // Verify Basic Auth credentials
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    const validUsername = this.configService.get<string>('BASIC_AUTH_9PSB_USERNAME');
    const validPassword = this.configService.get<string>('BASIC_AUTH_9PSB_PASSWORD');

    this.logger.log(`Auth check: received=${username}, expected=${validUsername}, match=${username === validUsername}`);

    if (username !== validUsername || password !== validPassword) {
      this.logger.error('Invalid 9PSB webhook credentials');
      throw new ForbiddenException('Invalid credentials');
    }

    this.logger.log('Authorization PASSED');

    try {
      this.logger.log(`Transaction code: ${webhookDto.code}`);

      // Only process successful transactions
      if (webhookDto.code === '00') {
        this.logger.log('Transaction code is 00 (success) - processing...');

        // Check if transaction already processed
        const existingTx = await this.walletService.findTransactionByReference(webhookDto.transactionref);
        this.logger.log(`Existing transaction check: ${existingTx ? 'FOUND (duplicate)' : 'NOT FOUND (new)'}`);

        if (!existingTx) {
          // Verify transaction with 9PSB (skip if requery fails - trust the webhook)
          this.logger.log(`Requerying transaction with 9PSB: account=${webhookDto.accountnumber}, session=${webhookDto.nipsessionid}`);

          let txStatus: any = { status: 'SUCCESS' }; // Default to success
          try {
            txStatus = await this.psbWaasService.requeryNotification(
              webhookDto.accountnumber,
              webhookDto.nipsessionid,
            );
            this.logger.log(`Requery response: ${JSON.stringify(txStatus)}`);
          } catch (reqErr: any) {
            this.logger.warn(`Requery failed (proceeding anyway): ${reqErr.message}`);
            // Continue processing even if requery fails - webhook is trusted
          }

          // Process if requery succeeded OR if we're trusting the webhook
          if (txStatus.status === 'SUCCESS' || txStatus.status === 'FAILED') {
            this.logger.log('Proceeding to find wallet and credit...');

            // Find wallet by account number
            const wallet = await this.walletService.findWalletByAccountNo(webhookDto.accountnumber);
            this.logger.log(`Wallet lookup: ${wallet ? `FOUND (id=${wallet.id}, user=${wallet.userId})` : 'NOT FOUND'}`);

            if (wallet) {
              this.logger.log(`Crediting wallet ${wallet.id} with ${webhookDto.amount}...`);

              // Credit the wallet (also sends push notification and email)
              await this.walletService.creditWallet(
                wallet.id,
                parseFloat(webhookDto.amount),
                webhookDto.narration,
                'CREDIT',
                webhookDto.transactionref,
                webhookDto,
              );

              this.logger.log('Wallet credited successfully!');

              // Log success
              await this.prisma.webhookLog.create({
                data: {
                  source: `9PSB-${source}`,
                  rawPayload: { ...webhookDto },
                  status: 'PROCESSED',
                  message: `Wallet funded: ${webhookDto.transactionref}, Amount: ${webhookDto.amount}`,
                },
              });
            } else {
              this.logger.error(`WALLET NOT FOUND for account: ${webhookDto.accountnumber}`);
              await this.prisma.webhookLog.create({
                data: {
                  source: `9PSB-${source}`,
                  rawPayload: { ...webhookDto },
                  status: 'FAILED',
                  message: `Wallet not found for account: ${webhookDto.accountnumber}`,
                },
              });
            }
          } else {
            this.logger.warn(`Requery returned non-success status: ${txStatus.status}`);
            await this.prisma.webhookLog.create({
              data: {
                source: `9PSB-${source}`,
                rawPayload: { ...webhookDto },
                status: 'FAILED',
                message: `Requery failed with status: ${txStatus.status}`,
              },
            });
          }
        } else {
          this.logger.log(`Transaction already processed: ${webhookDto.transactionref}`);
        }
      } else {
        this.logger.warn(`Transaction code is not 00: ${webhookDto.code}`);
        await this.prisma.webhookLog.create({
          data: {
            source: `9PSB-${source}`,
            rawPayload: { ...webhookDto },
            status: 'SKIPPED',
            message: `Non-success code: ${webhookDto.code}`,
          },
        });
      }
    } catch (error: any) {
      this.logger.error(`Error processing 9PSB webhook: ${error.message}`);
      this.logger.error(error.stack);
      await this.prisma.webhookLog.create({
        data: {
          source: `9PSB-${source}`,
          rawPayload: { ...webhookDto },
          status: 'FAILED',
          message: error.message || 'Unknown error',
        },
      });
    }

    this.logger.log(`========== 9PSB WEBHOOK (${source}) END ==========`);

    // Always return success to 9PSB
    return {
      success: true,
      code: '00',
      status: 'SUCCESS',
      message: 'Acknowledged',
    };
  }
}
