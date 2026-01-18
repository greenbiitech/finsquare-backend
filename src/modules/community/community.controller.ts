import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { CommunityService } from './community.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateCommunityDto } from './dto/create-community.dto';
import {
  CreateInviteLinkDto,
  BulkEmailInviteDto,
  UpdateInviteLinkConfigDto,
} from './dto/create-invite.dto';
import { CreateCommunityWalletDto } from './dto/create-community-wallet.dto';

@ApiTags('Communities')
@Controller('api/v1/communities')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new community',
    description:
      'Create a new community. The user becomes the ADMIN and a default invite link is generated.',
  })
  @ApiResponse({
    status: 201,
    description: 'Community created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createCommunity(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateCommunityDto,
  ) {
    return this.communityService.createCommunity(user.userId, dto);
  }

  @Post('join-default')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Join default FinSquare Community',
    description:
      'Join the default FinSquare community as an individual member. Used when user selects "Individual Membership" option.',
  })
  @ApiResponse({
    status: 201,
    description: 'Successfully joined FinSquare Community',
  })
  @ApiResponse({ status: 400, description: 'Already a member' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Default community not found' })
  async joinDefaultCommunity(@CurrentUser() user: { userId: string }) {
    return this.communityService.joinDefaultCommunity(user.userId);
  }

  @Get('check-name/:name')
  @ApiOperation({
    summary: 'Check community name availability',
    description: 'Check if a community name is available or already taken',
  })
  @ApiParam({ name: 'name', description: 'Community name to check' })
  @ApiResponse({
    status: 200,
    description: 'Name availability checked',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        available: { type: 'boolean' },
      },
    },
  })
  async checkCommunityName(@Param('name') name: string) {
    return this.communityService.checkCommunityNameAvailability(name);
  }

  @Get('active')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get active community',
    description: "Get the user's currently active community",
  })
  @ApiResponse({ status: 200, description: 'Active community retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getActiveCommunity(@CurrentUser() user: { userId: string }) {
    return this.communityService.getActiveCommunity(user.userId);
  }

  @Get('my-communities')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get user communities',
    description: 'Get all communities the user belongs to',
  })
  @ApiResponse({ status: 200, description: 'Communities retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserCommunities(@CurrentUser() user: { userId: string }) {
    return this.communityService.getUserCommunities(user.userId);
  }

  @Get(':communityId/members')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get community members',
    description: 'Get all members of a community. Only admins and co-admins can access.',
  })
  @ApiParam({ name: 'communityId', description: 'Community ID' })
  @ApiResponse({ status: 200, description: 'Members retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not an admin' })
  @ApiResponse({ status: 404, description: 'Community not found' })
  async getCommunityMembers(
    @CurrentUser() user: { userId: string },
    @Param('communityId') communityId: string,
  ) {
    return this.communityService.getCommunityMembers(user.userId, communityId);
  }

  @Get(':communityId/wallet')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get community wallet',
    description: 'Get the community wallet details. Only admins and co-admins can access.',
  })
  @ApiParam({ name: 'communityId', description: 'Community ID' })
  @ApiResponse({ status: 200, description: 'Community wallet retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not an admin or co-admin' })
  async getCommunityWallet(
    @CurrentUser() user: { userId: string },
    @Param('communityId') communityId: string,
  ) {
    return this.communityService.getCommunityWallet(user.userId, communityId);
  }

  @Get(':communityId/co-admins')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get community Co-Admins',
    description: 'Get list of Co-Admins for signatory selection. Only Admin can access.',
  })
  @ApiParam({ name: 'communityId', description: 'Community ID' })
  @ApiResponse({ status: 200, description: 'Co-Admins retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not an admin' })
  async getCoAdmins(
    @CurrentUser() user: { userId: string },
    @Param('communityId') communityId: string,
  ) {
    return this.communityService.getCoAdmins(user.userId, communityId);
  }

  @Get(':communityId/wallet-eligibility')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Check wallet creation eligibility',
    description: 'Check if Admin can create a community wallet. Requires personal wallet and 2+ Co-Admins.',
  })
  @ApiParam({ name: 'communityId', description: 'Community ID' })
  @ApiResponse({ status: 200, description: 'Eligibility checked' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not an admin' })
  async checkWalletEligibility(
    @CurrentUser() user: { userId: string },
    @Param('communityId') communityId: string,
  ) {
    return this.communityService.checkWalletEligibility(user.userId, communityId);
  }

  @Post(':communityId/wallet')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create community wallet',
    description: 'Create a community wallet with signatories, approval rules, and transaction PIN. Only Admin can create.',
  })
  @ApiParam({ name: 'communityId', description: 'Community ID' })
  @ApiResponse({ status: 201, description: 'Community wallet created' })
  @ApiResponse({ status: 400, description: 'Bad request - wallet exists or not eligible' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not an admin' })
  async createCommunityWallet(
    @CurrentUser() user: { userId: string },
    @Param('communityId') communityId: string,
    @Body() dto: CreateCommunityWalletDto,
  ) {
    return this.communityService.createCommunityWallet(user.userId, communityId, dto);
  }

  @Get(':communityId/invite-link')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get default invite link',
    description:
      'Get the default shareable invite link for a community. Only admins and co-admins can access.',
  })
  @ApiParam({ name: 'communityId', description: 'Community ID' })
  @ApiResponse({ status: 200, description: 'Invite link retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not an admin' })
  @ApiResponse({ status: 404, description: 'Community not found' })
  async getDefaultInviteLink(
    @CurrentUser() user: { userId: string },
    @Param('communityId') communityId: string,
  ) {
    return this.communityService.getDefaultInviteLink(user.userId, communityId);
  }

  @Post(':communityId/invite-links')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new invite link',
    description:
      'Create a new shareable invite link with custom settings. Only admins and co-admins can create.',
  })
  @ApiParam({ name: 'communityId', description: 'Community ID' })
  @ApiResponse({ status: 201, description: 'Invite link created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not an admin' })
  @ApiResponse({ status: 404, description: 'Community not found' })
  async createInviteLink(
    @CurrentUser() user: { userId: string },
    @Param('communityId') communityId: string,
    @Body() dto: CreateInviteLinkDto,
  ) {
    return this.communityService.createInviteLink(
      user.userId,
      communityId,
      dto,
    );
  }

  @Post(':communityId/invites/email')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Send email invites',
    description:
      'Send email invites to specific people. Only admins and co-admins can send invites.',
  })
  @ApiParam({ name: 'communityId', description: 'Community ID' })
  @ApiResponse({ status: 201, description: 'Invites sent' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not an admin' })
  @ApiResponse({ status: 404, description: 'Community not found' })
  async sendEmailInvites(
    @CurrentUser() user: { userId: string },
    @Param('communityId') communityId: string,
    @Body() dto: BulkEmailInviteDto,
  ) {
    return this.communityService.sendEmailInvites(
      user.userId,
      communityId,
      dto,
    );
  }

  // =====================================================
  // INVITE LINK CONFIGURATION (Admin)
  // =====================================================

  @Get(':communityId/invite-link/config')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get invite link configuration',
    description: 'Get the current invite link configuration for a community. Only admins.',
  })
  @ApiParam({ name: 'communityId', description: 'Community ID' })
  @ApiResponse({ status: 200, description: 'Invite link configuration retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not an admin' })
  @ApiResponse({ status: 404, description: 'Community not found' })
  async getInviteLinkConfig(
    @CurrentUser() user: { userId: string },
    @Param('communityId') communityId: string,
  ) {
    return this.communityService.getInviteLinkConfig(user.userId, communityId);
  }

  @Put(':communityId/invite-link/config')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update invite link configuration',
    description: 'Update the invite link settings (open/approval, expiry). Only admins.',
  })
  @ApiParam({ name: 'communityId', description: 'Community ID' })
  @ApiResponse({ status: 200, description: 'Invite link configuration updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not an admin' })
  @ApiResponse({ status: 404, description: 'Community not found' })
  async updateInviteLinkConfig(
    @CurrentUser() user: { userId: string },
    @Param('communityId') communityId: string,
    @Body() dto: UpdateInviteLinkConfigDto,
  ) {
    return this.communityService.updateInviteLinkConfig(
      user.userId,
      communityId,
      dto,
    );
  }

  @Post(':communityId/invite-link/regenerate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Regenerate invite link',
    description: 'Regenerate the invite link (deactivates the old one). Only admins.',
  })
  @ApiParam({ name: 'communityId', description: 'Community ID' })
  @ApiResponse({ status: 201, description: 'Invite link regenerated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not an admin' })
  @ApiResponse({ status: 404, description: 'Community not found' })
  async regenerateInviteLink(
    @CurrentUser() user: { userId: string },
    @Param('communityId') communityId: string,
  ) {
    return this.communityService.regenerateInviteLink(user.userId, communityId);
  }

  // =====================================================
  // JOIN REQUEST MANAGEMENT (Admin)
  // =====================================================

  @Get(':communityId/join-requests')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get join requests',
    description: 'Get all join requests for a community. Only admins.',
  })
  @ApiParam({ name: 'communityId', description: 'Community ID' })
  @ApiResponse({ status: 200, description: 'Join requests retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not an admin' })
  @ApiResponse({ status: 404, description: 'Community not found' })
  async getJoinRequests(
    @CurrentUser() user: { userId: string },
    @Param('communityId') communityId: string,
    @Query('status') status?: string,
  ) {
    return this.communityService.getJoinRequests(user.userId, communityId, status);
  }

  @Put('join-requests/:requestId/approve')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Approve join request',
    description: 'Approve a pending join request. Only admins.',
  })
  @ApiParam({ name: 'requestId', description: 'Join request ID' })
  @ApiResponse({ status: 200, description: 'Join request approved' })
  @ApiResponse({ status: 400, description: 'Request already processed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not an admin' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async approveJoinRequest(
    @CurrentUser() user: { userId: string },
    @Param('requestId') requestId: string,
  ) {
    return this.communityService.approveJoinRequest(user.userId, requestId);
  }

  @Put('join-requests/:requestId/reject')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reject join request',
    description: 'Reject a pending join request. Only admins.',
  })
  @ApiParam({ name: 'requestId', description: 'Join request ID' })
  @ApiResponse({ status: 200, description: 'Join request rejected' })
  @ApiResponse({ status: 400, description: 'Request already processed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not an admin' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async rejectJoinRequest(
    @CurrentUser() user: { userId: string },
    @Param('requestId') requestId: string,
  ) {
    return this.communityService.rejectJoinRequest(user.userId, requestId);
  }
}

// =====================================================
// SEPARATE CONTROLLER FOR PUBLIC INVITE ENDPOINTS
// =====================================================

@ApiTags('Invites')
@Controller('api/v1/invites')
export class InviteController {
  constructor(private readonly communityService: CommunityService) {}

  @Get(':token')
  @ApiOperation({
    summary: 'Get invite details',
    description: 'Get invite details by token. Public endpoint for showing join modal.',
  })
  @ApiParam({ name: 'token', description: 'Invite token' })
  @ApiResponse({ status: 200, description: 'Invite details retrieved' })
  @ApiResponse({ status: 400, description: 'Invite expired or invalid' })
  @ApiResponse({ status: 404, description: 'Invite not found' })
  async getInviteDetails(@Param('token') token: string) {
    return this.communityService.getInviteDetails(token);
  }

  @Post(':token/join')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Join community via invite link',
    description: 'Join a community using an invite link. If open, joins immediately. If approval required, creates a pending request.',
  })
  @ApiParam({ name: 'token', description: 'Invite token' })
  @ApiResponse({ status: 201, description: 'Joined or request submitted' })
  @ApiResponse({ status: 400, description: 'Already a member or invite invalid' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Invite not found' })
  async joinViaInviteLink(
    @CurrentUser() user: { userId: string },
    @Param('token') token: string,
  ) {
    return this.communityService.joinViaInviteLink(user.userId, token);
  }

  @Get(':communityId/request-status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get user join request status',
    description: 'Get the status of a user\'s join request for a community.',
  })
  @ApiParam({ name: 'communityId', description: 'Community ID' })
  @ApiResponse({ status: 200, description: 'Request status retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserJoinRequestStatus(
    @CurrentUser() user: { userId: string },
    @Param('communityId') communityId: string,
  ) {
    return this.communityService.getUserJoinRequestStatus(user.userId, communityId);
  }
}
