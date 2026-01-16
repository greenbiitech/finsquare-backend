import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
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
  ResendResetOtpDto,
} from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ============================================
  // SIGNUP FLOW
  // ============================================

  @Post('signup')
  @ApiOperation({ summary: 'Register new user (sends OTP to email & phone)' })
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify OTP and create user account' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Post('resend-otp')
  @ApiOperation({ summary: 'Resend signup OTP' })
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }

  // ============================================
  // LOGIN FLOW
  // ============================================

  @Post('login')
  @ApiOperation({ summary: 'Login with email/phone and password' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('login-passkey')
  @ApiOperation({ summary: 'Login with userId and 5-digit passkey' })
  loginWithPasskey(@Body() dto: PasskeyLoginDto) {
    return this.authService.loginWithPasskey(dto);
  }

  // ============================================
  // PASSKEY SETUP (Protected)
  // ============================================

  @Post('create-passkey')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create 5-digit passkey (requires auth)' })
  createPasskey(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreatePasskeyDto,
  ) {
    return this.authService.createPasskey(user.userId, dto);
  }

  // ============================================
  // USER PROFILE (Protected)
  // ============================================

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  getMe(@CurrentUser() user: { userId: string }) {
    return this.authService.getMe(user.userId);
  }

  // ============================================
  // PASSWORD RESET FLOW
  // ============================================

  @Post('request-reset')
  @ApiOperation({ summary: 'Request password reset (sends OTP)' })
  requestPasswordReset(@Body() dto: RequestResetDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Post('verify-reset-otp')
  @ApiOperation({ summary: 'Verify password reset OTP' })
  verifyResetOtp(@Body() dto: VerifyResetOtpDto) {
    return this.authService.verifyResetOtp(dto);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Set new password after OTP verification' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('resend-reset-otp')
  @ApiOperation({ summary: 'Resend password reset OTP' })
  resendResetOtp(@Body() dto: ResendResetOtpDto) {
    return this.authService.resendResetOtp(dto.token);
  }
}
