import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req,
  UseGuards,
  Logger,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { WalletService } from './wallet.service';
import { PsbWaasService } from '../../integrations/psb-waas/psb-waas.service';
import { PrismaService } from '../../prisma/prisma.service';
import { InitiateBvnDto, VerifyBvnDto, VerifyBvnOtpDto, CompleteStep2Dto, CompleteStep3Dto, CompleteStep4Dto, CompleteStep5Dto, WithdrawDto, TransferDto, ResolveAccountDto } from './dto';
import { PsbWebhookDto } from './dto/psb-webhook.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Wallet')
@Controller('api/v1/wallet')
export class WalletController {
  private readonly logger = new Logger(WalletController.name);

  constructor(
    private readonly walletService: WalletService,
    private readonly psbWaasService: PsbWaasService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) { }

  // ============================================
  // BVN VALIDATION FLOW
  // ============================================

  @Post('bvn/initiate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Step 1: Initiate BVN validation',
    description: 'Submit BVN to get session_id and available verification methods (phone/email)',
  })
  initiateBvn(
    @CurrentUser() user: { userId: string },
    @Body() dto: InitiateBvnDto,
  ) {
    return this.walletService.initiateBvnValidation(user.userId, dto);
  }

  @Post('bvn/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Step 2: Select verification method',
    description: 'Choose phone or email to receive OTP',
  })
  selectVerificationMethod(
    @CurrentUser() user: { userId: string },
    @Body() dto: VerifyBvnDto,
  ) {
    return this.walletService.selectVerificationMethod(user.userId, dto);
  }

  @Post('bvn/details')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Step 3: Verify OTP and get BVN details',
    description: 'Submit OTP to complete BVN verification and retrieve identity data',
  })
  verifyBvnOtp(
    @CurrentUser() user: { userId: string },
    @Body() dto: VerifyBvnOtpDto,
  ) {
    return this.walletService.verifyBvnOtp(user.userId, dto);
  }

  // ============================================
  // STEP 2: PERSONAL INFO + ADDRESS
  // ============================================

  @Post('step2/complete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Complete Step 2: Personal Info + Address',
    description: 'Saves address info and syncs user data (firstName, lastName, DOB) with BVN records',
  })
  completeStep2(
    @CurrentUser() user: { userId: string },
    @Body() dto: CompleteStep2Dto,
  ) {
    return this.walletService.completeStep2(user.userId, dto);
  }

  // ============================================
  // STEP 3: FACE VERIFICATION
  // ============================================

  @Post('step3/complete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Complete Step 3: Face Verification',
    description: 'Saves the user profile photo URL from Cloudinary',
  })
  completeStep3(
    @CurrentUser() user: { userId: string },
    @Body() dto: CompleteStep3Dto,
  ) {
    return this.walletService.completeStep3(user.userId, dto);
  }

  // ============================================
  // STEP 4: PROOF OF ADDRESS
  // ============================================

  @Post('step4/complete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Complete Step 4: Proof of Address',
    description: 'Uploads proof of address document URL',
  })
  completeStep4(
    @CurrentUser() user: { userId: string },
    @Body() dto: CompleteStep4Dto,
  ) {
    return this.walletService.completeStep4(user.userId, dto);
  }

  @Post('step4/skip')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Skip Step 4: Proof of Address',
    description: 'Skips the proof of address step (will be recorded that user skipped)',
  })
  skipStep4(@CurrentUser() user: { userId: string }) {
    return this.walletService.skipStep4(user.userId);
  }

  // ============================================
  // STEP 5: TRANSACTION PIN + WALLET CREATION
  // ============================================

  @Post('step5/complete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Complete Step 5: Create Transaction PIN and Wallet',
    description: 'Creates transaction PIN and triggers 9PSB wallet creation. This is the final step of wallet setup.',
  })
  completeStep5(
    @CurrentUser() user: { userId: string },
    @Body() dto: CompleteStep5Dto,
  ) {
    return this.walletService.completeStep5(user.userId, dto);
  }

  // ============================================
  // WALLET SETUP PROGRESS
  // ============================================

  @Get('setup/progress')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get wallet setup progress',
    description: 'Returns current step in wallet activation flow',
  })
  getSetupProgress(@CurrentUser() user: { userId: string }) {
    return this.walletService.getWalletSetupProgress(user.userId);
  }

  // ============================================
  // WALLET BALANCE
  // ============================================

  @Get('balance')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get wallet balance from 9PSB',
    description: 'Fetches real-time balance from 9PSB WAAS and syncs with local database',
  })
  getBalance(@CurrentUser() user: { userId: string }) {
    return this.walletService.getWalletBalance(user.userId);
  }

  // ============================================
  // WITHDRAWAL AND TRANSFER
  // ============================================

  @Get('banks')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get list of banks',
    description: 'Fetch list of available banks from 9PSB',
  })
  getBanks() {
    return this.walletService.getBankList();
  }

  @Post('resolve-account')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Resolve bank account',
    description: 'Resolve account name for a given account number and bank code',
  })
  resolveAccount(@Body() dto: ResolveAccountDto) {
    return this.walletService.resolveAccount(dto);
  }

  @Post('withdraw')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Withdraw Funds / Transfer to Bank',
    description: 'Initiate a withdrawal or transfer to an external bank account',
  })
  withdraw(
    @CurrentUser() user: { userId: string },
    @Body() dto: WithdrawDto,
  ) {
    return this.walletService.transferFunds(user.userId, dto);
  }

  @Post('transfer')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Transfer Funds (Alias)',
    description: 'Initiate a transfer to a recipient. Currently same as withdrawal.',
  })
  transfer(
    @CurrentUser() user: { userId: string },
    @Body() dto: TransferDto,
  ) {
    // Map TransferDto to WithdrawDto format
    return this.walletService.transferFunds(user.userId, {
      amount: dto.amount,
      destinationAccountNumber: dto.recipientAccountNumber,
      destinationBankCode: dto.destinationBankCode,
      destinationAccountName: dto.destinationAccountName,
      narration: dto.narration,
      transactionPin: dto.transactionPin,
    });
  }

  // ============================================
  // TRANSACTION HISTORY
  // ============================================

  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get wallet transaction history',
    description: 'Fetches transaction history from 9PSB WAAS',
  })
  async getTransactionHistory(
    @CurrentUser() user: { userId: string },
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('limit') limit?: string,
  ) {
    return this.walletService.getTransactionHistory(
      user.userId,
      fromDate,
      toDate,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  // ============================================
  // 9PSB WEBHOOK (PUBLIC - Basic Auth)
  // ============================================

  @Post('9psb-webhook')
  @ApiOperation({
    summary: '9PSB Inflow Webhook',
    description: 'Receives transfer notifications from 9PSB when money is credited to user wallets',
  })
  async handle9psbWebhook(
    @Req() req: Request,
    @Body() webhookDto: PsbWebhookDto,
    @Query('event') event: string,
  ) {
    this.logger.log('9PSB Webhook received', { event, data: webhookDto });

    // Log the incoming webhook
    await this.prisma.webhookLog.create({
      data: {
        source: '9PSB',
        rawPayload: { ...webhookDto },
        status: 'RECEIVED',
      },
    });

    // Validate Basic Auth
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    // Only handle transfer events
    if (event !== 'transfer') {
      throw new NotFoundException(`Unsupported event type: ${event}`);
    }

    // Verify Basic Auth credentials
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    const validUsername = this.configService.get<string>('BASIC_AUTH_9PSB_USERNAME');
    const validPassword = this.configService.get<string>('BASIC_AUTH_9PSB_PASSWORD');

    if (username !== validUsername || password !== validPassword) {
      this.logger.warn('Invalid 9PSB webhook credentials');
      throw new ForbiddenException('Invalid credentials');
    }

    this.logger.log('9PSB webhook authorization passed');

    try {
      // Only process successful transactions
      if (webhookDto.code === '00') {
        // Check if transaction already processed
        const existingTx = await this.walletService.findTransactionByReference(webhookDto.transactionref);

        if (!existingTx) {
          // Verify transaction with 9PSB
          const txStatus = await this.psbWaasService.requeryNotification(
            webhookDto.accountnumber,
            webhookDto.nipsessionid,
          );

          if (txStatus.status === 'SUCCESS') {
            // Find wallet by account number
            const wallet = await this.walletService.findWalletByAccountNo(webhookDto.accountnumber);

            if (wallet) {
              // Credit the wallet (also sends push notification and email)
              await this.walletService.creditWallet(
                wallet.id,
                parseFloat(webhookDto.amount),
                webhookDto.narration,
                'CREDIT',
                webhookDto.transactionref,
                webhookDto,
              );

              // Log success
              await this.prisma.webhookLog.create({
                data: {
                  source: '9PSB',
                  rawPayload: { ...webhookDto },
                  status: 'PROCESSED',
                  message: `Wallet funded: ${webhookDto.transactionref}`,
                },
              });
            } else {
              this.logger.warn(`Wallet not found for account: ${webhookDto.accountnumber}`);
            }
          }
        } else {
          this.logger.log(`Transaction already processed: ${webhookDto.transactionref}`);
        }
      }
    } catch (error: any) {
      this.logger.error('Error processing 9PSB webhook:', error);
      await this.prisma.webhookLog.create({
        data: {
          source: '9PSB',
          rawPayload: { ...webhookDto },
          status: 'FAILED',
          message: error.message || 'Unknown error',
        },
      });
    }

    // Always return success to 9PSB
    return {
      success: true,
      code: '00',
      status: 'SUCCESS',
      message: 'Acknowledged',
    };
  }
}
