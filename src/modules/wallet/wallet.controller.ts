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
  // DEBUG ENDPOINTS - Webhook Logs & Status
  // ============================================

  @Get('webhook-logs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[DEV] Get recent webhook logs',
    description: 'Returns the last 20 webhook logs to debug 9PSB integration',
  })
  async getWebhookLogs() {
    try {
      const logs = await this.prisma.webhookLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      return {
        success: true,
        data: {
          count: logs.length,
          logs,
          webhookUrl: 'https://api.thegreencard.app/api/v1/wallet/9psb-webhook?event=transfer',
          note: 'If no logs appear after a deposit, 9PSB is not calling the webhook. Check 9PSB dashboard.',
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        hint: 'webhook_logs table might not exist. Restart the server to create it.',
      };
    }
  }

  @Get('debug-wallet')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[DEV] Debug wallet info',
    description: 'Returns wallet info and recent transactions for debugging',
  })
  async debugWallet(@CurrentUser() user: { userId: string }) {
    const wallet = await this.prisma.wallet.findFirst({
      where: {
        userId: user.userId,
        walletType: 'MAIN',
        isDeleted: false,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            fcmToken: true,
            devicePlatform: true,
          },
        },
      },
    });

    if (!wallet) {
      return { success: false, message: 'Wallet not found' };
    }

    // Get recent transactions
    let transactions: any[] = [];
    try {
      transactions = await this.prisma.transaction.findMany({
        where: { userId: user.userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    } catch (e: any) {
      this.logger.warn(`Failed to fetch transactions: ${e.message}`);
    }

    const externalDetails = wallet.externalWalletDetails as any;

    return {
      success: true,
      data: {
        walletId: wallet.id,
        accountNumber: externalDetails?.accountNumber || wallet.externalWalletId,
        accountName: externalDetails?.fullName,
        balance: wallet.balance,
        userId: wallet.userId,
        userEmail: wallet.user?.email,
        hasFcmToken: !!wallet.user?.fcmToken,
        devicePlatform: wallet.user?.devicePlatform,
        transactionCount: transactions.length,
        transactions: transactions.map(t => ({
          id: t.id,
          type: t.transactionType,
          amount: t.amount,
          status: t.status,
          reason: t.reason,
          reference: t.reference,
          createdAt: t.createdAt,
        })),
      },
    };
  }

  // ============================================
  // TEST ENDPOINT - Simulate Deposit (DEV ONLY)
  // ============================================

  @Post('test-deposit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[DEV] Test Deposit Simulation',
    description: 'Simulates a deposit webhook for testing. Creates a transaction and sends notifications.',
  })
  async testDeposit(
    @CurrentUser() user: { userId: string },
    @Body() body: { amount: number; narration?: string },
  ) {
    this.logger.log(`========== TEST DEPOSIT START ==========`);
    this.logger.log(`User: ${user.userId}, Amount: ${body.amount}`);

    // Get user's wallet
    const wallet = await this.prisma.wallet.findFirst({
      where: {
        userId: user.userId,
        walletType: 'MAIN',
        isDeleted: false,
      },
    });

    if (!wallet) {
      return { success: false, message: 'Wallet not found' };
    }

    this.logger.log(`Found wallet: ${wallet.id}`);

    // Generate test reference
    const testRef = `TEST-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Simulate webhook payload
    const mockWebhookPayload = {
      accountnumber: wallet.externalWalletId,
      amount: body.amount.toString(),
      transactionref: testRef,
      nipsessionid: `NIPSESSION-${Date.now()}`,
      narration: body.narration || 'Test Deposit',
      code: '00',
    };

    this.logger.log(`Mock webhook payload: ${JSON.stringify(mockWebhookPayload)}`);

    try {
      // Credit the wallet
      const result = await this.walletService.creditWallet(
        wallet.id,
        body.amount,
        body.narration || 'Test Deposit',
        'CREDIT',
        testRef,
        mockWebhookPayload,
      );

      this.logger.log(`========== TEST DEPOSIT SUCCESS ==========`);

      return {
        success: true,
        message: 'Test deposit processed',
        data: {
          transactionId: result.transaction.id,
          reference: testRef,
          newBalance: result.wallet.balance,
        },
      };
    } catch (error: any) {
      this.logger.error(`Test deposit failed: ${error.message}`);
      return {
        success: false,
        message: error.message,
      };
    }
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
    this.logger.log('========== 9PSB WEBHOOK START ==========');
    this.logger.log(`Event: ${event}`);
    this.logger.log(`Webhook Payload: ${JSON.stringify(webhookDto)}`);

    // Log the incoming webhook immediately
    try {
      await this.prisma.webhookLog.create({
        data: {
          source: '9PSB',
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
                  source: '9PSB',
                  rawPayload: { ...webhookDto },
                  status: 'PROCESSED',
                  message: `Wallet funded: ${webhookDto.transactionref}, Amount: ${webhookDto.amount}`,
                },
              });
            } else {
              this.logger.error(`WALLET NOT FOUND for account: ${webhookDto.accountnumber}`);
              await this.prisma.webhookLog.create({
                data: {
                  source: '9PSB',
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
                source: '9PSB',
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
            source: '9PSB',
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
          source: '9PSB',
          rawPayload: { ...webhookDto },
          status: 'FAILED',
          message: error.message || 'Unknown error',
        },
      });
    }

    this.logger.log('========== 9PSB WEBHOOK END ==========');

    // Always return success to 9PSB
    return {
      success: true,
      code: '00',
      status: 'SUCCESS',
      message: 'Acknowledged',
    };
  }
}
