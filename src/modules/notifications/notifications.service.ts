import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { PrismaService } from '../../prisma/prisma.service';
import { DevicePlatform } from './dto';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private firebaseApp: admin.app.App | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    try {
      const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
      const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
      const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');

      if (!projectId || !clientEmail || !privateKey) {
        this.logger.warn('Firebase credentials not configured. Push notifications disabled.');
        return;
      }

      this.firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          // Replace escaped newlines
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });

      this.logger.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK', error);
    }
  }

  /**
   * Update user's FCM device token
   */
  async updateDeviceToken(
    userId: string,
    fcmToken: string,
    platform: DevicePlatform,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        fcmToken,
        devicePlatform: platform,
      },
    });

    this.logger.log(`Device token updated for user ${userId}`);
  }

  /**
   * Remove user's FCM device token (on logout)
   */
  async removeDeviceToken(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        fcmToken: null,
        devicePlatform: null,
      },
    });

    this.logger.log(`Device token removed for user ${userId}`);
  }

  /**
   * Send push notification to a single user
   */
  async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<boolean> {
    this.logger.log(`Sending notification to user ${userId}: "${title}"`);

    if (!this.firebaseApp) {
      this.logger.warn('Firebase not initialized. Cannot send notification.');
      return false;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true, devicePlatform: true },
    });

    if (!user?.fcmToken) {
      this.logger.warn(`No FCM token for user ${userId}`);
      return false;
    }

    this.logger.log(`Found FCM token for user ${userId}, platform: ${user.devicePlatform}`);
    return this.sendNotification(user.fcmToken, title, body, data);
  }

  /**
   * Send push notification to multiple users
   */
  async sendToUsers(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<{ success: number; failed: number }> {
    if (!this.firebaseApp) {
      this.logger.warn('Firebase not initialized. Cannot send notifications.');
      return { success: 0, failed: userIds.length };
    }

    const users = await this.prisma.user.findMany({
      where: {
        id: { in: userIds },
        fcmToken: { not: null },
      },
      select: { id: true, fcmToken: true },
    });

    const tokens = users.map((u) => u.fcmToken).filter(Boolean) as string[];

    if (tokens.length === 0) {
      return { success: 0, failed: userIds.length };
    }

    const result = await this.sendMulticast(tokens, title, body, data);
    return {
      success: result.successCount,
      failed: userIds.length - result.successCount,
    };
  }

  /**
   * Send notification to all community members
   */
  async sendToCommunity(
    communityId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<{ success: number; failed: number }> {
    const memberships = await this.prisma.membership.findMany({
      where: { communityId },
      select: { userId: true },
    });

    const userIds = memberships.map((m) => m.userId);
    return this.sendToUsers(userIds, title, body, data);
  }

  /**
   * Send a single notification
   */
  private async sendNotification(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<boolean> {
    try {
      const message: admin.messaging.Message = {
        token,
        notification: {
          title,
          body,
        },
        data,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'finsquare_high_importance_channel',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      await admin.messaging().send(message);
      this.logger.log(`Notification sent successfully to token ${token.substring(0, 20)}...`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to send notification: ${error.message}`);

      // Handle invalid token
      if (
        error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered'
      ) {
        await this.invalidateToken(token);
      }

      return false;
    }
  }

  /**
   * Send notifications to multiple tokens
   */
  private async sendMulticast(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<admin.messaging.BatchResponse> {
    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title,
        body,
      },
      data,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'finsquare_high_importance_channel',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    // Handle failed tokens
    response.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error) {
        const error = resp.error;
        if (
          error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered'
        ) {
          this.invalidateToken(tokens[idx]);
        }
      }
    });

    this.logger.log(
      `Multicast: ${response.successCount} success, ${response.failureCount} failed`,
    );

    return response;
  }

  /**
   * Invalidate a token (remove from database)
   */
  private async invalidateToken(token: string): Promise<void> {
    try {
      await this.prisma.user.updateMany({
        where: { fcmToken: token },
        data: { fcmToken: null, devicePlatform: null },
      });
      this.logger.log(`Invalidated FCM token ${token.substring(0, 20)}...`);
    } catch (error) {
      this.logger.error('Failed to invalidate token', error);
    }
  }
}
