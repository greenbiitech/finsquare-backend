import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { MonoModule } from '../../integrations/mono/mono.module';
import { PsbWaasModule } from '../../integrations/psb-waas/psb-waas.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ZeptomailModule } from '../../integrations/zeptomail/zeptomail.module';

@Module({
  imports: [
    MonoModule,
    PsbWaasModule,
    PrismaModule,
    NotificationsModule,
    ZeptomailModule,
  ],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
