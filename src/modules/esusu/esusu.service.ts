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
  CommissionType,
  NotificationFeature,
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

    // Check minimum 24-hour buffer between deadline and collection date
    const minBuffer = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    if (collectionDate.getTime() - deadline.getTime() < minBuffer) {
      throw new BadRequestException('Collection date must be at least 24 hours after the deadline');
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

    // 7. Validate commission based on type
    if (dto.takeCommission) {
      if (!dto.commissionType) {
        throw new BadRequestException('Commission type is required when taking commission');
      }

      if (dto.commissionType === 'PERCENTAGE') {
        if (!dto.commissionPercentage || dto.commissionPercentage < 5 || dto.commissionPercentage > 50) {
          throw new BadRequestException('Commission percentage must be between 5% and 50%');
        }
      } else if (dto.commissionType === 'CASH') {
        if (!dto.commissionAmount || dto.commissionAmount < 1) {
          throw new BadRequestException('Commission amount must be at least 1');
        }
      }
    }

    // 7.1 Validate admin slot if provided (for FCFS when admin is participating)
    const isAdminParticipating = participantIds.includes(userId);
    const isFCFS = dto.payoutOrderType === PayoutOrderTypeDto.FIRST_COME_FIRST_SERVED;

    if (dto.adminSlot !== undefined && dto.adminSlot !== null) {
      if (!isFCFS) {
        throw new BadRequestException('Admin slot selection is only valid for First Come First Served payout order');
      }
      if (!isAdminParticipating) {
        throw new BadRequestException('Admin slot selection is only valid when admin is participating');
      }
      if (dto.adminSlot < 1 || dto.adminSlot > dto.numberOfParticipants) {
        throw new BadRequestException(`Slot number must be between 1 and ${dto.numberOfParticipants}`);
      }
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
          commissionType: dto.takeCommission && dto.commissionType
            ? (dto.commissionType as unknown as CommissionType)
            : null,
          commissionPercentage: dto.takeCommission && dto.commissionType === 'PERCENTAGE'
            ? dto.commissionPercentage
            : null,
          commissionAmount: dto.takeCommission && dto.commissionType === 'CASH'
            ? dto.commissionAmount
            : null,
          payoutOrderType: payoutOrderMap[dto.payoutOrderType],
          status: EsusuStatus.PENDING_MEMBERS,
          currentCycle: 0,
        },
      });

      // Create participant records
      // Creator is auto-accepted (they created it, so they don't need to accept their own invitation)
      // If admin is participating with FCFS and has pre-selected a slot, assign it
      const participantRecords = participantIds.map((participantUserId) => {
        const isCreatorParticipant = participantUserId === userId;
        const shouldAssignSlot = isCreatorParticipant && isFCFS && dto.adminSlot !== undefined && dto.adminSlot !== null;

        return {
          esusuId: esusu.id,
          userId: participantUserId,
          inviteStatus: isCreatorParticipant
            ? EsusuInviteStatus.ACCEPTED
            : EsusuInviteStatus.INVITED,
          isCreator: isCreatorParticipant,
          respondedAt: isCreatorParticipant ? new Date() : null,
          slotNumber: shouldAssignSlot ? dto.adminSlot : null,
        };
      });

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
      dto.communityId,
      memberships,
      userId,
      dto.contributionAmount,
      frequencyMap[dto.frequency],
      deadline,
      dto.numberOfParticipants,
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
    communityId: string,
    memberships: any[],
    creatorId: string,
    contributionAmount: number,
    frequency: PaymentFrequency,
    deadline: Date,
    numberOfParticipants: number,
  ) {
    const frequencyText = {
      [PaymentFrequency.WEEKLY]: 'weekly',
      [PaymentFrequency.MONTHLY]: 'monthly',
      [PaymentFrequency.QUARTERLY]: 'quarterly',
    };

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

    for (const membership of memberships) {
      const isCreator = membership.user.id === creatorId;

      if (isCreator) {
        // Send confirmation notification to the creator
        this.notificationsService.sendToUser(
          membership.user.id,
          'Esusu Created Successfully',
          `Your Esusu "${esusuName}" has been created. Invitations have been sent to ${numberOfParticipants - 1} members.`,
          {
            type: 'esusu_created',
            esusuId,
            esusuName,
            communityName,
          },
        ).catch((err) => console.error('Failed to send Esusu creation push notification:', err));

        // Create in-app notification for creator
        this.notificationsService.createInAppNotification({
          userId: membership.user.id,
          communityId,
          feature: NotificationFeature.ESUSU,
          type: 'esusu_created',
          title: 'Esusu Created Successfully',
          message: `Your Esusu "${esusuName}" has been created. Invitations have been sent to ${numberOfParticipants - 1} members.`,
          data: { esusuId, esusuName, communityName },
        }).catch((err) => console.error('Failed to create in-app notification:', err));

        // Send confirmation email to the creator
        if (membership.user.email) {
          this.zeptomailService.sendEmail(
            membership.user.email,
            `Your Esusu "${esusuName}" has been created`,
            `
              <p>Hello ${membership.user.fullName},</p>
              <p>Your Esusu <strong>"${esusuName}"</strong> has been successfully created in the ${communityName} community.</p>
              <p><strong>Details:</strong></p>
              <ul>
                <li>Contribution: ${formattedAmount} ${frequencyText[frequency]}</li>
                <li>Participants: ${numberOfParticipants}</li>
                <li>Response Deadline: ${formattedDeadline}</li>
              </ul>
              <p>Invitations have been sent to all selected participants. You'll be notified as members respond to the invitation.</p>
              <p>Best regards,<br>FinSquare Team</p>
            `,
          ).catch((err) => console.error('Failed to send Esusu creation email:', err));
        }
      } else {
        // Send invite notification to participants
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

        // Create in-app notification for invited participant
        this.notificationsService.createInAppNotification({
          userId: membership.user.id,
          communityId,
          feature: NotificationFeature.ESUSU,
          type: 'esusu_invite',
          title: `${creatorName} invited you to join Esusu`,
          message: `You've been invited to join "${esusuName}". Tap to view details.`,
          data: { esusuId, esusuName, communityName, creatorName },
        }).catch((err) => console.error('Failed to create in-app notification:', err));

        // Email notification
        if (membership.user.email) {
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
  }

  /**
   * Get Esusu count for Hub display
   * Admin: sees all Esusus in the community
   * Member: sees only Esusus they're participating in
   */
  async getHubCount(userId: string, communityId: string) {
    // Get user's role in community
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_communityId: { userId, communityId },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this community');
    }

    const isAdmin = membership.role === CommunityRole.ADMIN;

    if (isAdmin) {
      // Admin sees all Esusus in the community (except completed/cancelled)
      const counts = await this.prisma.esusu.groupBy({
        by: ['status'],
        where: {
          communityId,
          status: {
            notIn: [EsusuStatus.COMPLETED, EsusuStatus.CANCELLED],
          },
        },
        _count: true,
      });

      let total = 0;
      let active = 0;
      let pendingMembers = 0;

      for (const item of counts) {
        total += item._count;
        if (item.status === EsusuStatus.ACTIVE) {
          active += item._count;
        } else if (item.status === EsusuStatus.PENDING_MEMBERS) {
          pendingMembers += item._count;
        }
      }

      return {
        success: true,
        data: {
          total,
          active,
          pendingMembers,
          isAdmin: true,
        },
      };
    } else {
      // Member sees only Esusus they've ACCEPTED (not pending invitations)
      const participations = await this.prisma.esusuParticipant.findMany({
        where: {
          userId,
          inviteStatus: EsusuInviteStatus.ACCEPTED, // Only count accepted invitations
          esusu: {
            communityId,
            status: {
              notIn: [EsusuStatus.COMPLETED, EsusuStatus.CANCELLED],
            },
          },
        },
        include: {
          esusu: {
            select: {
              status: true,
            },
          },
        },
      });

      let total = 0;
      let active = 0;
      let pendingMembers = 0;

      for (const p of participations) {
        total++;
        if (p.esusu.status === EsusuStatus.ACTIVE) {
          active++;
        } else if (p.esusu.status === EsusuStatus.PENDING_MEMBERS) {
          pendingMembers++;
        }
      }

      return {
        success: true,
        data: {
          total,
          active,
          pendingMembers,
          isAdmin: false,
        },
      };
    }
  }

  /**
   * Get Esusu list for the Esusu List page
   * Admin: sees all Esusus in the community
   * Member: sees only Esusus they're participating in
   */
  async getEsusuList(userId: string, communityId: string, archived: boolean = false) {
    // Get user's role in community
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_communityId: { userId, communityId },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this community');
    }

    const isAdmin = membership.role === CommunityRole.ADMIN;

    // Define status filter based on archived flag
    const activeStatuses = [
      EsusuStatus.PENDING_MEMBERS,
      EsusuStatus.READY_TO_START,
      EsusuStatus.ACTIVE,
      EsusuStatus.PAUSED,
    ];
    const archivedStatuses = [EsusuStatus.COMPLETED, EsusuStatus.CANCELLED];

    const statusFilter = archived ? archivedStatuses : activeStatuses;

    if (isAdmin) {
      // Admin sees all Esusus in the community
      const esusus = await this.prisma.esusu.findMany({
        where: {
          communityId,
          status: { in: statusFilter },
        },
        include: {
          participants: {
            select: {
              userId: true,
              inviteStatus: true,
              slotNumber: true,
            },
          },
          cycles: {
            where: {
              status: { in: ['ACTIVE', 'UPCOMING'] },
            },
            orderBy: { cycleNumber: 'asc' },
            take: 1,
            select: {
              payoutDate: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Get creator names
      const creatorIds = [...new Set(esusus.map((e) => e.creatorId))];
      const creators = await this.prisma.user.findMany({
        where: { id: { in: creatorIds } },
        select: { id: true, fullName: true },
      });
      const creatorMap = new Map(creators.map((c) => [c.id, c.fullName]));

      const result = esusus.map((esusu) => {
        const acceptedCount = esusu.participants.filter(
          (p) => p.inviteStatus === EsusuInviteStatus.ACCEPTED,
        ).length;
        const pendingCount = esusu.participants.filter(
          (p) => p.inviteStatus === EsusuInviteStatus.INVITED,
        ).length;

        // Check if admin is a participant and get their participation details
        const adminParticipation = esusu.participants.find((p) => p.userId === userId);
        const isParticipant = !!adminParticipation;
        const inviteStatus = adminParticipation?.inviteStatus || null;
        const slotNumber = adminParticipation?.slotNumber || null;

        // Get next payout date from cycles
        const nextPayoutDate = esusu.cycles[0]?.payoutDate || null;

        // Calculate days until payout for active Esusus
        let daysUntilPayout: number | null = null;
        if (esusu.status === EsusuStatus.ACTIVE && nextPayoutDate) {
          const now = new Date();
          const payoutDate = new Date(nextPayoutDate);
          daysUntilPayout = Math.ceil(
            (payoutDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          );
          if (daysUntilPayout < 0) daysUntilPayout = 0;
        }

        // Calculate progress
        const progress =
          esusu.numberOfParticipants > 0
            ? esusu.currentCycle / esusu.numberOfParticipants
            : 0;

        return {
          id: esusu.id,
          name: esusu.name,
          status: esusu.status,
          iconUrl: esusu.iconUrl,
          contributionAmount: Number(esusu.contributionAmount),
          frequency: esusu.frequency,
          payoutOrderType: esusu.payoutOrderType,
          numberOfParticipants: esusu.numberOfParticipants,
          currentCycle: esusu.currentCycle,
          totalCycles: esusu.numberOfParticipants,
          nextPayoutDate,
          daysUntilPayout,
          progress,
          acceptedCount,
          pendingCount,
          participationDeadline: esusu.participationDeadline,
          isCreator: esusu.creatorId === userId,
          creatorName: creatorMap.get(esusu.creatorId) || 'Unknown',
          // Admin participation fields for navigation
          isParticipant,
          inviteStatus,
          slotNumber,
        };
      });

      return {
        success: true,
        data: {
          esusus: result,
          isAdmin: true,
        },
      };
    } else {
      // Member sees only Esusus they're part of
      const participations = await this.prisma.esusuParticipant.findMany({
        where: {
          userId,
          esusu: {
            communityId,
            status: { in: statusFilter },
          },
        },
        include: {
          esusu: {
            include: {
              participants: {
                select: {
                  inviteStatus: true,
                },
              },
              cycles: {
                where: {
                  status: { in: ['ACTIVE', 'UPCOMING'] },
                },
                orderBy: { cycleNumber: 'asc' },
                take: 1,
                select: {
                  payoutDate: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Get creator names
      const creatorIds = [...new Set(participations.map((p) => p.esusu.creatorId))];
      const creators = await this.prisma.user.findMany({
        where: { id: { in: creatorIds } },
        select: { id: true, fullName: true },
      });
      const creatorMap = new Map(creators.map((c) => [c.id, c.fullName]));

      const result = participations.map((p) => {
        const esusu = p.esusu;
        const acceptedCount = esusu.participants.filter(
          (part) => part.inviteStatus === EsusuInviteStatus.ACCEPTED,
        ).length;

        // Get next payout date from cycles
        const nextPayoutDate = esusu.cycles[0]?.payoutDate || null;

        // Calculate days until payout for active Esusus
        let daysUntilPayout: number | null = null;
        if (esusu.status === EsusuStatus.ACTIVE && nextPayoutDate) {
          const now = new Date();
          const payoutDate = new Date(nextPayoutDate);
          daysUntilPayout = Math.ceil(
            (payoutDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          );
          if (daysUntilPayout < 0) daysUntilPayout = 0;
        }

        // Calculate progress
        const progress =
          esusu.numberOfParticipants > 0
            ? esusu.currentCycle / esusu.numberOfParticipants
            : 0;

        return {
          id: esusu.id,
          name: esusu.name,
          status: esusu.status,
          inviteStatus: p.inviteStatus,
          slotNumber: p.slotNumber,
          iconUrl: esusu.iconUrl,
          contributionAmount: Number(esusu.contributionAmount),
          frequency: esusu.frequency,
          payoutOrderType: esusu.payoutOrderType,
          numberOfParticipants: esusu.numberOfParticipants,
          currentCycle: esusu.currentCycle,
          totalCycles: esusu.numberOfParticipants,
          nextPayoutDate,
          daysUntilPayout,
          progress,
          acceptedCount,
          participationDeadline: esusu.participationDeadline,
          isCreator: esusu.creatorId === userId,
          creatorName: creatorMap.get(esusu.creatorId) || 'Unknown',
        };
      });

      return {
        success: true,
        data: {
          esusus: result,
          isAdmin: false,
        },
      };
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

    // Get all community members with wallet status
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
            walletSetupStep: true,
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
          isCurrentUser: m.user.id === userId,
          hasActiveWallet: m.user.walletSetupStep === 'COMPLETED',
        })),
        totalCount: members.length,
      },
    };
  }

  /**
   * Get Esusu invitation details for a member to review
   */
  async getInvitationDetails(userId: string, esusuId: string) {
    // Get the Esusu
    const esusu = await this.prisma.esusu.findUnique({
      where: { id: esusuId },
    });

    if (!esusu) {
      throw new NotFoundException('Esusu not found');
    }

    // Check if user is invited to this Esusu
    const participation = await this.prisma.esusuParticipant.findUnique({
      where: {
        esusuId_userId: { esusuId, userId },
      },
    });

    if (!participation) {
      throw new ForbiddenException('You are not invited to this Esusu');
    }

    // Get creator details
    const creator = await this.prisma.user.findUnique({
      where: { id: esusu.creatorId },
      select: { fullName: true },
    });

    // Calculate financial details
    const totalAmountPerCycle = esusu.numberOfParticipants * Number(esusu.contributionAmount);
    const platformFeePercent = 1.5;
    const platformFee = totalAmountPerCycle * (platformFeePercent / 100);
    const commission = esusu.takeCommission && esusu.commissionPercentage
      ? totalAmountPerCycle * (esusu.commissionPercentage / 100)
      : 0;
    const payout = totalAmountPerCycle - platformFee - commission;

    // Generate payout schedule based on frequency and collection date
    const payoutSchedule = this.generatePayoutSchedule(
      new Date(esusu.collectionDate),
      esusu.frequency,
      esusu.numberOfParticipants,
    );

    // Map frequency to display string
    const frequencyMap: Record<PaymentFrequency, string> = {
      [PaymentFrequency.WEEKLY]: 'Weekly',
      [PaymentFrequency.MONTHLY]: 'Monthly',
      [PaymentFrequency.QUARTERLY]: 'Quarterly',
    };

    return {
      success: true,
      data: {
        id: esusu.id,
        name: esusu.name,
        description: esusu.description,
        iconUrl: esusu.iconUrl,
        contributionAmount: Number(esusu.contributionAmount),
        frequency: frequencyMap[esusu.frequency],
        targetMembers: esusu.numberOfParticipants,
        startDate: esusu.collectionDate,
        totalAmountPerCycle,
        commission,
        platformFeePercent,
        platformFee,
        payout,
        payoutSchedule,
        creatorName: creator?.fullName || 'Unknown',
        participationDeadline: esusu.participationDeadline,
      },
    };
  }

  /**
   * Generate payout schedule based on collection date and frequency
   */
  private generatePayoutSchedule(
    startDate: Date,
    frequency: PaymentFrequency,
    numberOfCycles: number,
  ): { cycleNumber: number; payoutDate: Date }[] {
    const schedule: { cycleNumber: number; payoutDate: Date }[] = [];
    let currentDate = new Date(startDate);

    for (let i = 0; i < numberOfCycles; i++) {
      schedule.push({
        cycleNumber: i + 1,
        payoutDate: new Date(currentDate),
      });

      // Move to next cycle based on frequency
      switch (frequency) {
        case PaymentFrequency.WEEKLY:
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case PaymentFrequency.MONTHLY:
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
        case PaymentFrequency.QUARTERLY:
          currentDate.setMonth(currentDate.getMonth() + 3);
          break;
      }
    }

    return schedule;
  }

  /**
   * Respond to Esusu invitation (accept or decline)
   */
  async respondToInvitation(userId: string, esusuId: string, accept: boolean) {
    // Get the Esusu
    const esusu = await this.prisma.esusu.findUnique({
      where: { id: esusuId },
    });

    if (!esusu) {
      throw new NotFoundException('Esusu not found');
    }

    // Get creator details
    const creator = await this.prisma.user.findUnique({
      where: { id: esusu.creatorId },
      select: { id: true, fullName: true, email: true },
    });

    // Check if user is invited
    const participation = await this.prisma.esusuParticipant.findUnique({
      where: {
        esusuId_userId: { esusuId, userId },
      },
    });

    if (!participation) {
      throw new ForbiddenException('You are not invited to this Esusu');
    }

    // Creator cannot decline their own Esusu - they must cancel it instead
    if (!accept && participation.isCreator) {
      throw new BadRequestException('As the creator, you cannot decline. You can cancel the Esusu instead.');
    }

    // Get participant user details
    const participantUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, email: true },
    });

    // Check if already responded
    if (participation.inviteStatus !== EsusuInviteStatus.INVITED) {
      throw new BadRequestException('You have already responded to this invitation');
    }

    // Check if deadline has passed
    if (new Date() > esusu.participationDeadline) {
      throw new BadRequestException('The participation deadline has passed');
    }

    // Check if Esusu is still accepting responses
    if (esusu.status !== EsusuStatus.PENDING_MEMBERS) {
      throw new BadRequestException('This Esusu is no longer accepting responses');
    }

    // Update participation status
    const newStatus = accept ? EsusuInviteStatus.ACCEPTED : EsusuInviteStatus.DECLINED;

    await this.prisma.esusuParticipant.update({
      where: {
        esusuId_userId: { esusuId, userId },
      },
      data: {
        inviteStatus: newStatus,
        respondedAt: new Date(),
      },
    });

    // Handle ACCEPT flow
    if (accept) {
      // For FCFS payout order, don't set READY_TO_START here - wait until all members select slots
      if (esusu.payoutOrderType === PayoutOrderType.RANDOM) {
        const allParticipants = await this.prisma.esusuParticipant.findMany({
          where: { esusuId },
        });

        const allAccepted = allParticipants.every(
          (p) => p.inviteStatus === EsusuInviteStatus.ACCEPTED,
        );

        if (allAccepted && creator) {
          await this.prisma.esusu.update({
            where: { id: esusuId },
            data: { status: EsusuStatus.READY_TO_START },
          });

          // Notify creator that all members have accepted
          this.notificationsService.sendToUser(
            creator.id,
            'All Members Accepted!',
            `All members have accepted the invitation for "${esusu.name}". The Esusu is ready to start!`,
            {
              type: 'esusu_ready',
              esusuId,
              esusuName: esusu.name,
            },
          ).catch((err) => console.error('Failed to send ready notification:', err));

          // In-app notification for ready status
          this.notificationsService.createInAppNotification({
            userId: creator.id,
            communityId: esusu.communityId,
            feature: NotificationFeature.ESUSU,
            type: 'esusu_ready',
            title: 'All Members Accepted!',
            message: `All members have accepted the invitation for "${esusu.name}". The Esusu is ready to start!`,
            data: { esusuId, esusuName: esusu.name },
          }).catch((err) => console.error('Failed to create in-app notification:', err));
        }
      }

      // Notify creator about the acceptance
      if (creator && participantUser) {
        this.notificationsService.sendToUser(
          creator.id,
          'Esusu Invitation Accepted',
          `${participantUser.fullName} has accepted the invitation for "${esusu.name}".`,
          {
            type: 'esusu_invite_accepted',
            esusuId,
            esusuName: esusu.name,
            memberName: participantUser.fullName,
          },
        ).catch((err) => console.error('Failed to send accept notification:', err));

        // In-app notification for acceptance
        this.notificationsService.createInAppNotification({
          userId: creator.id,
          communityId: esusu.communityId,
          feature: NotificationFeature.ESUSU,
          type: 'esusu_invite_accepted',
          title: `${participantUser.fullName} accepted Esusu invite`,
          message: `${participantUser.fullName} has accepted the invitation to join "${esusu.name}".`,
          data: { esusuId, esusuName: esusu.name, memberName: participantUser.fullName },
        }).catch((err) => console.error('Failed to create in-app notification:', err));
      }

      // Send confirmation to member
      if (participantUser) {
        // Push notification to member
        this.notificationsService.sendToUser(
          participantUser.id,
          'Esusu Joined Successfully!',
          `You have successfully joined "${esusu.name}". You'll be notified when the Esusu starts.`,
          {
            type: 'esusu_joined',
            esusuId,
            esusuName: esusu.name,
          },
        ).catch((err) => console.error('Failed to send member join notification:', err));

        // In-app notification for joining
        this.notificationsService.createInAppNotification({
          userId: participantUser.id,
          communityId: esusu.communityId,
          feature: NotificationFeature.ESUSU,
          type: 'esusu_joined',
          title: 'Esusu Joined Successfully!',
          message: `You have successfully joined "${esusu.name}". You'll be notified when the Esusu starts.`,
          data: { esusuId, esusuName: esusu.name },
        }).catch((err) => console.error('Failed to create in-app notification:', err));

        // Email to member
        const contributionAmount = esusu.contributionAmount.toNumber().toLocaleString();
        const startDate = esusu.collectionDate.toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });
        this.zeptomailService.sendEmail(
          participantUser.email,
          `You've Joined ${esusu.name} - FinSquare`,
          `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #8B20E9;">Welcome to ${esusu.name}!</h2>
              <p>Hi ${participantUser.fullName},</p>
              <p>You have successfully joined the Esusu "<strong>${esusu.name}</strong>".</p>
              <div style="background-color: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p style="margin: 8px 0;"><strong>Contribution Amount:</strong> ₦${contributionAmount}</p>
                <p style="margin: 8px 0;"><strong>Frequency:</strong> ${esusu.frequency}</p>
                <p style="margin: 8px 0;"><strong>Start Date:</strong> ${startDate}</p>
              </div>
              <p>You'll receive a notification when the Esusu is ready to start.</p>
              <p>Best regards,<br>The FinSquare Team</p>
            </div>
          `,
        ).catch((err) => console.error('Failed to send member join email:', err));
      }

      return {
        success: true,
        message: 'You have successfully joined this Esusu',
        data: {
          esusuId: esusu.id,
          esusuName: esusu.name,
          payoutOrderType: esusu.payoutOrderType,
        },
      };
    }

    // Handle DECLINE flow
    // Check remaining eligible participants (ACCEPTED + INVITED, excluding the one who just declined)
    const remainingCount = await this.prisma.esusuParticipant.count({
      where: {
        esusuId,
        inviteStatus: { in: [EsusuInviteStatus.ACCEPTED, EsusuInviteStatus.INVITED] },
      },
    });

    let esusuCancelled = false;

    // Minimum 3 participants required - if remaining < 3, cancel Esusu
    if (remainingCount < 3) {
      esusuCancelled = true;

      // Cancel the Esusu
      await this.prisma.esusu.update({
        where: { id: esusuId },
        data: {
          status: EsusuStatus.CANCELLED,
        },
      });

      // Get community name for notifications
      const community = await this.prisma.community.findUnique({
        where: { id: esusu.communityId },
        select: { name: true },
      });

      // Notify admin about cancellation
      if (creator) {
        this.notificationsService.sendToUser(
          creator.id,
          'Esusu Cancelled',
          `"${esusu.name}" has been cancelled due to insufficient participants after ${participantUser?.fullName || 'a member'} declined.`,
          {
            type: 'esusu_cancelled',
            esusuId,
            esusuName: esusu.name,
          },
        ).catch((err) => console.error('Failed to send cancellation notification to creator:', err));

        // In-app notification for cancellation
        this.notificationsService.createInAppNotification({
          userId: creator.id,
          communityId: esusu.communityId,
          feature: NotificationFeature.ESUSU,
          type: 'esusu_cancelled',
          title: 'Esusu Cancelled',
          message: `"${esusu.name}" has been cancelled due to insufficient participants.`,
          data: { esusuId, esusuName: esusu.name },
        }).catch((err) => console.error('Failed to create in-app notification:', err));

        // Email to admin
        if (creator.email) {
          this.zeptomailService.sendEmail(
            creator.email,
            `Esusu Cancelled - ${esusu.name}`,
            `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #E53E3E;">Esusu Cancelled</h2>
                <p>Hi ${creator.fullName},</p>
                <p>Unfortunately, your Esusu "<strong>${esusu.name}</strong>" has been cancelled due to insufficient participants.</p>
                <p><strong>${participantUser?.fullName || 'A member'}</strong> declined the invitation, leaving fewer than 3 eligible participants.</p>
                <p>Esusu requires a minimum of 3 participants to function.</p>
                <p>You can create a new Esusu anytime from the FinSquare app.</p>
                <p>Best regards,<br>The FinSquare Team</p>
              </div>
            `,
          ).catch((err) => console.error('Failed to send cancellation email to creator:', err));
        }
      }

      // Notify remaining ACCEPTED participants about cancellation
      const acceptedParticipants = await this.prisma.esusuParticipant.findMany({
        where: {
          esusuId,
          inviteStatus: EsusuInviteStatus.ACCEPTED,
          userId: { not: esusu.creatorId }, // Don't notify creator twice
        },
      });

      const acceptedUserIds = acceptedParticipants.map((p) => p.userId);
      const acceptedUsers = await this.prisma.user.findMany({
        where: { id: { in: acceptedUserIds } },
        select: { id: true, fullName: true, email: true },
      });

      for (const user of acceptedUsers) {
        this.notificationsService.sendToUser(
          user.id,
          'Esusu Cancelled',
          `"${esusu.name}" has been cancelled due to insufficient participants.`,
          {
            type: 'esusu_cancelled',
            esusuId,
            esusuName: esusu.name,
          },
        ).catch((err) => console.error('Failed to send cancellation notification to member:', err));

        // In-app notification for accepted members
        this.notificationsService.createInAppNotification({
          userId: user.id,
          communityId: esusu.communityId,
          feature: NotificationFeature.ESUSU,
          type: 'esusu_cancelled',
          title: 'Esusu Cancelled',
          message: `"${esusu.name}" has been cancelled due to insufficient participants.`,
          data: { esusuId, esusuName: esusu.name },
        }).catch((err) => console.error('Failed to create in-app notification:', err));

        if (user.email) {
          this.zeptomailService.sendEmail(
            user.email,
            `Esusu Cancelled - ${esusu.name}`,
            `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #E53E3E;">Esusu Cancelled</h2>
                <p>Hi ${user.fullName},</p>
                <p>The Esusu "<strong>${esusu.name}</strong>" that you joined has been cancelled due to insufficient participants.</p>
                <p>Esusu requires a minimum of 3 participants to function, and this threshold was not met.</p>
                <p>Best regards,<br>The FinSquare Team</p>
              </div>
            `,
          ).catch((err) => console.error('Failed to send cancellation email to member:', err));
        }
      }

      // Notify remaining PENDING (INVITED) participants about cancellation
      // Exclude the person who just declined and the creator
      const pendingParticipants = await this.prisma.esusuParticipant.findMany({
        where: {
          esusuId,
          inviteStatus: EsusuInviteStatus.INVITED,
          userId: { notIn: [userId, esusu.creatorId] },
        },
      });

      const pendingUserIds = pendingParticipants.map((p) => p.userId);
      const pendingUsers = await this.prisma.user.findMany({
        where: { id: { in: pendingUserIds } },
        select: { id: true, fullName: true, email: true },
      });

      for (const user of pendingUsers) {
        this.notificationsService.sendToUser(
          user.id,
          'Esusu Invitation Expired',
          `"${esusu.name}" has been cancelled before you could respond.`,
          {
            type: 'esusu_cancelled',
            esusuId,
            esusuName: esusu.name,
          },
        ).catch((err) => console.error('Failed to send cancellation notification to pending member:', err));

        // In-app notification for pending members
        this.notificationsService.createInAppNotification({
          userId: user.id,
          communityId: esusu.communityId,
          feature: NotificationFeature.ESUSU,
          type: 'esusu_invitation_expired',
          title: 'Esusu Invitation Expired',
          message: `"${esusu.name}" has been cancelled before you could respond.`,
          data: { esusuId, esusuName: esusu.name },
        }).catch((err) => console.error('Failed to create in-app notification:', err));

        if (user.email) {
          this.zeptomailService.sendEmail(
            user.email,
            `Esusu Invitation Expired - ${esusu.name}`,
            `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #8B20E9;">Esusu Invitation Expired</h2>
                <p>Hi ${user.fullName},</p>
                <p>The Esusu "<strong>${esusu.name}</strong>" that you were invited to has been cancelled due to insufficient participants.</p>
                <p>The invitation is no longer valid.</p>
                <p>Best regards,<br>The FinSquare Team</p>
              </div>
            `,
          ).catch((err) => console.error('Failed to send cancellation email to pending member:', err));
        }
      }
    } else {
      // Esusu continues - just notify admin about the decline
      if (creator && participantUser) {
        // Push notification to admin
        this.notificationsService.sendToUser(
          creator.id,
          `${esusu.name}`,
          `${participantUser.fullName} declined the invitation`,
          {
            type: 'esusu_invite_declined',
            esusuId,
            esusuName: esusu.name,
            memberName: participantUser.fullName,
          },
        ).catch((err) => console.error('Failed to send decline notification to creator:', err));

        // In-app notification for decline
        this.notificationsService.createInAppNotification({
          userId: creator.id,
          communityId: esusu.communityId,
          feature: NotificationFeature.ESUSU,
          type: 'esusu_invite_declined',
          title: `${participantUser.fullName} declined Esusu invite`,
          message: `${participantUser.fullName} declined the invitation to join "${esusu.name}".`,
          data: { esusuId, esusuName: esusu.name, memberName: participantUser.fullName },
        }).catch((err) => console.error('Failed to create in-app notification:', err));

        // Email notification to admin
        if (creator.email) {
          // Get current counts
          const acceptedCount = await this.prisma.esusuParticipant.count({
            where: { esusuId, inviteStatus: EsusuInviteStatus.ACCEPTED },
          });
          const pendingCount = await this.prisma.esusuParticipant.count({
            where: { esusuId, inviteStatus: EsusuInviteStatus.INVITED },
          });

          this.zeptomailService.sendEmail(
            creator.email,
            `Member Declined - ${esusu.name}`,
            `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #8B20E9;">Member Declined Invitation</h2>
                <p>Hi ${creator.fullName},</p>
                <p><strong>${participantUser.fullName}</strong> has declined your invitation to join "<strong>${esusu.name}</strong>".</p>
                <div style="background-color: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
                  <p style="margin: 8px 0;"><strong>Remaining Participants:</strong> ${remainingCount}</p>
                  <p style="margin: 8px 0;"><strong>Accepted:</strong> ${acceptedCount}</p>
                  <p style="margin: 8px 0;"><strong>Pending Response:</strong> ${pendingCount}</p>
                </div>
                <p>Best regards,<br>The FinSquare Team</p>
              </div>
            `,
          ).catch((err) => console.error('Failed to send decline email to creator:', err));
        }
      }
    }

    // Confirmation notification to the declining member (no email needed)
    if (participantUser) {
      this.notificationsService.sendToUser(
        participantUser.id,
        'Esusu Invitation Declined',
        `You have declined the invitation to join "${esusu.name}".`,
        {
          type: 'esusu_declined',
          esusuId,
          esusuName: esusu.name,
        },
      ).catch((err) => console.error('Failed to send decline confirmation to member:', err));
    }

    return {
      success: true,
      message: esusuCancelled
        ? 'Invitation declined. Esusu has been cancelled due to insufficient participants.'
        : 'You have declined this invitation',
      data: {
        esusuCancelled,
      },
    };
  }

  /**
   * Get slot details for FCFS Esusu
   */
  async getSlotDetails(userId: string, esusuId: string) {
    // Get the Esusu
    const esusu = await this.prisma.esusu.findUnique({
      where: { id: esusuId },
    });

    if (!esusu) {
      throw new NotFoundException('Esusu not found');
    }

    // Check if user is a participant
    const participation = await this.prisma.esusuParticipant.findUnique({
      where: {
        esusuId_userId: { esusuId, userId },
      },
    });

    if (!participation) {
      throw new ForbiddenException('You are not a participant in this Esusu');
    }

    // Check if Esusu uses FCFS payout order
    if (esusu.payoutOrderType !== PayoutOrderType.FIRST_COME_FIRST_SERVED) {
      throw new BadRequestException('This Esusu does not use First Come First Served payout order');
    }

    // Get all participants to determine taken slots
    const allParticipants = await this.prisma.esusuParticipant.findMany({
      where: { esusuId },
    });

    // Determine which slots are taken (have slotNumber assigned)
    const takenSlots = allParticipants
      .filter((p) => p.slotNumber !== null)
      .map((p) => p.slotNumber as number)
      .sort((a, b) => a - b);

    // Generate all possible slots (1 to numberOfParticipants)
    const allSlots = Array.from({ length: esusu.numberOfParticipants }, (_, i) => i + 1);
    const availableSlots = allSlots.filter((slot) => !takenSlots.includes(slot));

    return {
      success: true,
      data: {
        id: esusu.id,
        name: esusu.name,
        description: esusu.description,
        iconUrl: esusu.iconUrl,
        contributionAmount: esusu.contributionAmount.toNumber(),
        frequency: esusu.frequency,
        targetMembers: esusu.numberOfParticipants,
        startDate: esusu.collectionDate,
        availableSlots,
        takenSlots,
      },
    };
  }

  /**
   * Select a slot for FCFS Esusu
   */
  async selectSlot(userId: string, esusuId: string, slotNumber: number) {
    // Get the Esusu
    const esusu = await this.prisma.esusu.findUnique({
      where: { id: esusuId },
    });

    if (!esusu) {
      throw new NotFoundException('Esusu not found');
    }

    // Check if user is a participant
    const participation = await this.prisma.esusuParticipant.findUnique({
      where: {
        esusuId_userId: { esusuId, userId },
      },
    });

    if (!participation) {
      throw new ForbiddenException('You are not a participant in this Esusu');
    }

    // Check if Esusu uses FCFS payout order
    if (esusu.payoutOrderType !== PayoutOrderType.FIRST_COME_FIRST_SERVED) {
      throw new BadRequestException('This Esusu does not use First Come First Served payout order');
    }

    // Check if participant has already accepted the invitation
    // Auto-accept if creator (for backwards compatibility with existing Esusus)
    if (participation.inviteStatus !== EsusuInviteStatus.ACCEPTED) {
      if (participation.isCreator) {
        // Auto-accept the creator
        await this.prisma.esusuParticipant.update({
          where: { id: participation.id },
          data: {
            inviteStatus: EsusuInviteStatus.ACCEPTED,
            respondedAt: new Date(),
          },
        });
      } else {
        throw new BadRequestException('You must accept the invitation before selecting a slot');
      }
    }

    // Check if user already has a slot
    if (participation.slotNumber !== null) {
      throw new BadRequestException(`You have already selected slot ${participation.slotNumber}`);
    }

    // Validate slot number is within range
    if (slotNumber < 1 || slotNumber > esusu.numberOfParticipants) {
      throw new BadRequestException(`Slot number must be between 1 and ${esusu.numberOfParticipants}`);
    }

    // Check if slot is already taken
    const slotTaken = await this.prisma.esusuParticipant.findFirst({
      where: {
        esusuId,
        slotNumber,
      },
    });

    if (slotTaken) {
      throw new BadRequestException(`Slot ${slotNumber} has already been taken`);
    }

    // Assign the slot
    await this.prisma.esusuParticipant.update({
      where: {
        esusuId_userId: { esusuId, userId },
      },
      data: {
        slotNumber,
      },
    });

    // Check if ALL participants have accepted AND selected slots -> update status if needed
    const allParticipants = await this.prisma.esusuParticipant.findMany({
      where: { esusuId },
    });

    // Check if everyone has accepted (no one still INVITED)
    const allAccepted = allParticipants.every(
      (p) => p.inviteStatus === EsusuInviteStatus.ACCEPTED,
    );

    // Check if all accepted participants have selected slots
    const allHaveSlots = allParticipants.every(
      (p) => p.inviteStatus === EsusuInviteStatus.ACCEPTED && p.slotNumber !== null,
    );

    // Only update status and notify if ALL participants have accepted AND selected slots
    if (allAccepted && allHaveSlots && esusu.status === EsusuStatus.PENDING_MEMBERS) {
      // All participants have accepted and selected slots, move to READY_TO_START
      await this.prisma.esusu.update({
        where: { id: esusuId },
        data: { status: EsusuStatus.READY_TO_START },
      });

      // Notify creator
      const creator = await this.prisma.user.findUnique({
        where: { id: esusu.creatorId },
        select: { id: true },
      });

      if (creator) {
        this.notificationsService.sendToUser(
          creator.id,
          'All Slots Selected!',
          `All participants have selected their slots for "${esusu.name}". The Esusu is ready to start!`,
          {
            type: 'esusu_ready',
            esusuId,
            esusuName: esusu.name,
          },
        ).catch((err) => console.error('Failed to send ready notification:', err));

        // In-app notification for all slots selected
        this.notificationsService.createInAppNotification({
          userId: creator.id,
          communityId: esusu.communityId,
          feature: NotificationFeature.ESUSU,
          type: 'esusu_ready',
          title: 'All Slots Selected!',
          message: `All participants have selected their slots for "${esusu.name}". The Esusu is ready to start!`,
          data: { esusuId, esusuName: esusu.name },
        }).catch((err) => console.error('Failed to create in-app notification:', err));
      }
    }

    return {
      success: true,
      message: `You have selected slot ${slotNumber}`,
      data: {
        slotNumber,
      },
    };
  }

  /**
   * Get waiting room details for Admin or Member
   * Admin (creator) can access even if not a participant
   * Members must be participants
   */
  async getWaitingRoomDetails(userId: string, esusuId: string) {
    // Get the Esusu
    const esusu = await this.prisma.esusu.findUnique({
      where: { id: esusuId },
    });

    if (!esusu) {
      throw new NotFoundException('Esusu not found');
    }

    // Check if user is the creator (admin)
    const isCreator = esusu.creatorId === userId;

    // Check if user is a participant
    const participation = await this.prisma.esusuParticipant.findUnique({
      where: {
        esusuId_userId: { esusuId, userId },
      },
    });

    // Must be either creator or participant to access
    if (!isCreator && !participation) {
      throw new ForbiddenException('You are not authorized to view this Esusu');
    }

    // Auto-accept creator if they're a participant but not yet accepted (backwards compatibility)
    if (participation && participation.isCreator && participation.inviteStatus !== EsusuInviteStatus.ACCEPTED) {
      await this.prisma.esusuParticipant.update({
        where: { id: participation.id },
        data: {
          inviteStatus: EsusuInviteStatus.ACCEPTED,
          respondedAt: new Date(),
        },
      });
    }

    // Get all participants with their user details
    const allParticipants = await this.prisma.esusuParticipant.findMany({
      where: { esusuId },
    });

    // Fetch user details for all participants
    const participantUserIds = allParticipants.map((p) => p.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: participantUserIds } },
      select: {
        id: true,
        fullName: true,
        email: true,
        photo: true,
      },
    });

    // Create a map for quick lookup
    const userMap = new Map(users.map((u) => [u.id, u]));

    // Format participants list
    const participants = allParticipants.map((p) => {
      const user = userMap.get(p.userId);
      return {
        id: p.userId,
        fullName: user?.fullName ?? 'Unknown',
        email: user?.email ?? '',
        profileImage: user?.photo,
        inviteStatus: p.inviteStatus,
        slotNumber: p.slotNumber,
        isCreator: p.isCreator,
      };
    });

    // Sort participants: creator first, then by slot number (if assigned), then by name
    participants.sort((a, b) => {
      if (a.isCreator) return -1;
      if (b.isCreator) return 1;
      if (a.slotNumber !== null && b.slotNumber !== null) {
        return a.slotNumber - b.slotNumber;
      }
      if (a.slotNumber !== null) return -1;
      if (b.slotNumber !== null) return 1;
      return a.fullName.localeCompare(b.fullName);
    });

    return {
      success: true,
      data: {
        id: esusu.id,
        name: esusu.name,
        description: esusu.description,
        iconUrl: esusu.iconUrl,
        contributionAmount: esusu.contributionAmount.toNumber(),
        frequency: esusu.frequency,
        targetMembers: esusu.numberOfParticipants,
        startDate: esusu.collectionDate,
        status: esusu.status,
        payoutOrderType: esusu.payoutOrderType,
        participants,
      },
    };
  }

  /**
   * Send reminders to pending participants
   * Only the creator can send reminders
   */
  async remindPendingParticipants(userId: string, esusuId: string) {
    // Get the Esusu
    const esusu = await this.prisma.esusu.findUnique({
      where: { id: esusuId },
    });

    if (!esusu) {
      throw new NotFoundException('Esusu not found');
    }

    // Only creator can send reminders
    if (esusu.creatorId !== userId) {
      throw new ForbiddenException('Only the creator can send reminders');
    }

    // Get community name
    const community = await this.prisma.community.findUnique({
      where: { id: esusu.communityId },
      select: { name: true },
    });
    const communityName = community?.name || 'your community';

    // Get pending participants (those with INVITED status)
    const pendingParticipants = await this.prisma.esusuParticipant.findMany({
      where: {
        esusuId,
        inviteStatus: EsusuInviteStatus.INVITED,
      },
    });

    if (pendingParticipants.length === 0) {
      return {
        success: true,
        message: 'No pending participants to remind',
        data: { remindersSent: 0 },
      };
    }

    // Get user details for pending participants
    const userIds = pendingParticipants.map((p) => p.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    // Get creator name
    const creator = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true },
    });
    const creatorName = creator?.fullName || 'The admin';

    // Format deadline
    const deadline = esusu.participationDeadline.toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    // Send reminders to each pending participant
    let remindersSent = 0;
    for (const participant of pendingParticipants) {
      const user = userMap.get(participant.userId);
      if (!user) continue;

      // Push notification
      this.notificationsService.sendToUser(
        user.id,
        'Esusu Invitation Reminder',
        `${creatorName} is waiting for your response to join "${esusu.name}". Respond before ${deadline}.`,
        {
          type: 'esusu_reminder',
          esusuId,
          esusuName: esusu.name,
          communityName,
        },
      ).catch((err) => console.error('Failed to send reminder push notification:', err));

      // In-app notification for reminder
      this.notificationsService.createInAppNotification({
        userId: user.id,
        communityId: esusu.communityId,
        feature: NotificationFeature.ESUSU,
        type: 'esusu_reminder',
        title: 'Esusu Invitation Reminder',
        message: `${creatorName} is waiting for your response to join "${esusu.name}". Respond before ${deadline}.`,
        data: { esusuId, esusuName: esusu.name, communityName },
      }).catch((err) => console.error('Failed to create in-app notification:', err));

      // Email notification
      if (user.email) {
        this.zeptomailService.sendEmail(
          user.email,
          `Reminder: Respond to Esusu Invitation - ${esusu.name}`,
          `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #8B20E9;">Esusu Invitation Reminder</h2>
              <p>Hi ${user.fullName},</p>
              <p>${creatorName} is waiting for your response to join the Esusu "<strong>${esusu.name}</strong>" in the ${communityName} community.</p>
              <p><strong>Response Deadline:</strong> ${deadline}</p>
              <p>Open the FinSquare app to accept or decline this invitation.</p>
              <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #eee;">
                <p style="color: #666; font-size: 12px;">This is a reminder from FinSquare.</p>
              </div>
            </div>
          `,
        ).catch((err) => console.error('Failed to send reminder email:', err));
      }

      remindersSent++;
    }

    return {
      success: true,
      message: `Reminders sent to ${remindersSent} participant${remindersSent > 1 ? 's' : ''}`,
      data: { remindersSent },
    };
  }
}
