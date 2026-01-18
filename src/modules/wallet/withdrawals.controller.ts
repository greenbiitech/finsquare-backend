import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateWithdrawalAccountDto } from './dto/withdrawal-account.dto';

@ApiTags('Withdrawals')
@Controller('api/v1/withdrawals')
export class WithdrawalsController {
  private readonly logger = new Logger(WithdrawalsController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get('account/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get saved withdrawal account',
    description: 'Get the user\'s saved withdrawal account for quick withdrawals',
  })
  @ApiResponse({ status: 200, description: 'Withdrawal account retrieved' })
  @ApiResponse({ status: 404, description: 'No withdrawal account found' })
  async getWithdrawalAccount(@CurrentUser() user: { userId: string }) {
    const account = await this.prisma.withdrawalAccount.findUnique({
      where: { userId: user.userId },
    });

    if (!account) {
      return {
        success: true,
        message: 'No withdrawal account found',
        data: null,
      };
    }

    return {
      success: true,
      message: 'Withdrawal account retrieved',
      data: {
        id: account.id,
        bankCode: account.bankCode,
        bankName: account.bankName,
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        createdAt: account.createdAt,
      },
    };
  }

  @Post('account')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Save withdrawal account',
    description: 'Save or update the user\'s withdrawal account for quick withdrawals',
  })
  @ApiResponse({ status: 201, description: 'Withdrawal account saved' })
  async saveWithdrawalAccount(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateWithdrawalAccountDto,
  ) {
    // Upsert - create or update if exists
    const account = await this.prisma.withdrawalAccount.upsert({
      where: { userId: user.userId },
      update: {
        bankCode: dto.bankCode,
        bankName: dto.bankName,
        accountNumber: dto.accountNumber,
        accountName: dto.accountName,
      },
      create: {
        userId: user.userId,
        bankCode: dto.bankCode,
        bankName: dto.bankName,
        accountNumber: dto.accountNumber,
        accountName: dto.accountName,
      },
    });

    this.logger.log(`Withdrawal account saved for user ${user.userId}`);

    return {
      success: true,
      message: 'Withdrawal account saved successfully',
      data: {
        id: account.id,
        bankCode: account.bankCode,
        bankName: account.bankName,
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        createdAt: account.createdAt,
      },
    };
  }

  @Delete('account')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete withdrawal account',
    description: 'Remove the user\'s saved withdrawal account',
  })
  @ApiResponse({ status: 200, description: 'Withdrawal account deleted' })
  async deleteWithdrawalAccount(@CurrentUser() user: { userId: string }) {
    try {
      await this.prisma.withdrawalAccount.delete({
        where: { userId: user.userId },
      });

      this.logger.log(`Withdrawal account deleted for user ${user.userId}`);

      return {
        success: true,
        message: 'Withdrawal account deleted successfully',
      };
    } catch (error) {
      // If not found, still return success
      return {
        success: true,
        message: 'No withdrawal account to delete',
      };
    }
  }
}
