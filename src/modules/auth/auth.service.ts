import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { TermiiService } from '../../integrations/termii/termii.service';
import { ZeptomailService } from '../../integrations/zeptomail/zeptomail.service';
import { PsbWaasService } from '../../integrations/psb-waas/psb-waas.service';
import {
  SignupDto,
  VerifyOtpDto,
  LoginDto,
  PasskeyLoginDto,
  CreatePasskeyDto,
  RequestResetDto,
  VerifyResetOtpDto,
  ResetPasswordDto,
  ResendOtpDto,
} from './dto';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { addMinutes } from './utils/date.utils';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private termiiService: TermiiService,
    private zeptomailService: ZeptomailService,
    private psbWaasService: PsbWaasService,
  ) {}

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private isPhoneNumber(identifier: string): boolean {
    const phoneRegex = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/;
    return phoneRegex.test(identifier.replace(/[\s\-\(\)]/g, ''));
  }

  private sanitizeUser(user: any, wallets: any[] = []) {
    const { password, passkey, transactionPin, ...sanitized } = user;
    const mainWallet = wallets.find((w) => w.walletType === 'MAIN' && !w.isDeleted);

    // Format mainWallet for frontend (balance must be string)
    const formattedMainWallet = mainWallet ? {
      id: mainWallet.id,
      balance: (mainWallet.balance ?? 0).toFixed(2),
      walletType: mainWallet.walletType,
    } : null;

    return {
      ...sanitized,
      hasPasskey: !!user.passkey,
      hasWallet: wallets.filter(w => !w.isDeleted).length > 0,
      mainWallet: formattedMainWallet,
    };
  }

  // ============================================
  // SIGNUP FLOW
  // ============================================

  async signup(dto: SignupDto) {
    // Check if email already exists
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existingEmail) {
      throw new ConflictException('Email already registered');
    }

    // Check if phone already exists
    const existingPhone = await this.prisma.user.findUnique({
      where: { phoneNumber: dto.phoneNumber },
    });
    if (existingPhone) {
      throw new ConflictException('Phone number already registered');
    }

    // Delete any existing OTP verification for this email
    await this.prisma.otp_verifications.deleteMany({
      where: { email: dto.email.toLowerCase() },
    });

    // Generate OTP
    const otp = this.generateOtp();

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Store in OTP verification table
    await this.prisma.otp_verifications.create({
      data: {
        email: dto.email.toLowerCase(),
        phoneNumber: dto.phoneNumber,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        fullName: `${dto.firstName} ${dto.lastName}`,
        otp,
        expiresAt: addMinutes(new Date(), 15),
      },
    });

    // Send OTP via email and SMS (same OTP to both)
    await Promise.all([
      this.zeptomailService.sendOtp(dto.email, otp),
      this.termiiService.sendOtp(dto.phoneNumber, otp),
    ]);

    return {
      success: true,
      message: 'OTP sent to your email and phone number',
      data: {
        email: dto.email.toLowerCase(),
      },
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    // Find OTP verification record
    const otpRecord = await this.prisma.otp_verifications.findFirst({
      where: { email: dto.email.toLowerCase() },
    });

    if (!otpRecord) {
      throw new BadRequestException('No pending verification found');
    }

    // Check if OTP expired
    if (new Date() > otpRecord.expiresAt) {
      throw new BadRequestException('OTP has expired');
    }

    // Verify OTP
    if (otpRecord.otp !== dto.otp) {
      throw new BadRequestException('Invalid OTP');
    }

    // Create user in database
    const user = await this.prisma.user.create({
      data: {
        email: otpRecord.email,
        phoneNumber: otpRecord.phoneNumber!,
        password: otpRecord.password!,
        firstName: otpRecord.firstName!,
        lastName: otpRecord.lastName!,
        fullName: otpRecord.fullName || `${otpRecord.firstName} ${otpRecord.lastName}`,
        isVerified: true,
      },
    });

    // Delete OTP verification record
    await this.prisma.otp_verifications.delete({
      where: { id: otpRecord.id },
    });

    // Generate JWT token
    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });

    return {
      success: true,
      message: 'Account verified successfully',
      data: {
        token,
        user: this.sanitizeUser(user),
      },
    };
  }

  async resendOtp(dto: ResendOtpDto) {
    // Find OTP verification record
    const otpRecord = await this.prisma.otp_verifications.findFirst({
      where: { email: dto.email.toLowerCase() },
    });

    if (!otpRecord) {
      throw new BadRequestException('No pending verification found');
    }

    // Generate new OTP
    const otp = this.generateOtp();

    // Update OTP record
    await this.prisma.otp_verifications.update({
      where: { id: otpRecord.id },
      data: {
        otp,
        expiresAt: addMinutes(new Date(), 15),
      },
    });

    // Send OTP via email and SMS
    await Promise.all([
      this.zeptomailService.sendOtp(otpRecord.email, otp),
      this.termiiService.sendOtp(otpRecord.phoneNumber!, otp),
    ]);

    return {
      success: true,
      message: 'OTP resent successfully',
    };
  }

  // ============================================
  // LOGIN FLOW
  // ============================================

  async login(dto: LoginDto) {
    // Find user by email or phone
    const isPhone = this.isPhoneNumber(dto.identifier);

    const user = await this.prisma.user.findFirst({
      where: isPhone
        ? { phoneNumber: dto.identifier }
        : { email: dto.identifier.toLowerCase() },
      include: { wallets: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is banned
    if (user.isBanned) {
      throw new UnauthorizedException('Account has been suspended');
    }

    // Verify password
    const passwordValid = await bcrypt.compare(dto.password, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT token
    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });

    return {
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: this.sanitizeUser(user, user.wallets),
      },
    };
  }

  async loginWithPasskey(dto: PasskeyLoginDto) {
    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { wallets: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user has passkey
    if (!user.passkey) {
      throw new BadRequestException('Passkey not set up');
    }

    // Check if user is banned
    if (user.isBanned) {
      throw new UnauthorizedException('Account has been suspended');
    }

    // Verify passkey
    const passkeyValid = await bcrypt.compare(dto.passkey, user.passkey);
    if (!passkeyValid) {
      throw new UnauthorizedException('Invalid passkey');
    }

    // Generate JWT token
    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });

    // Get active community if exists
    const activeMembership = await this.prisma.membership.findFirst({
      where: { userId: user.id, isActive: true },
      include: { community: true },
    });

    return {
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: this.sanitizeUser(user, user.wallets),
        activeCommunity: activeMembership?.community
          ? {
              id: activeMembership.community.id,
              name: activeMembership.community.name,
              role: activeMembership.role,
              description: activeMembership.community.description,
              logo: activeMembership.community.logo,
              color: activeMembership.community.color,
            }
          : null,
      },
    };
  }

  // ============================================
  // PASSKEY SETUP
  // ============================================

  async createPasskey(userId: string, dto: CreatePasskeyDto) {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Hash passkey
    const hashedPasskey = await bcrypt.hash(dto.passkey, 10);

    // Update user
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        passkey: hashedPasskey,
      },
      include: { wallets: true },
    });

    return {
      success: true,
      message: 'Passkey created successfully',
      data: {
        user: this.sanitizeUser(updatedUser, updatedUser.wallets),
      },
    };
  }

  // ============================================
  // USER PROFILE
  // ============================================

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { wallets: true },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Sync wallet balance from 9PSB if user has a wallet
    const mainWallet = user.wallets?.find(
      (w) => w.walletType === 'MAIN' && !w.isDeleted,
    );

    if (mainWallet) {
      const syncedBalance = await this.syncWalletBalance(mainWallet);
      if (syncedBalance !== null) {
        // Update the wallet in memory with synced balance
        mainWallet.balance = syncedBalance;
      }
    }

    return {
      success: true,
      message: 'User profile retrieved',
      data: { user: this.sanitizeUser(user, user.wallets) },
    };
  }

  /**
   * Sync wallet balance from 9PSB
   * Returns the synced balance or null if sync failed
   */
  private async syncWalletBalance(wallet: any): Promise<number | null> {
    try {
      const externalDetails = wallet.externalWalletDetails as any;
      const accountNumber = externalDetails?.accountNumber || wallet.externalWalletId;

      if (!accountNumber) {
        return null;
      }

      const psbResponse = await this.psbWaasService.getWalletDetails(accountNumber);

      if (psbResponse.status !== 'SUCCESS' && psbResponse.status !== 'SUCCESSFUL') {
        this.logger.warn(`9PSB balance sync failed: ${psbResponse.message}`);
        return null;
      }

      const psbBalance = psbResponse.data?.availableBalance || psbResponse.data?.balance || '0';
      const psbBalanceNum = parseFloat(psbBalance) || 0;

      // Update local DB if balance differs
      if (wallet.balance !== psbBalanceNum) {
        this.logger.log(`Syncing balance: local=${wallet.balance}, 9PSB=${psbBalanceNum}`);
        await this.prisma.wallet.update({
          where: { id: wallet.id },
          data: { balance: psbBalanceNum },
        });
      }

      return psbBalanceNum;
    } catch (error) {
      this.logger.error('Failed to sync wallet balance from 9PSB:', error);
      return null; // Return null to use cached balance
    }
  }

  // ============================================
  // PASSWORD RESET FLOW
  // ============================================

  async requestPasswordReset(dto: RequestResetDto) {
    // Find user by email or phone
    const isPhone = this.isPhoneNumber(dto.identifier);

    const user = await this.prisma.user.findFirst({
      where: isPhone
        ? { phoneNumber: dto.identifier }
        : { email: dto.identifier.toLowerCase() },
    });

    if (!user) {
      // Don't reveal if user exists
      return {
        success: true,
        message: 'If an account exists, you will receive a reset code',
        data: { token: uuidv4() }, // Fake token
      };
    }

    // Delete any existing reset records
    await this.prisma.passwordReset.deleteMany({
      where: { userId: user.id },
    });

    // Generate OTP and token
    const otp = this.generateOtp();
    const token = uuidv4();

    // Create reset record
    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        token,
        otp,
        expiresAt: addMinutes(new Date(), 15),
      },
    });

    // Send OTP via email and SMS
    await Promise.all([
      this.zeptomailService.sendPasswordResetOtp(user.email, otp),
      this.termiiService.sendOtp(user.phoneNumber, otp),
    ]);

    return {
      success: true,
      message: 'Reset code sent to your email and phone',
      data: { token },
    };
  }

  async verifyResetOtp(dto: VerifyResetOtpDto) {
    // Find reset record
    const resetRecord = await this.prisma.passwordReset.findUnique({
      where: { token: dto.token },
    });

    if (!resetRecord) {
      throw new BadRequestException('Invalid reset token');
    }

    // Check if expired
    if (new Date() > resetRecord.expiresAt) {
      throw new BadRequestException('Reset code has expired');
    }

    // Verify OTP
    if (resetRecord.otp !== dto.otp) {
      throw new BadRequestException('Invalid reset code');
    }

    // Mark as verified
    await this.prisma.passwordReset.update({
      where: { id: resetRecord.id },
      data: { verified: true },
    });

    return {
      success: true,
      message: 'Reset code verified',
      data: { token: dto.token },
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    // Find reset record
    const resetRecord = await this.prisma.passwordReset.findUnique({
      where: { token: dto.token },
    });

    if (!resetRecord) {
      throw new BadRequestException('Invalid reset token');
    }

    // Check if verified
    if (!resetRecord.verified) {
      throw new BadRequestException('Reset code not verified');
    }

    // Check if expired
    if (new Date() > resetRecord.expiresAt) {
      throw new BadRequestException('Reset token has expired');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Update user password
    await this.prisma.user.update({
      where: { id: resetRecord.userId },
      data: { password: hashedPassword },
    });

    // Delete reset record
    await this.prisma.passwordReset.delete({
      where: { id: resetRecord.id },
    });

    return {
      success: true,
      message: 'Password reset successfully',
    };
  }

  async resendResetOtp(token: string) {
    // Find reset record
    const resetRecord = await this.prisma.passwordReset.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetRecord) {
      throw new BadRequestException('Invalid reset token');
    }

    // Generate new OTP
    const otp = this.generateOtp();

    // Update reset record
    await this.prisma.passwordReset.update({
      where: { id: resetRecord.id },
      data: {
        otp,
        expiresAt: addMinutes(new Date(), 15),
        verified: false,
      },
    });

    // Send OTP via email and SMS
    await Promise.all([
      this.zeptomailService.sendPasswordResetOtp(resetRecord.user.email, otp),
      this.termiiService.sendOtp(resetRecord.user.phoneNumber, otp),
    ]);

    return {
      success: true,
      message: 'Reset code resent successfully',
    };
  }
}
