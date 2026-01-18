import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ZeptomailService } from '../../integrations/zeptomail/zeptomail.service';
import { CommunityRole, InviteType, JoinType, JoinRequestStatus } from '@prisma/client';
import { CreateCommunityDto } from './dto/create-community.dto';
import {
  CreateInviteLinkDto,
  CreateEmailInviteDto,
  BulkEmailInviteDto,
  JoinTypeDto,
  UpdateInviteLinkConfigDto,
} from './dto/create-invite.dto';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CommunityService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private zeptomailService: ZeptomailService,
    private configService: ConfigService,
  ) {}

  private sanitizeUser(user: any) {
    const { password, passkey, transactionPin, ...sanitized } = user;
    return sanitized;
  }

  /**
   * Generate a unique invite token
   */
  private generateInviteToken(): string {
    return `CMT-${randomBytes(8).toString('hex').toUpperCase()}`;
  }

  /**
   * Get the base URL for invite links
   */
  private getInviteLinkBaseUrl(): string {
    return (
      this.configService.get<string>('APP_URL') || 'https://finsquare.app'
    );
  }

  /**
   * Notify all admins and co-admins that someone joined their community
   */
  private async notifyAdminsOfNewMember(
    communityId: string,
    communityName: string,
    memberName: string,
    newMemberUserId: string,
  ): Promise<void> {
    // Get all admins and co-admins of the community
    const admins = await this.prisma.membership.findMany({
      where: {
        communityId,
        role: { in: [CommunityRole.ADMIN, CommunityRole.CO_ADMIN] },
      },
      select: { userId: true },
    });

    // Send notification to each admin (except if the new member is somehow an admin)
    for (const admin of admins) {
      if (admin.userId !== newMemberUserId) {
        this.notificationsService.sendToUser(
          admin.userId,
          'New Member Joined! 👋',
          `${memberName} has joined ${communityName}`,
          {
            type: 'member_joined',
            communityId,
            communityName,
            newMemberName: memberName,
            newMemberUserId,
          },
        ).catch((err) => console.error('Failed to send admin notification:', err));
      }
    }
  }

  /**
   * Check if a community name is available
   */
  async checkCommunityNameAvailability(name: string) {
    const trimmedName = name.trim();

    if (trimmedName.length < 3) {
      return {
        success: true,
        available: false,
        message: 'Name must be at least 3 characters',
      };
    }

    // Check for reserved name
    if (trimmedName.toLowerCase().includes('finsquare')) {
      return {
        success: true,
        available: false,
        message: '"FinSquare" is a reserved name',
      };
    }

    const existingCommunity = await this.prisma.community.findFirst({
      where: {
        name: {
          equals: trimmedName,
          mode: 'insensitive', // Case-insensitive check
        },
      },
    });

    return {
      success: true,
      available: !existingCommunity,
    };
  }

  /**
   * Create a new community
   * - User becomes the ADMIN of the community
   * - Deactivates any existing active memberships
   * - Sets hasPickedMembership to true
   * - Generates a default invite link (OPEN type)
   */
  async createCommunity(userId: string, dto: CreateCommunityDto) {
    // Prevent reserved name usage
    if (dto.name.toLowerCase().includes('finsquare')) {
      throw new BadRequestException(
        'Community name cannot contain "FinSquare" - this is a reserved name',
      );
    }

    // Get user info for notifications
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Create community, membership, and default invite link in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create the community
      const community = await tx.community.create({
        data: {
          name: dto.name,
          description: dto.description,
          logo: dto.logo,
          color: dto.color,
          createdById: userId,
          isRegistered: dto.isRegistered || false,
          proofOfAddress: dto.proofOfAddress,
          cacDocument: dto.cacDocument,
          addressVerification: dto.addressVerification,
        },
      });

      // Deactivate any existing active memberships
      await tx.membership.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      });

      // Create membership with ADMIN role
      const membership = await tx.membership.create({
        data: {
          userId,
          communityId: community.id,
          role: CommunityRole.ADMIN,
          isActive: true,
          updatedAt: new Date(),
        },
      });

      // Create a default OPEN invite link
      const inviteToken = this.generateInviteToken();
      const inviteLink = await tx.communityInvite.create({
        data: {
          communityId: community.id,
          type: InviteType.LINK,
          joinType: JoinType.OPEN,
          token: inviteToken,
          isActive: true,
        },
      });

      // Update user's hasPickedMembership flag
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { hasPickedMembership: true },
      });

      return { community, membership, inviteLink, user: updatedUser };
    });

    const inviteLinkUrl = `${this.getInviteLinkBaseUrl()}/invite/${result.inviteLink.token}`;

    // Send welcome push notification (non-blocking)
    this.notificationsService.sendToUser(
      userId,
      'Community Created! 🎉',
      `You've successfully created "${result.community.name}". Start inviting members to grow your community!`,
      {
        type: 'community_created',
        communityId: result.community.id,
        communityName: result.community.name,
      },
    ).catch((err) => {
      // Log but don't fail the request
      console.error('Failed to send push notification:', err);
    });

    // Send congratulations email to creator (non-blocking)
    if (user.email) {
      this.zeptomailService.sendCommunityCreated(
        user.email,
        result.community.name,
        user.fullName,
        inviteLinkUrl,
      ).catch((err) => {
        // Log but don't fail the request
        console.error('Failed to send community created email:', err);
      });
    }

    return {
      success: true,
      message: 'Community created successfully',
      data: {
        community: {
          id: result.community.id,
          name: result.community.name,
          description: result.community.description,
          logo: result.community.logo,
          color: result.community.color,
          isRegistered: result.community.isRegistered,
        },
        membership: {
          role: result.membership.role,
        },
        inviteLink: inviteLinkUrl,
        user: this.sanitizeUser(result.user),
      },
    };
  }

  /**
   * Create a shareable invite link for a community
   * - Only ADMIN and CO_ADMIN can create invite links
   */
  async createInviteLink(
    userId: string,
    communityId: string,
    dto: CreateInviteLinkDto,
  ) {
    // Verify user is admin or co-admin of the community
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_communityId: { userId, communityId },
      },
      include: { community: true },
    });

    if (!membership) {
      throw new NotFoundException('Community not found or you are not a member');
    }

    if (
      membership.role !== CommunityRole.ADMIN &&
      membership.role !== CommunityRole.CO_ADMIN
    ) {
      throw new ForbiddenException('Only admins can create invite links');
    }

    const inviteToken = this.generateInviteToken();

    const invite = await this.prisma.communityInvite.create({
      data: {
        communityId,
        type: InviteType.LINK,
        joinType: dto.joinType === JoinTypeDto.APPROVAL_REQUIRED
          ? JoinType.APPROVAL_REQUIRED
          : JoinType.OPEN,
        maxMembers: dto.maxMembers,
        token: inviteToken,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        isActive: true,
      },
    });

    const inviteLinkUrl = `${this.getInviteLinkBaseUrl()}/invite/${invite.token}`;

    return {
      success: true,
      message: 'Invite link created successfully',
      data: {
        inviteLink: inviteLinkUrl,
        token: invite.token,
        joinType: invite.joinType,
        maxMembers: invite.maxMembers,
        expiresAt: invite.expiresAt,
      },
    };
  }

  /**
   * Get the default invite link for a community
   */
  async getDefaultInviteLink(userId: string, communityId: string) {
    // Verify user is a member of the community
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_communityId: { userId, communityId },
      },
      include: { community: true },
    });

    if (!membership) {
      throw new NotFoundException('Community not found or you are not a member');
    }

    // Only admin and co-admin can get invite links
    if (
      membership.role !== CommunityRole.ADMIN &&
      membership.role !== CommunityRole.CO_ADMIN
    ) {
      throw new ForbiddenException('Only admins can access invite links');
    }

    // Find the default (first created) active LINK invite
    let invite = await this.prisma.communityInvite.findFirst({
      where: {
        communityId,
        type: InviteType.LINK,
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // If no invite link exists, create one
    if (!invite) {
      const inviteToken = this.generateInviteToken();
      invite = await this.prisma.communityInvite.create({
        data: {
          communityId,
          type: InviteType.LINK,
          joinType: JoinType.OPEN,
          token: inviteToken,
          isActive: true,
        },
      });
    }

    const inviteLinkUrl = `${this.getInviteLinkBaseUrl()}/invite/${invite.token}`;

    return {
      success: true,
      message: 'Invite link retrieved',
      data: {
        inviteLink: inviteLinkUrl,
        token: invite.token,
        joinType: invite.joinType,
        maxMembers: invite.maxMembers,
        usedCount: invite.usedCount,
        expiresAt: invite.expiresAt,
        communityName: membership.community.name,
      },
    };
  }

  /**
   * Send email invites to specific people
   * - Only ADMIN and CO_ADMIN can send invites
   */
  async sendEmailInvites(
    userId: string,
    communityId: string,
    dto: BulkEmailInviteDto,
  ) {
    // Verify user is admin or co-admin
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_communityId: { userId, communityId },
      },
      include: {
        community: true,
        user: true,
      },
    });

    if (!membership) {
      throw new NotFoundException('Community not found or you are not a member');
    }

    if (
      membership.role !== CommunityRole.ADMIN &&
      membership.role !== CommunityRole.CO_ADMIN
    ) {
      throw new ForbiddenException('Only admins can send invites');
    }

    const results: Array<{
      email: string;
      success: boolean;
      message: string;
    }> = [];

    for (const invite of dto.invites) {
      try {
        // Check if email is already a member
        const existingUser = await this.prisma.user.findUnique({
          where: { email: invite.email },
          include: {
            memberships: {
              where: { communityId },
            },
          },
        });

        if (existingUser && existingUser.memberships.length > 0) {
          results.push({
            email: invite.email,
            success: false,
            message: 'Already a member of this community',
          });
          continue;
        }

        // Check if there's already a pending invite for this email
        const existingInvite = await this.prisma.communityInvite.findFirst({
          where: {
            communityId,
            email: invite.email,
            type: InviteType.EMAIL,
            isActive: true,
          },
        });

        let inviteToken: string;

        if (existingInvite) {
          // Use existing invite token
          inviteToken = existingInvite.token;
        } else {
          // Create new email invite
          inviteToken = this.generateInviteToken();
          await this.prisma.communityInvite.create({
            data: {
              communityId,
              type: InviteType.EMAIL,
              email: invite.email,
              token: inviteToken,
              isActive: true,
            },
          });
        }

        // Send invite email
        const inviteLinkUrl = `${this.getInviteLinkBaseUrl()}/invite/${inviteToken}`;
        const emailSent = await this.zeptomailService.sendCommunityInvite(
          invite.email,
          membership.user.fullName,
          membership.community.name,
          inviteLinkUrl,
          invite.name,
        );

        results.push({
          email: invite.email,
          success: emailSent,
          message: emailSent ? 'Invite sent successfully' : 'Failed to send email',
        });
      } catch (error) {
        results.push({
          email: invite.email,
          success: false,
          message: error.message || 'Failed to process invite',
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return {
      success: true,
      message: `Sent ${successCount} invite(s), ${failCount} failed`,
      data: {
        results,
        summary: {
          total: dto.invites.length,
          sent: successCount,
          failed: failCount,
        },
      },
    };
  }

  /**
   * Join the default FinSquare Community
   * - Used when user selects "Individual Membership" option
   * - Creates membership record with MEMBER role
   * - Sets hasPickedMembership to true
   * - Sets this community as active
   */
  async joinDefaultCommunity(userId: string) {
    // Get the default FinSquare community
    const defaultCommunity = await this.prisma.community.findFirst({
      where: { isDefault: true },
    });

    if (!defaultCommunity) {
      throw new NotFoundException(
        'Default community not found. Please contact support.',
      );
    }

    // Check if user already has a membership in this community
    const existingMembership = await this.prisma.membership.findUnique({
      where: {
        userId_communityId: {
          userId,
          communityId: defaultCommunity.id,
        },
      },
    });

    if (existingMembership) {
      throw new BadRequestException(
        'You are already a member of this community',
      );
    }

    // Create membership and update user in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Deactivate any existing active memberships
      await tx.membership.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      });

      // Create new membership
      const membership = await tx.membership.create({
        data: {
          userId,
          communityId: defaultCommunity.id,
          role: CommunityRole.MEMBER,
          isActive: true,
          updatedAt: new Date(),
        },
        include: {
          community: true,
        },
      });

      // Update user's hasPickedMembership flag
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { hasPickedMembership: true },
      });

      return { membership, user: updatedUser };
    });

    // Send welcome push notification
    await this.notificationsService.sendToUser(
      userId,
      'Welcome to FinSquare! 🎉',
      `You've successfully joined the FinSquare Community. Start exploring community financing, credit access, and exclusive discounts!`,
      {
        type: 'community_joined',
        communityId: defaultCommunity.id,
        communityName: defaultCommunity.name,
      },
    );

    return {
      success: true,
      message: 'Welcome to FinSquare Community!',
      data: {
        user: this.sanitizeUser(result.user),
        activeCommunity: {
          id: defaultCommunity.id,
          name: defaultCommunity.name,
          role: result.membership.role,
          description: defaultCommunity.description,
          logo: defaultCommunity.logo,
          color: defaultCommunity.color,
        },
      },
    };
  }

  /**
   * Get user's active community
   */
  async getActiveCommunity(userId: string) {
    const activeMembership = await this.prisma.membership.findFirst({
      where: { userId, isActive: true },
      include: { community: true },
    });

    if (!activeMembership) {
      return {
        success: true,
        message: 'No active community',
        data: null,
      };
    }

    return {
      success: true,
      message: 'Active community retrieved',
      data: {
        id: activeMembership.community.id,
        name: activeMembership.community.name,
        description: activeMembership.community.description,
        logo: activeMembership.community.logo,
        color: activeMembership.community.color,
        role: activeMembership.role,
        joinedAt: activeMembership.joinedAt,
      },
    };
  }

  /**
   * Get all communities a user belongs to
   */
  async getUserCommunities(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: { community: true },
      orderBy: { joinedAt: 'desc' },
    });

    return {
      success: true,
      message: 'Communities retrieved',
      data: memberships.map((m) => ({
        id: m.community.id,
        name: m.community.name,
        description: m.community.description,
        logo: m.community.logo,
        color: m.community.color,
        role: m.role,
        isActive: m.isActive,
        isDefault: m.community.isDefault,
        joinedAt: m.joinedAt,
      })),
    };
  }

  // =====================================================
  // INVITE LINK CONFIGURATION (Admin)
  // =====================================================

  /**
   * Get the current invite link configuration for a community
   */
  async getInviteLinkConfig(userId: string, communityId: string) {
    // Verify user is admin or co-admin
    const membership = await this.prisma.membership.findUnique({
      where: { userId_communityId: { userId, communityId } },
      include: { community: true },
    });

    if (!membership) {
      throw new NotFoundException('Community not found or you are not a member');
    }

    if (
      membership.role !== CommunityRole.ADMIN &&
      membership.role !== CommunityRole.CO_ADMIN
    ) {
      throw new ForbiddenException('Only admins can access invite settings');
    }

    // Get the active LINK invite (there should only be one)
    const invite = await this.prisma.communityInvite.findFirst({
      where: {
        communityId,
        type: InviteType.LINK,
        isActive: true,
      },
    });

    if (!invite) {
      // Create a default invite link if none exists
      const token = this.generateInviteToken();
      const newInvite = await this.prisma.communityInvite.create({
        data: {
          communityId,
          type: InviteType.LINK,
          joinType: JoinType.OPEN,
          token,
          isActive: true,
        },
      });

      return {
        success: true,
        message: 'Invite link configuration retrieved',
        data: {
          inviteLink: `${this.getInviteLinkBaseUrl()}/invite/${newInvite.token}`,
          token: newInvite.token,
          joinType: newInvite.joinType,
          expiresAt: newInvite.expiresAt,
          usedCount: newInvite.usedCount,
          communityName: membership.community.name,
        },
      };
    }

    return {
      success: true,
      message: 'Invite link configuration retrieved',
      data: {
        inviteLink: `${this.getInviteLinkBaseUrl()}/invite/${invite.token}`,
        token: invite.token,
        joinType: invite.joinType,
        expiresAt: invite.expiresAt,
        usedCount: invite.usedCount,
        communityName: membership.community.name,
      },
    };
  }

  /**
   * Update the invite link configuration (joinType, expiresAt)
   */
  async updateInviteLinkConfig(
    userId: string,
    communityId: string,
    dto: UpdateInviteLinkConfigDto,
  ) {
    // Verify user is admin or co-admin
    const membership = await this.prisma.membership.findUnique({
      where: { userId_communityId: { userId, communityId } },
    });

    if (!membership) {
      throw new NotFoundException('Community not found or you are not a member');
    }

    if (
      membership.role !== CommunityRole.ADMIN &&
      membership.role !== CommunityRole.CO_ADMIN
    ) {
      throw new ForbiddenException('Only admins can update invite settings');
    }

    // Get the active LINK invite
    let invite = await this.prisma.communityInvite.findFirst({
      where: {
        communityId,
        type: InviteType.LINK,
        isActive: true,
      },
    });

    if (!invite) {
      // Create a new invite link with the settings
      const token = this.generateInviteToken();
      invite = await this.prisma.communityInvite.create({
        data: {
          communityId,
          type: InviteType.LINK,
          joinType: dto.joinType === JoinTypeDto.APPROVAL_REQUIRED
            ? JoinType.APPROVAL_REQUIRED
            : JoinType.OPEN,
          token,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          isActive: true,
        },
      });
    } else {
      // Update existing invite
      invite = await this.prisma.communityInvite.update({
        where: { id: invite.id },
        data: {
          joinType: dto.joinType === JoinTypeDto.APPROVAL_REQUIRED
            ? JoinType.APPROVAL_REQUIRED
            : JoinType.OPEN,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        },
      });
    }

    return {
      success: true,
      message: 'Invite link configuration updated',
      data: {
        inviteLink: `${this.getInviteLinkBaseUrl()}/invite/${invite.token}`,
        token: invite.token,
        joinType: invite.joinType,
        expiresAt: invite.expiresAt,
      },
    };
  }

  /**
   * Regenerate the invite link (deactivates the old one)
   */
  async regenerateInviteLink(userId: string, communityId: string) {
    // Verify user is admin or co-admin
    const membership = await this.prisma.membership.findUnique({
      where: { userId_communityId: { userId, communityId } },
    });

    if (!membership) {
      throw new NotFoundException('Community not found or you are not a member');
    }

    if (
      membership.role !== CommunityRole.ADMIN &&
      membership.role !== CommunityRole.CO_ADMIN
    ) {
      throw new ForbiddenException('Only admins can regenerate invite links');
    }

    // Get the current active invite to preserve settings
    const currentInvite = await this.prisma.communityInvite.findFirst({
      where: {
        communityId,
        type: InviteType.LINK,
        isActive: true,
      },
    });

    // Deactivate all existing LINK invites and create new one in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Deactivate all existing LINK invites
      await tx.communityInvite.updateMany({
        where: {
          communityId,
          type: InviteType.LINK,
          isActive: true,
        },
        data: { isActive: false },
      });

      // Create new invite with same settings
      const token = this.generateInviteToken();
      const newInvite = await tx.communityInvite.create({
        data: {
          communityId,
          type: InviteType.LINK,
          joinType: currentInvite?.joinType || JoinType.OPEN,
          expiresAt: currentInvite?.expiresAt || null,
          token,
          isActive: true,
        },
      });

      return newInvite;
    });

    return {
      success: true,
      message: 'Invite link regenerated. Previous link is now invalid.',
      data: {
        inviteLink: `${this.getInviteLinkBaseUrl()}/invite/${result.token}`,
        token: result.token,
        joinType: result.joinType,
        expiresAt: result.expiresAt,
      },
    };
  }

  // =====================================================
  // JOIN VIA INVITE LINK (Public/Any user)
  // =====================================================

  /**
   * Get invite details by token (public - for showing join modal)
   */
  async getInviteDetails(token: string) {
    const invite = await this.prisma.communityInvite.findUnique({
      where: { token },
      include: {
        community: {
          select: {
            id: true,
            name: true,
            description: true,
            logo: true,
            color: true,
          },
        },
      },
    });

    if (!invite) {
      throw new NotFoundException('Invalid or expired invite link');
    }

    if (!invite.isActive) {
      throw new BadRequestException('This invite link is no longer active');
    }

    // Check if expired
    if (invite.expiresAt && new Date() > invite.expiresAt) {
      throw new BadRequestException('This invite link has expired');
    }

    // Check max members
    if (invite.maxMembers && invite.usedCount >= invite.maxMembers) {
      throw new BadRequestException('This invite link has reached its maximum capacity');
    }

    return {
      success: true,
      message: 'Invite details retrieved',
      data: {
        community: invite.community,
        joinType: invite.joinType,
        expiresAt: invite.expiresAt,
      },
    };
  }

  /**
   * Join community via invite link
   */
  async joinViaInviteLink(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const invite = await this.prisma.communityInvite.findUnique({
      where: { token },
      include: { community: true },
    });

    if (!invite) {
      throw new NotFoundException('Invalid or expired invite link');
    }

    if (!invite.isActive) {
      throw new BadRequestException('This invite link is no longer active');
    }

    // Check if expired
    if (invite.expiresAt && new Date() > invite.expiresAt) {
      throw new BadRequestException('This invite link has expired');
    }

    // Check max members
    if (invite.maxMembers && invite.usedCount >= invite.maxMembers) {
      throw new BadRequestException('This invite link has reached its maximum capacity');
    }

    // Check if user is already a member
    const existingMembership = await this.prisma.membership.findUnique({
      where: { userId_communityId: { userId, communityId: invite.communityId } },
    });

    if (existingMembership) {
      throw new BadRequestException('You are already a member of this community');
    }

    // Check if user already has a pending request
    const existingRequest = await this.prisma.joinRequest.findUnique({
      where: { userId_communityId: { userId, communityId: invite.communityId } },
    });

    if (existingRequest) {
      if (existingRequest.status === JoinRequestStatus.PENDING) {
        throw new BadRequestException('You already have a pending join request for this community');
      }
      if (existingRequest.status === JoinRequestStatus.REJECTED) {
        throw new BadRequestException('Your previous join request was rejected');
      }
    }

    // If OPEN, join directly
    if (invite.joinType === JoinType.OPEN) {
      const result = await this.prisma.$transaction(async (tx) => {
        // Deactivate any existing active memberships
        await tx.membership.updateMany({
          where: { userId, isActive: true },
          data: { isActive: false },
        });

        // Create membership
        const membership = await tx.membership.create({
          data: {
            userId,
            communityId: invite.communityId,
            role: CommunityRole.MEMBER,
            isActive: true,
            updatedAt: new Date(),
          },
        });

        // Increment used count
        await tx.communityInvite.update({
          where: { id: invite.id },
          data: { usedCount: { increment: 1 } },
        });

        // Update user's hasPickedMembership
        await tx.user.update({
          where: { id: userId },
          data: { hasPickedMembership: true },
        });

        return membership;
      });

      // Send welcome notification to the new member
      this.notificationsService.sendToUser(
        userId,
        'Welcome! 🎉',
        `You've successfully joined ${invite.community.name}!`,
        {
          type: 'community_joined',
          communityId: invite.communityId,
          communityName: invite.community.name,
        },
      ).catch((err) => console.error('Failed to send notification:', err));

      // Notify admins that someone joined their community
      this.notifyAdminsOfNewMember(
        invite.communityId,
        invite.community.name,
        user.fullName,
        userId,
      ).catch((err) => console.error('Failed to send admin notification:', err));

      return {
        success: true,
        message: `Welcome to ${invite.community.name}!`,
        data: {
          resultType: 'JOINED',
          community: {
            id: invite.community.id,
            name: invite.community.name,
            description: invite.community.description,
            logo: invite.community.logo,
            color: invite.community.color,
            role: result.role,
          },
        },
      };
    }

    // If APPROVAL_REQUIRED, create join request
    const joinRequest = await this.prisma.joinRequest.create({
      data: {
        userId,
        communityId: invite.communityId,
        inviteId: invite.id,
        status: JoinRequestStatus.PENDING,
      },
    });

    // Notify admins about the join request
    const admins = await this.prisma.membership.findMany({
      where: {
        communityId: invite.communityId,
        role: { in: [CommunityRole.ADMIN, CommunityRole.CO_ADMIN] },
      },
      include: { user: true },
    });

    for (const admin of admins) {
      this.notificationsService.sendToUser(
        admin.userId,
        'New Join Request',
        `${user.fullName} wants to join ${invite.community.name}`,
        {
          type: 'join_request',
          communityId: invite.communityId,
          requestId: joinRequest.id,
          userName: user.fullName,
        },
      ).catch((err) => console.error('Failed to send notification:', err));
    }

    return {
      success: true,
      message: 'Your request to join has been submitted. An admin will review it shortly.',
      data: {
        resultType: 'PENDING_APPROVAL',
        community: {
          id: invite.community.id,
          name: invite.community.name,
          description: invite.community.description,
          logo: invite.community.logo,
          color: invite.community.color,
        },
        requestId: joinRequest.id,
      },
    };
  }

  // =====================================================
  // JOIN REQUEST MANAGEMENT (Admin)
  // =====================================================

  /**
   * Get all join requests for a community
   */
  async getJoinRequests(userId: string, communityId: string, status?: string) {
    // Verify user is admin or co-admin
    const membership = await this.prisma.membership.findUnique({
      where: { userId_communityId: { userId, communityId } },
      include: { community: true },
    });

    if (!membership) {
      throw new NotFoundException('Community not found or you are not a member');
    }

    if (
      membership.role !== CommunityRole.ADMIN &&
      membership.role !== CommunityRole.CO_ADMIN
    ) {
      throw new ForbiddenException('Only admins can view join requests');
    }

    const whereClause: any = { communityId };
    if (status) {
      whereClause.status = status as JoinRequestStatus;
    }

    const requests = await this.prisma.joinRequest.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      message: 'Join requests retrieved',
      data: {
        communityName: membership.community.name,
        requests: requests.map((r) => ({
          id: r.id,
          user: r.user,
          status: r.status,
          createdAt: r.createdAt,
          respondedAt: r.respondedAt,
        })),
        counts: {
          pending: requests.filter((r) => r.status === JoinRequestStatus.PENDING).length,
          approved: requests.filter((r) => r.status === JoinRequestStatus.APPROVED).length,
          rejected: requests.filter((r) => r.status === JoinRequestStatus.REJECTED).length,
        },
      },
    };
  }

  /**
   * Approve a join request
   */
  async approveJoinRequest(adminUserId: string, requestId: string) {
    const joinRequest = await this.prisma.joinRequest.findUnique({
      where: { id: requestId },
      include: {
        user: true,
        community: true,
      },
    });

    if (!joinRequest) {
      throw new NotFoundException('Join request not found');
    }

    // Verify admin is admin or co-admin of the community
    const adminMembership = await this.prisma.membership.findUnique({
      where: { userId_communityId: { userId: adminUserId, communityId: joinRequest.communityId } },
    });

    if (!adminMembership) {
      throw new ForbiddenException('You are not a member of this community');
    }

    if (
      adminMembership.role !== CommunityRole.ADMIN &&
      adminMembership.role !== CommunityRole.CO_ADMIN
    ) {
      throw new ForbiddenException('Only admins can approve join requests');
    }

    if (joinRequest.status !== JoinRequestStatus.PENDING) {
      throw new BadRequestException('This request has already been processed');
    }

    // Approve and create membership in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Update request status
      const updatedRequest = await tx.joinRequest.update({
        where: { id: requestId },
        data: {
          status: JoinRequestStatus.APPROVED,
          respondedBy: adminUserId,
          respondedAt: new Date(),
        },
      });

      // Deactivate any existing active memberships for the user
      await tx.membership.updateMany({
        where: { userId: joinRequest.userId, isActive: true },
        data: { isActive: false },
      });

      // Create membership
      const membership = await tx.membership.create({
        data: {
          userId: joinRequest.userId,
          communityId: joinRequest.communityId,
          role: CommunityRole.MEMBER,
          isActive: true,
          updatedAt: new Date(),
        },
      });

      // Update user's hasPickedMembership
      await tx.user.update({
        where: { id: joinRequest.userId },
        data: { hasPickedMembership: true },
      });

      // Increment invite used count if invite exists
      if (joinRequest.inviteId) {
        await tx.communityInvite.update({
          where: { id: joinRequest.inviteId },
          data: { usedCount: { increment: 1 } },
        });
      }

      return { updatedRequest, membership };
    });

    // Send notification to user
    this.notificationsService.sendToUser(
      joinRequest.userId,
      'Request Approved! 🎉',
      `Your request to join ${joinRequest.community.name} has been approved!`,
      {
        type: 'join_request_approved',
        communityId: joinRequest.communityId,
        communityName: joinRequest.community.name,
      },
    ).catch((err) => console.error('Failed to send notification:', err));

    // Notify other admins that someone was approved
    this.notifyAdminsOfNewMember(
      joinRequest.communityId,
      joinRequest.community.name,
      joinRequest.user.fullName,
      joinRequest.userId,
    ).catch((err) => console.error('Failed to send admin notification:', err));

    return {
      success: true,
      message: `${joinRequest.user.fullName} has been approved and added to the community`,
      data: {
        requestId,
        status: 'APPROVED',
        user: {
          id: joinRequest.user.id,
          fullName: joinRequest.user.fullName,
        },
      },
    };
  }

  /**
   * Reject a join request
   */
  async rejectJoinRequest(adminUserId: string, requestId: string) {
    const joinRequest = await this.prisma.joinRequest.findUnique({
      where: { id: requestId },
      include: {
        user: true,
        community: true,
      },
    });

    if (!joinRequest) {
      throw new NotFoundException('Join request not found');
    }

    // Verify admin is admin or co-admin of the community
    const adminMembership = await this.prisma.membership.findUnique({
      where: { userId_communityId: { userId: adminUserId, communityId: joinRequest.communityId } },
    });

    if (!adminMembership) {
      throw new ForbiddenException('You are not a member of this community');
    }

    if (
      adminMembership.role !== CommunityRole.ADMIN &&
      adminMembership.role !== CommunityRole.CO_ADMIN
    ) {
      throw new ForbiddenException('Only admins can reject join requests');
    }

    if (joinRequest.status !== JoinRequestStatus.PENDING) {
      throw new BadRequestException('This request has already been processed');
    }

    // Update request status
    await this.prisma.joinRequest.update({
      where: { id: requestId },
      data: {
        status: JoinRequestStatus.REJECTED,
        respondedBy: adminUserId,
        respondedAt: new Date(),
      },
    });

    // Send notification to user
    this.notificationsService.sendToUser(
      joinRequest.userId,
      'Request Update',
      `Your request to join ${joinRequest.community.name} was not approved.`,
      {
        type: 'join_request_rejected',
        communityId: joinRequest.communityId,
        communityName: joinRequest.community.name,
      },
    ).catch((err) => console.error('Failed to send notification:', err));

    return {
      success: true,
      message: `Join request from ${joinRequest.user.fullName} has been rejected`,
      data: {
        requestId,
        status: 'REJECTED',
        user: {
          id: joinRequest.user.id,
          fullName: joinRequest.user.fullName,
        },
      },
    };
  }

  /**
   * Get user's pending join request for a community (if any)
   */
  async getUserJoinRequestStatus(userId: string, communityId: string) {
    const request = await this.prisma.joinRequest.findUnique({
      where: { userId_communityId: { userId, communityId } },
      include: { community: true },
    });

    if (!request) {
      return {
        success: true,
        message: 'No join request found',
        data: null,
      };
    }

    return {
      success: true,
      message: 'Join request status retrieved',
      data: {
        id: request.id,
        status: request.status,
        communityName: request.community.name,
        createdAt: request.createdAt,
        respondedAt: request.respondedAt,
      },
    };
  }

  /**
   * Get all members of a community
   * Only admins and co-admins can view the member list
   */
  async getCommunityMembers(userId: string, communityId: string) {
    // Verify user is admin or co-admin
    const membership = await this.prisma.membership.findUnique({
      where: { userId_communityId: { userId, communityId } },
      include: { community: true },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this community');
    }

    if (
      membership.role !== CommunityRole.ADMIN &&
      membership.role !== CommunityRole.CO_ADMIN
    ) {
      throw new ForbiddenException('Only admins can view the member list');
    }

    // Get all members
    const members = await this.prisma.membership.findMany({
      where: { communityId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            fullName: true,
            phoneNumber: true,
            createdAt: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' }, // ADMIN first, then CO_ADMIN, then MEMBER
        { joinedAt: 'asc' },
      ],
    });

    return {
      success: true,
      message: 'Community members retrieved',
      data: {
        communityId,
        communityName: membership.community.name,
        totalMembers: members.length,
        members: members.map((m) => ({
          id: m.id,
          role: m.role,
          joinedAt: m.joinedAt,
          isActive: m.isActive,
          user: {
            id: m.user.id,
            email: m.user.email,
            firstName: m.user.firstName,
            lastName: m.user.lastName,
            fullName: m.user.fullName,
            phoneNumber: m.user.phoneNumber,
            createdAt: m.user.createdAt,
          },
        })),
      },
    };
  }

  /**
   * Get community wallet details
   * Only Admin and Co-Admin can view the community wallet
   */
  async getCommunityWallet(userId: string, communityId: string) {
    // Check membership and role
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

    // Only Admin and Co-Admin can view community wallet
    if (
      membership.role !== CommunityRole.ADMIN &&
      membership.role !== CommunityRole.CO_ADMIN
    ) {
      throw new ForbiddenException('Only admins can view the community wallet');
    }

    // Default FinSquare Community has no wallet
    if (membership.community.isDefault) {
      return {
        success: true,
        message: 'Default community does not have a wallet',
        data: {
          communityId,
          communityName: membership.community.name,
          hasWallet: false,
          isDefault: true,
          wallet: null,
        },
      };
    }

    // Check if community wallet exists
    const communityWallet = await this.prisma.community_wallets.findUnique({
      where: { communityId },
    });

    if (!communityWallet) {
      return {
        success: true,
        message: 'Community wallet not created yet',
        data: {
          communityId,
          communityName: membership.community.name,
          hasWallet: false,
          isDefault: false,
          wallet: null,
          canCreate: membership.role === CommunityRole.ADMIN, // Only Admin can create
        },
      };
    }

    // Return wallet details
    return {
      success: true,
      message: 'Community wallet retrieved',
      data: {
        communityId,
        communityName: membership.community.name,
        hasWallet: true,
        isDefault: false,
        wallet: {
          id: communityWallet.id,
          balance: communityWallet.balance.toString(),
          signatories: communityWallet.signatories,
          externalWalletId: communityWallet.externalWalletId,
          isActive: communityWallet.isActive,
          createdAt: communityWallet.createdAt,
          updatedAt: communityWallet.updatedAt,
        },
        canWithdraw: membership.role === CommunityRole.ADMIN, // Only Admin can withdraw
      },
    };
  }
}
