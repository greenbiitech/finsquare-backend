import { Module } from '@nestjs/common';
import { EsusuController } from './esusu.controller';
import { EsusuService } from './esusu.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { ZeptomailModule } from '../../integrations/zeptomail/zeptomail.module';

@Module({
  imports: [NotificationsModule, ZeptomailModule],
  controllers: [EsusuController],
  providers: [EsusuService],
  exports: [EsusuService],
})
export class EsusuModule {}
