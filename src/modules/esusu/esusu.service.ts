import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ZeptomailService } from '../../integrations/zeptomail/zeptomail.service';
import {
  CommunityRole,
  EsusuStatus,
  EsusuInviteStatus,
  PaymentFrequency,
  PayoutOrderType,
} from '@prisma/client';
import { CreateEsusuDto, PaymentFrequencyDto, PayoutOrderTypeDto } from './dto';

@Injectable()
export class EsusuService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private zeptomailService: ZeptomailService,
  ) {}

  /**
   * Check if a user can create an Esusu in the community
   * Requirements:
   * 1. User must be Admin of the active community
   * 2. Community must have at least 3 members
   * 3. Community must have a wallet
   */
  async checkEsusuEligibility(userId: string, communityId: string) {
    // Check if user is Admin of this community
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_communityId: { userId, communityId },
      },
      include: {
        community: {
          select: {
            id: true,
            name: true,
            isDefault: true,
          },
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this community');
    }

    // Default FinSquare community cannot have Esusu
    if (membership.community.isDefault) {
      return {
        success: true,
        data: {
          communityId,
          communityName: membership.community.name,
          canCreateEsusu: false,
          isAdmin: membership.role === CommunityRole.ADMIN,
          reason: 'DEFAULT_COMMUNITY',
          message: 'Default FinSquare community does not support Esusu',
        },
      };
    }

    const isAdmin = membership.role === CommunityRole.ADMIN;

    // Get member count
    const memberCount = await this.prisma.membership.count({
      where: { communityId },
    });

    // Check if community wallet exists
    const communityWallet = await this.prisma.community_wallets.findUnique({
      where: { communityId },
    });

    const hasCommunityWallet = !!communityWallet;
    const hasEnoughMembers = memberCount >= 3;

    let reason: string | null = null;
    let message: string | null = null;

    if (!isAdmin) {
      reason = 'NOT_ADMIN';
      message = 'Only community admins can create Esusu';
    } else if (!hasEnoughMembers) {
      reason = 'INSUFFICIENT_MEMBERS';
      message = 'You need at least 3 members to create an Esusu. Invite more members to get started.';
    } else if (!hasCommunityWallet) {
      reason = 'NO_COMMUNITY_WALLET';
      message = 'Please set up your community wallet first to create an Esusu.';
    }

    const canCreateEsusu = isAdmin && hasEnoughMembers && hasCommunityWallet;

    return {
      success: true,
      data: {
        communityId,
        communityName: membership.community.name,
        canCreateEsusu,
        isAdmin,
        memberCount,
        hasCommunityWallet,
        reason,
        message,
      },
    };
  }

  /**
   * Check if an Esusu name is available in the community
   * Only checks against active Esusus (not completed/cancelled)
   */
  async checkNameAvailability(communityId: string, name: string) {
    const trimmedName = name.trim();

    if (trimmedName.length < 3) {
      return {
        success: true,
        data: {
          available: false,
          message: 'Name must be at least 3 characters',
        },
      };
    }

    // Check for existing active Esusu with same name (case-insensitive)
    const existingEsusu = await this.prisma.esusu.findFirst({
      where: {
        communityId,
        name: {
          equals: trimmedName,
          mode: 'insensitive',
        },
        status: {
          in: [
            EsusuStatus.PENDING_MEMBERS,
            EsusuStatus.READY_TO_START,
            EsusuStatus.ACTIVE,
            EsusuStatus.PAUSED,
          ],
        },
      },
    });

    return {
      success: true,
      data: {
        available: !existingEsusu,
        message: existingEsusu ? 'This name is already in use' : null,
      },
    };
  }

  /**
   * Create a new Esusu
   */
  async createEsusu(userId: string, dto: CreateEsusuDto) {
    // 1. Verify user is Admin of the community
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_communityId: { userId, communityId: dto.communityId },
      },
      include: {
        community: {
          select: {
            id: true,
            name: true,
            isDefault: true,
          },
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this community');
    }

    if (membership.role !== CommunityRole.ADMIN) {
      throw new ForbiddenException('Only community admins can create Esusu');
    }

    if (membership.community.isDefault) {
      throw new BadRequestException('Cannot create Esusu in default community');
    }

    // 2. Check eligibility
    const eligibility = await this.checkEsusuEligibility(userId, dto.communityId);
    if (!eligibility.data.canCreateEsusu) {
      throw new BadRequestException(eligibility.data.message || 'Not eligible to create Esusu');
    }

    // 3. Check name availability
    const nameCheck = await this.checkNameAvailability(dto.communityId, dto.name);
    if (!nameCheck.data.available) {
      throw new BadRequestException(nameCheck.data.message || 'Name not available');
    }

    // 4. Validate dates
    const now = new Date();
    const deadline = new Date(dto.participationDeadline);
    const collectionDate = new Date(dto.collectionDate);

    if (deadline <= now) {
      throw new BadRequestException('Participation deadline must be in the future');
    }

    // Check minimum 3-day buffer between deadline and collection date
    const minBuffer = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds
    if (collectionDate.getTime() - deadline.getTime() < minBuffer) {
      throw new BadRequestException('Collection date must be at least 3 days after the deadline');
    }

    // 5. Validate participants count
    if (dto.participants.length !== dto.numberOfParticipants) {
      throw new BadRequestException(
        `Expected ${dto.numberOfParticipants} participants, got ${dto.participants.length}`,
      );
    }

    // 6. Validate all participants are community members
    const participantIds = dto.participants.map((p) => p.userId);
    const memberships = await this.prisma.membership.findMany({
      where: {
        communityId: dto.communityId,
        userId: { in: participantIds },
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            fcmToken: true,
          },
        },
      },
    });

    if (memberships.length !== participantIds.length) {
      throw new BadRequestException('One or more participants are not members of this community');
    }

    // 7. Validate commission
    if (dto.takeCommission && (!dto.commissionPercentage || dto.commissionPercentage < 1 || dto.commissionPercentage > 50)) {
      throw new BadRequestException('Commission percentage must be between 1% and 50%');
    }

    // 8. Map frequency and payout order type
    const frequencyMap: Record<PaymentFrequencyDto, PaymentFrequency> = {
      [PaymentFrequencyDto.WEEKLY]: PaymentFrequency.WEEKLY,
      [PaymentFrequencyDto.MONTHLY]: PaymentFrequency.MONTHLY,
      [PaymentFrequencyDto.QUARTERLY]: PaymentFrequency.QUARTERLY,
    };

    const payoutOrderMap: Record<PayoutOrderTypeDto, PayoutOrderType> = {
      [PayoutOrderTypeDto.RANDOM]: PayoutOrderType.RANDOM,
      [PayoutOrderTypeDto.FIRST_COME_FIRST_SERVED]: PayoutOrderType.FIRST_COME_FIRST_SERVED,
    };

    // 9. Create Esusu in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create the Esusu
      const esusu = await tx.esusu.create({
        data: {
          communityId: dto.communityId,
          creatorId: userId,
          name: dto.name.trim(),
          description: dto.description?.trim(),
          iconUrl: dto.iconUrl,
          numberOfParticipants: dto.numberOfParticipants,
          contributionAmount: dto.contributionAmount,
          frequency: frequencyMap[dto.frequency],
          participationDeadline: deadline,
          collectionDate: collectionDate,
          takeCommission: dto.takeCommission,
          commissionPercentage: dto.takeCommission ? dto.commissionPercentage : null,
          payoutOrderType: payoutOrderMap[dto.payoutOrderType],
          status: EsusuStatus.PENDING_MEMBERS,
          currentCycle: 0,
        },
      });

      // Create participant records
      const participantRecords = participantIds.map((participantUserId) => ({
        esusuId: esusu.id,
        userId: participantUserId,
        inviteStatus: EsusuInviteStatus.INVITED,
        isCreator: participantUserId === userId,
      }));

      await tx.esusuParticipant.createMany({
        data: participantRecords,
      });

      return esusu;
    });

    // 10. Send notifications to all invited participants (non-blocking)
    this.sendInviteNotifications(
      result.id,
      result.name,
      membership.user.fullName,
      membership.community.name,
      memberships,
      userId,
      dto.contributionAmount,
      frequencyMap[dto.frequency],
      deadline,
    );

    // 11. Calculate summary for response
    const totalPool = dto.numberOfParticipants * dto.contributionAmount;
    const platformFee = totalPool * 0.015;
    const commission = dto.takeCommission && dto.commissionPercentage
      ? (totalPool * dto.commissionPercentage) / 100
      : 0;
    const netPayout = totalPool - platformFee - commission;

    return {
      success: true,
      message: 'Esusu created successfully. Invitations sent.',
      data: {
        id: result.id,
        name: result.name,
        description: result.description,
        status: result.status,
        numberOfParticipants: result.numberOfParticipants,
        contributionAmount: Number(result.contributionAmount),
        frequency: result.frequency,
        participationDeadline: result.participationDeadline,
        collectionDate: result.collectionDate,
        takeCommission: result.takeCommission,
        commissionPercentage: result.commissionPercentage,
        payoutOrderType: result.payoutOrderType,
        summary: {
          totalPool,
          platformFee,
          commission,
          netPayout,
        },
        communityName: membership.community.name,
        createdAt: result.createdAt,
      },
    };
  }

  /**
   * Send invite notifications to all participants
   */
  private async sendInviteNotifications(
    esusuId: string,
    esusuName: string,
    creatorName: string,
    communityName: string,
    memberships: any[],
    creatorId: string,
    contributionAmount: number,
    frequency: PaymentFrequency,
    deadline: Date,
  ) {
    const frequencyText = {
      [PaymentFrequency.WEEKLY]: 'weekly',
      [PaymentFrequency.MONTHLY]: 'monthly',
      [PaymentFrequency.QUARTERLY]: 'quarterly',
    };

    for (const membership of memberships) {
      // Skip the creator (they don't need an invite notification for their own Esusu)
      if (membership.user.id === creatorId) {
        continue;
      }

      // Push notification
      this.notificationsService.sendToUser(
        membership.user.id,
        "You've been invited to an Esusu",
        `${creatorName} invited you to join '${esusuName}'. Tap to view details.`,
        {
          type: 'esusu_invite',
          esusuId,
          esusuName,
          communityName,
          creatorName,
        },
      ).catch((err) => console.error('Failed to send Esusu invite push notification:', err));

      // Email notification
      if (membership.user.email) {
        const formattedDeadline = deadline.toLocaleDateString('en-NG', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

        const formattedAmount = new Intl.NumberFormat('en-NG', {
          style: 'currency',
          currency: 'NGN',
        }).format(contributionAmount);

        this.zeptomailService.sendEmail(
          membership.user.email,
          `You've been invited to join an Esusu on FinSquare`,
          `
            <p>Hello ${membership.user.fullName},</p>
            <p><strong>${creatorName}</strong> has invited you to join <strong>"${esusuName}"</strong> in the ${communityName} community on FinSquare.</p>
            <p><strong>Details:</strong></p>
            <ul>
              <li>Contribution: ${formattedAmount} ${frequencyText[frequency]}</li>
              <li>Response Deadline: ${formattedDeadline}</li>
            </ul>
            <p>Open the FinSquare app to view the full details and respond to this invitation.</p>
            <p>Best regards,<br>FinSquare Team</p>
          `,
        ).catch((err) => console.error('Failed to send Esusu invite email:', err));
      }
    }
  }

  /**
   * Get community members for participant selection
   * Returns all members except already filtered ones
   */
  async getCommunityMembersForEsusu(userId: string, communityId: string) {
    // Verify user is admin
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_communityId: { userId, communityId },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this community');
    }

    if (membership.role !== CommunityRole.ADMIN) {
      throw new ForbiddenException('Only community admins can access this');
    }

    // Get all community members
    const members = await this.prisma.membership.findMany({
      where: { communityId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            fullName: true,
            email: true,
            photo: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' },
        { joinedAt: 'asc' },
      ],
    });

    return {
      success: true,
      message: 'Community members retrieved',
      data: {
        members: members.map((m) => ({
          id: m.user.id,
          firstName: m.user.firstName,
          lastName: m.user.lastName,
          fullName: m.user.fullName,
          email: m.user.email,
          photo: m.user.photo,
          role: m.role,
          isAdmin: m.role === CommunityRole.ADMIN,
        })),
        totalCount: members.length,
      },
    };
  }
}
