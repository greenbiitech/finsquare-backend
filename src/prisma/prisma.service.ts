import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    let connectionString = process.env.DATABASE_URL || '';

    // Determine SSL config: check DB_SSL env var, or auto-detect based on hostname
    const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
    const forceSSL = process.env.DB_SSL === 'true';
    const disableSSL = process.env.DB_SSL === 'false';
    const useSSL = disableSSL ? false : (forceSSL || !isLocalhost);

    // Log before super() - can't use this.logger yet
    console.log(`[PrismaService] useSSL: ${useSSL}, isLocalhost: ${isLocalhost}`);

    // Configure pg.Pool with SSL
    const poolConfig: pg.PoolConfig = {
      connectionString,
    };

    if (useSSL) {
      if (process.env.DATABASE_CA_CERT) {
        poolConfig.ssl = {
          rejectUnauthorized: true,
          ca: process.env.DATABASE_CA_CERT,
        };
      } else {
        poolConfig.ssl = { rejectUnauthorized: false };

        // Force sslmode=no-verify in connection string
        // This overrides any existing 'sslmode=require' (which might force verification)
        if (connectionString.includes('sslmode=')) {
          connectionString = connectionString.replace(/sslmode=[^&]+/, 'sslmode=no-verify');
        } else {
          const separator = connectionString.includes('?') ? '&' : '?';
          connectionString += `${separator}sslmode=no-verify`;
        }
        poolConfig.connectionString = connectionString;
      }
    }

    const pool = new pg.Pool(poolConfig);
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit() {
    // Don't call $connect() - pool handles connections with proper SSL
    await this.seedDefaults();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Seeds default data on app startup (idempotent - safe to run multiple times)
   */
  private async seedDefaults() {
    try {
      // Check if default community already exists
      const existingCommunity = await this.community.findFirst({
        where: { isDefault: true },
      });

      if (existingCommunity) {
        this.logger.log(`Default community exists: ${existingCommunity.name}`);
        return;
      }

      this.logger.log('Seeding default data...');

      // Create system user for default community
      const systemUser = await this.user.upsert({
        where: { email: 'system@finsquare.app' },
        update: {},
        create: {
          id: 'finsquare-system-user',
          email: 'system@finsquare.app',
          phoneNumber: '+0000000000',
          password: 'SYSTEM_USER_NO_LOGIN',
          firstName: 'FinSquare',
          lastName: 'System',
          fullName: 'FinSquare System',
          isVerified: true,
        },
      });

      this.logger.log(`System user ready: ${systemUser.email}`);

      // Create FinSquare Community (default community)
      const finsquareCommunity = await this.community.upsert({
        where: { id: 'finsquare-default-community' },
        update: {},
        create: {
          id: 'finsquare-default-community',
          name: 'FinSquare Community',
          description: 'The default FinSquare community for individual members',
          isDefault: true,
          createdById: systemUser.id,
        },
      });

      this.logger.log(`Default community created: ${finsquareCommunity.name}`);
      this.logger.log('Seeding completed!');
    } catch (error) {
      this.logger.error('Failed to seed defaults:', error);
      // Don't throw - app should still start even if seeding fails
    }
  }
}
