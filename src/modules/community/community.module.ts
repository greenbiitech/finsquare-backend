import { Module } from '@nestjs/common';
import { CommunityController, InviteController } from './community.controller';
import { CommunityService } from './community.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { ZeptomailModule } from '../../integrations/zeptomail/zeptomail.module';

@Module({
  imports: [NotificationsModule, ZeptomailModule],
  controllers: [CommunityController, InviteController],
  providers: [CommunityService],
  exports: [CommunityService],
})
export class CommunityModule {}
