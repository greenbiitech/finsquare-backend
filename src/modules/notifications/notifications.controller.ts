import {
  Controller,
  Post,
  Delete,
  Get,
  Patch,
  Body,
  Param,
  Query,
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
  ApiQuery,
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

  // ============================================
  // IN-APP NOTIFICATIONS ENDPOINTS
  // ============================================

  @Get('in-app')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get in-app notifications for current user' })
  @ApiQuery({ name: 'communityId', required: false, description: 'Filter by community' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', example: 20 })
  @ApiResponse({
    status: 200,
    description: 'In-app notifications retrieved successfully',
  })
  async getInAppNotifications(
    @Request() req: any,
    @Query('communityId') communityId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.getInAppNotifications(
      req.user.userId,
      communityId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('in-app/unread-count')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiQuery({ name: 'communityId', required: false, description: 'Filter by community' })
  @ApiResponse({
    status: 200,
    description: 'Unread count retrieved successfully',
  })
  async getUnreadCount(
    @Request() req: any,
    @Query('communityId') communityId?: string,
  ) {
    return this.notificationsService.getUnreadCount(req.user.userId, communityId);
  }

  @Patch('in-app/:id/read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read',
  })
  async markAsRead(@Request() req: any, @Param('id') id: string) {
    return this.notificationsService.markAsRead(req.user.userId, id);
  }

  @Patch('in-app/read-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiQuery({ name: 'communityId', required: false, description: 'Filter by community' })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as read',
  })
  async markAllAsRead(
    @Request() req: any,
    @Query('communityId') communityId?: string,
  ) {
    return this.notificationsService.markAllAsRead(req.user.userId, communityId);
  }
}
