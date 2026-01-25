import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { CommunityModule } from './modules/community/community.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { EsusuModule } from './modules/esusu/esusu.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    NotificationsModule,
    CommunityModule,
    WalletModule,
    EsusuModule,
  ],
})
export class AppModule {}
