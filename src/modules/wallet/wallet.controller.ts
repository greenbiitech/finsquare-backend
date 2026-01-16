import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { InitiateBvnDto, VerifyBvnDto, VerifyBvnOtpDto, CompleteStep2Dto, CompleteStep3Dto, CompleteStep4Dto, CompleteStep5Dto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Wallet')
@Controller('api/v1/wallet')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  // ============================================
  // BVN VALIDATION FLOW
  // ============================================

  @Post('bvn/initiate')
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
  @ApiOperation({
    summary: 'Get wallet balance from 9PSB',
    description: 'Fetches real-time balance from 9PSB WAAS and syncs with local database',
  })
  getBalance(@CurrentUser() user: { userId: string }) {
    return this.walletService.getWalletBalance(user.userId);
  }
}
