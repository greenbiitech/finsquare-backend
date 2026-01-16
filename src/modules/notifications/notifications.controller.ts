import {
  Controller,
  Post,
  Delete,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { UpdateDeviceTokenDto } from './dto';

@ApiTags('Notifications')
@Controller('api/v1/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('device-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update device FCM token for push notifications' })
  @ApiResponse({
    status: 200,
    description: 'Device token updated successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async updateDeviceToken(
    @Request() req: any,
    @Body() dto: UpdateDeviceTokenDto,
  ) {
    await this.notificationsService.updateDeviceToken(
      req.user.userId,
      dto.fcmToken,
      dto.platform,
    );

    return {
      success: true,
      message: 'Device token updated successfully',
    };
  }

  @Delete('device-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove device token (on logout)' })
  @ApiResponse({
    status: 200,
    description: 'Device token removed successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async removeDeviceToken(@Request() req: any) {
    await this.notificationsService.removeDeviceToken(req.user.userId);

    return {
      success: true,
      message: 'Device token removed successfully',
    };
  }
}
