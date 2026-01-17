import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma, WalletSetupStep } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { MonoService } from '../../integrations/mono/mono.service';
import { PsbWaasService } from '../../integrations/psb-waas/psb-waas.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ZeptomailService } from '../../integrations/zeptomail/zeptomail.service';
import { InitiateBvnDto, VerifyBvnDto, VerifyBvnOtpDto, CompleteStep2Dto, CompleteStep3Dto, CompleteStep4Dto, CompleteStep5Dto, WithdrawDto, ResolveAccountDto } from './dto';

import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private prisma: PrismaService,
    private monoService: MonoService,
    private psbWaasService: PsbWaasService,
    private notificationsService: NotificationsService,
    private zeptomailService: ZeptomailService,
  ) { }

  /**
   * Step 1: Initiate BVN validation
   * Returns session_id and available verification methods
   */
  async initiateBvnValidation(userId: string, dto: InitiateBvnDto) {
    try {
      this.logger.log(`Initiating BVN validation for user: ${userId}`);

      // Check if this BVN is already registered with another user
      const existingUser = await this.prisma.user.findFirst({
        where: {
          id: { not: userId },
          bvn: dto.bvn,
        },
        select: { id: true },
      });

      if (existingUser) {
        throw new BadRequestException(
          'This BVN is already registered with another account',
        );
      }

      // Call Mono API to initiate BVN lookup
      const response = await this.monoService.initiateBvnLookup(dto.bvn);

      // Store BVN and session in user's walletSetupData
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          walletSetupData: {
            bvn: dto.bvn,
            sessionId: response.data.session_id,
            step: 'BVN_INITIATED',
          },
        },
      });

      return {
        success: true,
        message: 'BVN validation initiated',
        data: {
          sessionId: response.data.session_id,
          methods: response.data.methods,
        },
      };
    } catch (error: any) {
      this.logger.error(`BVN initiation failed for user ${userId}:`, error);

      if (error.monoError) {
        throw new BadRequestException(error.message);
      }

      throw new InternalServerErrorException('Failed to initiate BVN validation');
    }
  }

  /**
   * Step 2: Select verification method and send OTP
   */
  async selectVerificationMethod(userId: string, dto: VerifyBvnDto) {
    try {
      this.logger.log(`Selecting verification method ${dto.method} for user: ${userId}`);

      // Call Mono API to verify with selected method
      const response = await this.monoService.verifyBvn(dto.sessionId, dto.method);

      // Update walletSetupData with selected method
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { walletSetupData: true },
      });

      const setupData = user?.walletSetupData as Record<string, any> || {};

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          walletSetupData: {
            ...setupData,
            sessionId: dto.sessionId,
            method: dto.method,
            step: 'OTP_SENT',
          },
        },
      });

      return {
        success: true,
        message: response.message || `OTP sent via ${dto.method}`,
        data: {
          status: response.status,
        },
      };
    } catch (error: any) {
      this.logger.error(`Verification method selection failed for user ${userId}:`, error);

      if (error.monoError) {
        throw new BadRequestException(error.message);
      }

      throw new InternalServerErrorException('Failed to send verification OTP');
    }
  }

  /**
   * Step 3: Verify OTP and get BVN details
   */
  async verifyBvnOtp(userId: string, dto: VerifyBvnOtpDto) {
    try {
      this.logger.log(`Verifying BVN OTP for user: ${userId}`);

      // Call Mono API to get BVN details
      const response = await this.monoService.getBvnDetails(dto.sessionId, dto.otp);

      const bvnData = response.data;

      // Get BVN from walletSetupData
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { walletSetupData: true },
      });

      const setupData = user?.walletSetupData as Record<string, any> || {};
      const bvn = setupData.bvn || bvnData.bvn;

      // Store BVN data and advance to BVN_VERIFIED step
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          bvn: bvn,
          bvnData: {
            bvn: bvn,
            firstName: bvnData.first_name,
            middleName: bvnData.middle_name,
            lastName: bvnData.last_name,
            gender: bvnData.gender,
            dateOfBirth: bvnData.dob || bvnData.date_of_birth,
            phoneNumber: bvnData.phone_number || bvnData.phone_number1,
            email: bvnData.email,
            residentialAddress: bvnData.residential_address,
            stateOfResidence: bvnData.state_of_residence,
            lgaOfResidence: bvnData.lga_of_residence,
            image: bvnData.image,
            nin: bvnData.nin,
            nationality: bvnData.nationality,
          },
          dob: bvnData.dob || bvnData.date_of_birth,
          gender: bvnData.gender,
          walletSetupStep: WalletSetupStep.BVN_VERIFIED,
          walletSetupData: Prisma.JsonNull, // Clear session data
        },
      });

      return {
        success: true,
        message: 'BVN verified successfully',
        data: {
          firstName: bvnData.first_name,
          middleName: bvnData.middle_name,
          lastName: bvnData.last_name,
          gender: bvnData.gender,
          dateOfBirth: bvnData.dob || bvnData.date_of_birth,
          phoneNumber: bvnData.phone_number || bvnData.phone_number1,
          email: bvnData.email,
          residentialAddress: bvnData.residential_address,
          stateOfResidence: bvnData.state_of_residence,
          lgaOfResidence: bvnData.lga_of_residence,
          image: bvnData.image,
        },
      };
    } catch (error: any) {
      this.logger.error(`BVN OTP verification failed for user ${userId}:`, error);

      if (error.monoError) {
        throw new BadRequestException(error.message);
      }

      throw new InternalServerErrorException('Failed to verify BVN');
    }
  }

  /**
   * Complete Step 2: Personal Info + Address
   */
  async completeStep2(userId: string, dto: CompleteStep2Dto) {
    try {
      this.logger.log(`Completing Step 2 for user: ${userId}`);

      // Get user with BVN data
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          walletSetupStep: true,
          bvnData: true,
        },
      });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      if (user.walletSetupStep !== WalletSetupStep.BVN_VERIFIED) {
        throw new BadRequestException('BVN verification required before completing Step 2');
      }

      const bvnData = user.bvnData as any;

      // Prepare update data
      const updateData: any = {
        address: dto.address,
        state: dto.state,
        lga: dto.lga,
        walletSetupStep: WalletSetupStep.PERSONAL_INFO,
      };

      // Sync user data with BVN if confirmed
      if (dto.syncWithBvn && bvnData) {
        updateData.firstName = bvnData.firstName;
        updateData.lastName = bvnData.lastName;
        updateData.fullName = `${bvnData.firstName} ${bvnData.lastName}`;
      }

      // Update user
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          firstName: true,
          lastName: true,
          fullName: true,
          address: true,
          state: true,
        },
      });

      this.logger.log(`Step 2 completed for user: ${userId}`);

      return {
        success: true,
        message: 'Personal information and address saved successfully',
        data: {
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          fullName: updatedUser.fullName,
          currentStep: 'PERSONAL_INFO',
          nameUpdated: dto.syncWithBvn,
        },
      };
    } catch (error: any) {
      this.logger.error(`Step 2 completion failed for user ${userId}:`, error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to complete Step 2');
    }
  }

  /**
   * Complete Step 3: Face Verification
   */
  async completeStep3(userId: string, dto: CompleteStep3Dto) {
    try {
      this.logger.log(`Completing Step 3 (Face Verification) for user: ${userId}`);

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { walletSetupStep: true },
      });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      if (user.walletSetupStep !== WalletSetupStep.PERSONAL_INFO) {
        throw new BadRequestException('Please complete the previous steps first');
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          photo: dto.photoUrl,
          walletSetupStep: WalletSetupStep.FACE_VERIFIED,
        },
      });

      this.logger.log(`Step 3 completed for user: ${userId}`);

      return {
        success: true,
        message: 'Face verification completed successfully',
        data: {
          currentStep: 'FACE_VERIFIED',
        },
      };
    } catch (error: any) {
      this.logger.error(`Step 3 completion failed for user ${userId}:`, error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to complete face verification');
    }
  }

  /**
   * Complete Step 4: Proof of Address
   */
  async completeStep4(userId: string, dto: CompleteStep4Dto) {
    try {
      this.logger.log(`Completing Step 4 (Proof of Address) for user: ${userId}`);

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { walletSetupStep: true },
      });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      if (user.walletSetupStep !== WalletSetupStep.FACE_VERIFIED) {
        throw new BadRequestException('Please complete face verification first');
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          proofOfAddress: dto.proofOfAddressUrl,
          walletSetupStep: WalletSetupStep.PROOF_OF_ADDRESS,
        },
      });

      this.logger.log(`Step 4 completed for user: ${userId}`);

      return {
        success: true,
        message: 'Proof of address uploaded successfully',
        data: {
          currentStep: 'PROOF_OF_ADDRESS',
          skipped: false,
        },
      };
    } catch (error: any) {
      this.logger.error(`Step 4 completion failed for user ${userId}:`, error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to upload proof of address');
    }
  }

  /**
   * Skip Step 4: Proof of Address
   */
  async skipStep4(userId: string) {
    try {
      this.logger.log(`Skipping Step 4 (Proof of Address) for user: ${userId}`);

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { walletSetupStep: true },
      });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      if (user.walletSetupStep !== WalletSetupStep.FACE_VERIFIED) {
        throw new BadRequestException('Please complete face verification first');
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          walletSetupStep: WalletSetupStep.PROOF_OF_ADDRESS,
        },
      });

      this.logger.log(`Step 4 skipped for user: ${userId}`);

      return {
        success: true,
        message: 'Proof of address step skipped',
        data: {
          currentStep: 'PROOF_OF_ADDRESS',
          skipped: true,
        },
      };
    } catch (error: any) {
      this.logger.error(`Step 4 skip failed for user ${userId}:`, error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to skip proof of address');
    }
  }

  /**
   * Get wallet setup progress for a user
   */
  async getWalletSetupProgress(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        walletSetupStep: true,
        walletSetupData: true,
        bvnData: true,
        address: true,
        state: true,
        lga: true,
        photo: true,
        proofOfAddress: true,
        wallets: {
          where: { walletType: 'MAIN', isDeleted: false },
          select: { id: true, isActive: true },
        },
      },
    });

    const hasWallet = !!(user?.wallets && user.wallets.length > 0);
    const currentStep = user?.walletSetupStep || WalletSetupStep.NOT_STARTED;
    const walletSetupData = user?.walletSetupData as Record<string, any> | null;

    // Determine resume route based on current step
    const resumeRoute = this.getResumeRoute(currentStep, walletSetupData, hasWallet);

    // Check if user's name matches BVN name
    const bvnData = user?.bvnData as any;
    const bvnFirstName = (bvnData?.firstName || '').toUpperCase();
    const bvnLastName = (bvnData?.lastName || '').toUpperCase();
    const userFirstName = (user?.firstName || '').toUpperCase();
    const userLastName = (user?.lastName || '').toUpperCase();
    const nameMatchesBvn = bvnFirstName === userFirstName && bvnLastName === userLastName;

    return {
      success: true,
      data: {
        currentStep,
        resumeRoute,
        hasCompletedBvn: currentStep !== WalletSetupStep.NOT_STARTED,
        hasWallet,
        user: {
          firstName: user?.firstName,
          lastName: user?.lastName,
        },
        nameMatchesBvn,
        sessionId: walletSetupData?.step === 'OTP_SENT' ? walletSetupData.sessionId : null,
        verificationMethod: walletSetupData?.method || null,
        addressData: user?.address ? {
          address: user.address,
          state: user.state,
          lga: user.lga,
        } : null,
        bvnData: bvnData ? {
          firstName: bvnData.firstName,
          middleName: bvnData.middleName,
          lastName: bvnData.lastName,
          gender: bvnData.gender,
          dateOfBirth: bvnData.dateOfBirth,
          phoneNumber: bvnData.phoneNumber,
          email: bvnData.email,
          residentialAddress: bvnData.residentialAddress,
          stateOfResidence: bvnData.stateOfResidence,
          lgaOfResidence: bvnData.lgaOfResidence,
          image: bvnData.image,
        } : null,
      },
    };
  }

  /**
   * Determine the route to resume wallet setup based on current step
   */
  private getResumeRoute(
    currentStep: WalletSetupStep,
    walletSetupData: any,
    hasWallet: boolean,
  ): string {
    if (hasWallet) {
      return '/home';
    }

    const intermediateStep = walletSetupData?.step;

    switch (currentStep) {
      case WalletSetupStep.NOT_STARTED:
        if (intermediateStep === 'BVN_INITIATED') {
          return '/bvn-validation';
        }
        if (intermediateStep === 'OTP_SENT') {
          return '/verify-otp';
        }
        return '/activate-wallet';

      case WalletSetupStep.BVN_VERIFIED:
        return '/verify-personal-info';

      case WalletSetupStep.PERSONAL_INFO:
        return '/face-verification';

      case WalletSetupStep.FACE_VERIFIED:
        return '/proof-of-address';

      case WalletSetupStep.PROOF_OF_ADDRESS:
        return '/create-transaction-pin';

      case WalletSetupStep.COMPLETED:
        return '/home';

      default:
        return '/activate-wallet';
    }
  }

  /**
   * Complete Step 5: Create Transaction PIN and 9PSB Wallet
   */
  async completeStep5(userId: string, dto: CompleteStep5Dto) {
    try {
      this.logger.log(`Completing Step 5 (PIN + Wallet Creation) for user: ${userId}`);

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phoneNumber: true,
          walletSetupStep: true,
          bvnData: true,
          address: true,
          state: true,
          wallets: {
            where: { walletType: 'MAIN', isDeleted: false },
            select: { id: true },
          },
        },
      });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      if (user.wallets && user.wallets.length > 0) {
        throw new BadRequestException('Wallet already exists for this user');
      }

      if (user.walletSetupStep !== WalletSetupStep.PROOF_OF_ADDRESS) {
        throw new BadRequestException('Please complete the previous steps first');
      }

      if (!user.bvnData) {
        throw new BadRequestException('BVN verification required');
      }

      const bvnData = user.bvnData as any;

      // Hash the transaction PIN
      const hashedPin = await bcrypt.hash(dto.transactionPin, 10);

      // Generate unique transaction tracking reference
      const transactionTrackingRef = `FIN-${uuidv4().substring(0, 8).toUpperCase()}`;

      // Format date of birth for 9PSB (expects dd/MM/yyyy)
      const dob = bvnData.dateOfBirth;
      let formattedDob = dob;
      if (dob && dob.includes('-')) {
        const parts = dob.split('-');
        if (parts.length === 3) {
          formattedDob = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }

      // Map gender to 9PSB format (0=Male, 1=Female)
      const genderStr = (bvnData.gender || '').toLowerCase();
      const gender = genderStr === 'male' ? 0 : genderStr === 'female' ? 1 : 0;

      // Build 9PSB wallet creation request
      const psbRequest = {
        transactionTrackingRef,
        lastName: bvnData.lastName || user.lastName,
        otherNames: `${bvnData.firstName || user.firstName} ${bvnData.middleName || ''}`.trim(),
        phoneNo: bvnData.phoneNumber || user.phoneNumber,
        gender,
        dateOfBirth: formattedDob,
        address: user.address || bvnData.residentialAddress || 'Not Provided',
        bvn: bvnData.bvn,
        nin: bvnData.nin || undefined,
        email: bvnData.email || user.email,
      };

      this.logger.log(`Creating 9PSB wallet with tracking ref: ${transactionTrackingRef}`);

      // Call 9PSB API to create wallet
      let psbResponse: any;
      let isExistingWallet = false;

      try {
        psbResponse = await this.psbWaasService.createWallet(psbRequest);
      } catch (walletError: any) {
        if (walletError.existingWallet && walletError.response?.data?.accountNumber) {
          this.logger.log(`Using existing 9PSB wallet: ${walletError.response.data.accountNumber}`);
          psbResponse = walletError.response;
          isExistingWallet = true;
        } else {
          throw walletError;
        }
      }

      if (!psbResponse.data || !psbResponse.data.accountNumber) {
        throw new BadRequestException(
          psbResponse.message || 'Failed to create wallet with 9PSB',
        );
      }

      this.logger.log(`9PSB wallet ${isExistingWallet ? 'linked' : 'created'}: ${psbResponse.data.accountNumber}`);

      // Create wallet record and update user in a transaction
      const result = await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: {
            transactionPin: hashedPin,
            walletSetupStep: WalletSetupStep.COMPLETED,
          },
        });

        const wallet = await tx.wallet.create({
          data: {
            userId,
            walletType: 'MAIN',
            balance: 0,
            externalWalletId: psbResponse.data!.accountNumber,
            externalWalletDetails: {
              fullName: `${psbRequest.otherNames} ${psbRequest.lastName}`,
              accountNumber: psbResponse.data!.accountNumber,
              accountName: psbResponse.data!.accountName,
              customerID: psbResponse.data!.customerID,
              orderRef: transactionTrackingRef,
              bvn: bvnData.bvn,
              responseCode: psbResponse.statusCode,
            },
            isActive: true,
            isDeleted: false,
          },
          select: {
            id: true,
            walletType: true,
            balance: true,
            externalWalletId: true,
            externalWalletDetails: true,
          },
        });

        return wallet;
      });

      this.logger.log(`Wallet setup completed for user: ${userId}`);

      const accountNumber = result.externalWalletId!;
      const accountName = (result.externalWalletDetails as any)?.accountName ||
        `${psbRequest.otherNames} ${psbRequest.lastName}`;
      const userName = user.firstName || 'there';

      // Send notifications
      this.notificationsService
        .sendToUser(
          userId,
          'Wallet Created!',
          `Your wallet is ready. Account: ${accountNumber}`,
          { type: 'WALLET_CREATED', accountNumber },
        )
        .catch((err) => this.logger.error('Failed to send wallet push notification', err));

      this.zeptomailService
        .sendWalletCreated(user.email, userName, accountNumber, accountName)
        .catch((err) => this.logger.error('Failed to send wallet email', err));

      return {
        success: true,
        message: 'Wallet created successfully',
        data: {
          walletId: result.id,
          accountNumber,
          accountName,
          currentStep: 'COMPLETED',
        },
      };
    } catch (error: any) {
      this.logger.error(`Step 5 completion failed for user ${userId}:`, error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      if (error.psbError) {
        throw new BadRequestException(
          error.message || 'Failed to create wallet with 9PSB',
        );
      }

      throw new InternalServerErrorException('Failed to create wallet');
    }
  }

  /**
   * Get wallet balance from 9PSB
   */
  async getWalletBalance(userId: string) {
    try {
      this.logger.log(`Fetching wallet balance for user: ${userId}`);

      const wallet = await this.prisma.wallet.findFirst({
        where: {
          userId,
          walletType: 'MAIN',
          isActive: true,
          isDeleted: false,
        },
      });

      if (!wallet) {
        throw new BadRequestException('No wallet found for user');
      }

      const externalDetails = wallet.externalWalletDetails as any;
      const accountNumber = externalDetails?.accountNumber || wallet.externalWalletId;

      if (!accountNumber) {
        throw new BadRequestException('Wallet account number not found');
      }

      // Fetch real balance from 9PSB
      const psbResponse = await this.psbWaasService.getWalletDetails(accountNumber);

      if (psbResponse.status !== 'SUCCESS' && psbResponse.status !== 'SUCCESSFUL') {
        this.logger.error(`9PSB wallet enquiry failed: ${JSON.stringify(psbResponse)}`);
        throw new BadRequestException('Failed to fetch wallet balance from provider');
      }

      const psbBalance = psbResponse.data?.availableBalance || psbResponse.data?.balance || '0';
      const psbBalanceNum = parseFloat(psbBalance) || 0;

      // Sync local balance with 9PSB
      let syncedFromPsb = false;
      if (wallet.balance !== psbBalanceNum) {
        this.logger.log(`Syncing balance: local=${wallet.balance}, 9PSB=${psbBalanceNum}`);
        await this.prisma.wallet.update({
          where: { id: wallet.id },
          data: { balance: psbBalanceNum },
        });
        syncedFromPsb = true;
      }

      return {
        success: true,
        message: 'Wallet balance retrieved',
        data: {
          balance: psbBalanceNum.toFixed(2),
          accountNumber,
          accountName: externalDetails?.fullName || psbResponse.data?.accountName,
          walletId: wallet.id,
          syncedFromPsb,
        },
      };
    } catch (error: any) {
      this.logger.error(`Failed to fetch wallet balance for user ${userId}:`, error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      if (error.psbError) {
        throw new BadRequestException(
          error.message || 'Failed to fetch balance from provider',
        );
      }

      throw new InternalServerErrorException('Failed to fetch wallet balance');
    }
  }

  // ============================================
  // TRANSACTION HISTORY
  // ============================================

  /**
   * Get transaction history from 9PSB
   * @param userId - User's ID
   * @param fromDate - Start date (optional, defaults to 30 days ago)
   * @param toDate - End date (optional, defaults to today)
   * @param limit - Number of transactions to fetch
   */
  async getTransactionHistory(
    userId: string,
    fromDate?: string,
    toDate?: string,
    limit: number = 50,
  ) {
    this.logger.log(`Fetching transaction history for user: ${userId}`);

    // Get user's wallet
    const wallet = await this.prisma.wallet.findFirst({
      where: {
        userId,
        walletType: 'MAIN',
        isDeleted: false,
      },
    });

    if (!wallet) {
      throw new BadRequestException('Wallet not found');
    }

    // Get account number from wallet details
    const walletDetails = wallet.externalWalletDetails as any;
    const accountNumber = walletDetails?.accountNumber;

    if (!accountNumber) {
      throw new BadRequestException('Wallet account number not found');
    }

    // Default date range: last 30 days
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Format dates as "yyyy-MM-dd" for 9PSB API (ISO format)
    const formatDate = (date: Date) => {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${year}-${month}-${day}`;
    };

    const from = fromDate || formatDate(thirtyDaysAgo);
    const to = toDate || formatDate(today);

    // Fetch from 9PSB
    this.logger.log(`Calling 9PSB transaction history: account=${accountNumber}, from=${from}, to=${to}`);
    const response = await this.psbWaasService.getTransactionHistory(
      accountNumber,
      from,
      to,
      limit,
    );

    this.logger.log(`9PSB transaction history response: status=${response.status}, txCount=${response.data?.length ?? 0}`);

    if (response.status !== 'SUCCESS') {
      this.logger.warn(`Failed to fetch transaction history from 9PSB: ${response.message}. Falling back to local.`);
      // Return local transactions as fallback
      return this.getLocalTransactionHistory(userId, limit);
    }

    return {
      success: true,
      data: {
        transactions: response.data || [],
        fromDate: from,
        toDate: to,
        accountNumber,
        source: '9psb',
      },
    };
  }

  /**
   * Get transaction history from local database (fallback)
   */
  private async getLocalTransactionHistory(userId: string, limit: number = 50) {
    const transactions = await this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        amount: true,
        transactionType: true,
        reason: true,
        reference: true,
        status: true,
        createdAt: true,
        details: true,
      },
    });

    return {
      success: true,
      data: {
        transactions: transactions.map((tx) => ({
          id: tx.id,
          amount: tx.amount,
          type: tx.transactionType,
          narration: tx.reason,
          reference: tx.reference,
          status: tx.status,
          date: tx.createdAt,
          details: tx.details,
        })),
        source: 'local',
      },
    };
  }

  // ============================================
  // WALLET FUNDING (WEBHOOK SUPPORT)
  // ============================================

  /**
   * Find a wallet by its 9PSB account number
   */
  async findWalletByAccountNo(accountNumber: string) {
    return this.prisma.wallet.findFirst({
      where: {
        OR: [
          { externalWalletId: accountNumber },
          {
            externalWalletDetails: {
              path: ['accountNumber'],
              equals: accountNumber,
            },
          },
        ],
        isDeleted: false,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            fullName: true,
          },
        },
      },
    });
  }

  /**
   * Find a transaction by its reference
   */
  async findTransactionByReference(reference: string) {
    return this.prisma.transaction.findUnique({
      where: { reference },
    });
  }

  /**
   * Credit a wallet when money is received from 9PSB
   */
  async creditWallet(
    walletId: string,
    amount: number,
    narration: string,
    transactionType: string,
    reference: string,
    webhookDetails: any,
  ) {
    this.logger.log(`Crediting wallet ${walletId} with ${amount} (ref: ${reference})`);

    const result = await this.prisma.$transaction(async (tx) => {
      // Get current wallet
      const wallet = await tx.wallet.findUnique({
        where: { id: walletId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              fullName: true,
            },
          },
        },
      });

      if (!wallet) {
        throw new BadRequestException('Wallet not found');
      }

      // Update wallet balance
      const updatedWallet = await tx.wallet.update({
        where: { id: walletId },
        data: {
          balance: { increment: amount },
          totalDeposit: { increment: amount },
        },
      });

      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          userId: wallet.userId,
          walletId,
          amount,
          transactionType: 'CREDIT',
          reason: narration,
          reference,
          externalRef: webhookDetails.nipsessionid,
          status: 'SUCCESS',
          details: webhookDetails,
        },
      });

      return { wallet: updatedWallet, transaction, user: wallet.user };
    });

    this.logger.log(`Wallet credited successfully: new balance = ${result.wallet.balance}`);

    // Send notification (non-blocking)
    if (result.user) {
      this.logger.log(`Sending credit notifications to user: ${result.user.id}, email: ${result.user.email}`);

      this.notificationsService
        .sendToUser(
          result.user.id,
          'Wallet Credited 💰',
          `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })} has been added to your wallet`,
          {
            type: 'WALLET_CREDIT',
            amount: amount.toString(),
            reference,
          },
        )
        .then(() => this.logger.log('Push notification sent successfully'))
        .catch((err) => this.logger.error('Failed to send credit notification', err));

      // Send email notification
      this.zeptomailService
        .sendWalletCredited(
          result.user.email,
          result.user.firstName || 'Customer',
          amount,
          reference,
          result.wallet.balance,
        )
        .then(() => this.logger.log('Credit email sent successfully'))
        .catch((err) => this.logger.error('Failed to send credit email', err));
    } else {
      this.logger.warn(`No user found for wallet, skipping notifications. WalletId: ${walletId}`);
    }

    return result;
  }
  async getBankList() {
    return this.psbWaasService.getBankList();
  }

  async resolveAccount(dto: ResolveAccountDto) {
    return this.psbWaasService.resolveAccount(dto.accountNumber, dto.bankCode);
  }

  async transferFunds(userId: string, dto: WithdrawDto) {
    this.logger.log(`Initiating transfer/withdrawal for user ${userId} to ${dto.destinationAccountNumber}`);

    // 1. Get User and Wallet
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { wallets: { where: { walletType: 'MAIN' } } },
    });

    if (!user || !user.wallets || user.wallets.length === 0) {
      throw new BadRequestException('User wallet not found');
    }

    const wallet = user.wallets[0];

    // 2. Verify Transaction PIN
    if (!user.transactionPin) {
      throw new BadRequestException('Transaction PIN not set');
    }

    const isPinValid = await bcrypt.compare(dto.transactionPin, user.transactionPin);
    if (!isPinValid) {
      throw new BadRequestException('Invalid transaction PIN');
    }

    // 3. Check Wallet Balance (Local)
    if (wallet.balance < dto.amount) {
      throw new BadRequestException('Insufficient funds');
    }

    // 4. Prepare 9PSB Request
    // Generate valid external reference
    const transactionTrackingRef = `TRX-${uuidv4().substring(0, 12).toUpperCase()}`;

    // Get Sender details from wallet metadata
    const walletDetails = wallet.externalWalletDetails as any;
    const senderAccount = walletDetails?.accountNumber;
    const senderName = walletDetails?.accountName || `${user.firstName} ${user.lastName}`;

    if (!senderAccount) {
      throw new InternalServerErrorException('Wallet account number missing');
    }

    const requestPayload = {
      transaction: {
        reference: transactionTrackingRef,
      },
      order: {
        amount: dto.amount.toString(),
        status: 'PAID',
        currency: 'NGN',
        amountpaid: dto.amount.toString(),
        description: dto.narration,
      },
      customer: {
        account: {
          number: dto.destinationAccountNumber,
          bank: dto.destinationBankCode,
          senderbankname: '9PSB', // Assuming sender is 9PSB
          type: 'DYNAMIC', // Usually DYNAMIC for one-off transfers
          senderaccountnumber: senderAccount,
          sendername: senderName,
          name: dto.destinationAccountName,
        },
      },
      merchant: {
        merchant: 'FinSquare', // Or configured merchant code
      },
      transactionType: 'OTHER_BANKS',
      narration: dto.narration,
    };

    // 5. Create PENDING Transaction in DB
    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        walletId: wallet.id,
        amount: dto.amount,
        transactionType: 'TRANSFER',
        status: 'PENDING',
        reference: transactionTrackingRef,
        reason: dto.narration,
        details: {
          destinationAccount: dto.destinationAccountNumber,
          destinationBank: dto.destinationBankCode,
          destinationName: dto.destinationAccountName,
        },
      },
    });

    try {
      // 6. Call 9PSB API
      const response = await this.psbWaasService.transferToOtherBank(requestPayload);

      if (response.status === 'SUCCESS' || response.message?.toLowerCase().includes('success')) {
        // 7. Success - Update Wallet Balance and Transaction Status
        await this.prisma.$transaction(async (tx) => {
          // Debit wallet
          await tx.wallet.update({
            where: { id: wallet.id },
            data: {
              balance: { decrement: dto.amount },
            },
          });

          // Update transaction
          await tx.transaction.update({
            where: { id: transaction.id },
            data: { status: 'SUCCESS' },
          });
        });

        // 8. Notifications (Async)
        try {
          await this.notificationsService.sendToUser(
            user.id,
            'Debit Alert',
            `You have successfully transferred NGN${dto.amount} to ${dto.destinationAccountName}.`
          );
        } catch (e) {
          this.logger.error('Failed to send push notification', e);
        }

        return {
          success: true,
          message: 'Transfer successful',
          data: {
            reference: transactionTrackingRef,
            amount: dto.amount,
            newBalance: wallet.balance - dto.amount,
          },
        };
      } else {
        throw new Error(response.message || 'Transfer failed at 9PSB');
      }
    } catch (error: any) {
      this.logger.error(`Transfer failed for user ${userId}:`, error);

      // Update transaction to FAILED
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'FAILED',
          details: {
            ...(transaction.details as object || {}),
            error: error.message,
          },
        },
      });

      throw new BadRequestException(error.message || 'Transfer failed');
    }
  }
}
