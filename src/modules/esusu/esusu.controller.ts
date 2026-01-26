import {
  Controller,
  Post,
  Get,
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
  ApiQuery,
} from '@nestjs/swagger';
import { EsusuService } from './esusu.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateEsusuDto, RespondInvitationDto, SelectSlotDto } from './dto';

@ApiTags('Esusu')
@Controller('api/v1/esusu')
export class EsusuController {
  constructor(private readonly esusuService: EsusuService) {}

  @Get(':communityId/eligibility')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Check Esusu creation eligibility',
    description: 'Check if the user can create an Esusu in the specified community. Checks: Admin role, 3+ members, community wallet exists.',
  })
  @ApiParam({ name: 'communityId', description: 'Community ID' })
  @ApiResponse({ status: 200, description: 'Eligibility checked' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not a member' })
  async checkEligibility(
    @CurrentUser() user: { userId: string },
    @Param('communityId') communityId: string,
  ) {
    return this.esusuService.checkEsusuEligibility(user.userId, communityId);
  }

  @Get('check-name/:communityId/:name')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Check Esusu name availability',
    description: 'Check if an Esusu name is available in the community. Only checks active Esusus.',
  })
  @ApiParam({ name: 'communityId', description: 'Community ID' })
  @ApiParam({ name: 'name', description: 'Esusu name to check' })
  @ApiResponse({
    status: 200,
    description: 'Name availability checked',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            available: { type: 'boolean' },
            message: { type: 'string', nullable: true },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async checkNameAvailability(
    @Param('communityId') communityId: string,
    @Param('name') name: string,
  ) {
    return this.esusuService.checkNameAvailability(communityId, name);
  }

  @Get(':communityId/members')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get community members for Esusu',
    description: 'Get all community members for participant selection when creating an Esusu. Only Admin can access.',
  })
  @ApiParam({ name: 'communityId', description: 'Community ID' })
  @ApiResponse({ status: 200, description: 'Members retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not an admin' })
  async getCommunityMembers(
    @CurrentUser() user: { userId: string },
    @Param('communityId') communityId: string,
  ) {
    return this.esusuService.getCommunityMembersForEsusu(user.userId, communityId);
  }

  @Get('hub-count/:communityId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get Esusu count for Hub display',
    description: 'Get Esusu count for the Hub screen. Admin sees all Esusus, Members see only their participations.',
  })
  @ApiParam({ name: 'communityId', description: 'Community ID' })
  @ApiResponse({
    status: 200,
    description: 'Esusu count retrieved',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            active: { type: 'number' },
            pendingMembers: { type: 'number' },
            pendingInvitation: { type: 'number', description: 'Only for members' },
            isAdmin: { type: 'boolean' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not a member' })
  async getHubCount(
    @CurrentUser() user: { userId: string },
    @Param('communityId') communityId: string,
  ) {
    return this.esusuService.getHubCount(user.userId, communityId);
  }

  @Get('list/:communityId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get Esusu list',
    description: 'Get list of Esusus for the Esusu List page. Admin sees all Esusus, Members see only their participations.',
  })
  @ApiParam({ name: 'communityId', description: 'Community ID' })
  @ApiQuery({ name: 'archived', required: false, type: Boolean, description: 'Get archived (completed/cancelled) Esusus instead of active ones' })
  @ApiResponse({
    status: 200,
    description: 'Esusu list retrieved',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not a member' })
  async getEsusuList(
    @CurrentUser() user: { userId: string },
    @Param('communityId') communityId: string,
    @Query('archived') archived?: string,
  ) {
    const isArchived = archived === 'true';
    return this.esusuService.getEsusuList(user.userId, communityId, isArchived);
  }

  @Get(':esusuId/invitation')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get Esusu invitation details',
    description: 'Get detailed information about an Esusu invitation for a member to review before accepting or declining.',
  })
  @ApiParam({ name: 'esusuId', description: 'Esusu ID' })
  @ApiResponse({
    status: 200,
    description: 'Invitation details retrieved',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
            iconUrl: { type: 'string', nullable: true },
            contributionAmount: { type: 'number' },
            frequency: { type: 'string' },
            targetMembers: { type: 'number' },
            startDate: { type: 'string', format: 'date-time' },
            totalAmountPerCycle: { type: 'number' },
            commission: { type: 'number' },
            platformFeePercent: { type: 'number' },
            platformFee: { type: 'number' },
            payout: { type: 'number' },
            payoutSchedule: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  cycleNumber: { type: 'number' },
                  payoutDate: { type: 'string', format: 'date-time' },
                },
              },
            },
            creatorName: { type: 'string' },
            participationDeadline: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not invited to this Esusu' })
  @ApiResponse({ status: 404, description: 'Esusu not found' })
  async getInvitationDetails(
    @CurrentUser() user: { userId: string },
    @Param('esusuId') esusuId: string,
  ) {
    return this.esusuService.getInvitationDetails(user.userId, esusuId);
  }

  @Post(':esusuId/respond')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Respond to Esusu invitation',
    description: 'Accept or decline an Esusu invitation. Once accepted, the member becomes a participant.',
  })
  @ApiParam({ name: 'esusuId', description: 'Esusu ID' })
  @ApiResponse({
    status: 200,
    description: 'Invitation response recorded',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid response or deadline passed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not invited to this Esusu' })
  @ApiResponse({ status: 404, description: 'Esusu not found' })
  async respondToInvitation(
    @CurrentUser() user: { userId: string },
    @Param('esusuId') esusuId: string,
    @Body() dto: RespondInvitationDto,
  ) {
    return this.esusuService.respondToInvitation(user.userId, esusuId, dto.accept);
  }

  @Get(':esusuId/slots')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get available slots for FCFS Esusu',
    description: 'Get slot availability information for First Come First Served payout order Esusus.',
  })
  @ApiParam({ name: 'esusuId', description: 'Esusu ID' })
  @ApiResponse({
    status: 200,
    description: 'Slot details retrieved',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
            iconUrl: { type: 'string', nullable: true },
            contributionAmount: { type: 'number' },
            frequency: { type: 'string' },
            targetMembers: { type: 'number' },
            startDate: { type: 'string', format: 'date-time' },
            availableSlots: { type: 'array', items: { type: 'number' } },
            takenSlots: { type: 'array', items: { type: 'number' } },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not a participant' })
  @ApiResponse({ status: 404, description: 'Esusu not found' })
  async getSlotDetails(
    @CurrentUser() user: { userId: string },
    @Param('esusuId') esusuId: string,
  ) {
    return this.esusuService.getSlotDetails(user.userId, esusuId);
  }

  @Post(':esusuId/select-slot')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Select a slot for FCFS Esusu',
    description: 'Select a payout slot for First Come First Served Esusus. Only available slots can be selected.',
  })
  @ApiParam({ name: 'esusuId', description: 'Esusu ID' })
  @ApiResponse({
    status: 200,
    description: 'Slot selected successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            slotNumber: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - slot not available or already selected' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not a participant' })
  @ApiResponse({ status: 404, description: 'Esusu not found' })
  async selectSlot(
    @CurrentUser() user: { userId: string },
    @Param('esusuId') esusuId: string,
    @Body() dto: SelectSlotDto,
  ) {
    return this.esusuService.selectSlot(user.userId, esusuId, dto.slotNumber);
  }

  @Get(':esusuId/waiting-room')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get waiting room details',
    description: 'Get Esusu details with participant list and countdown for the waiting room screen.',
  })
  @ApiParam({ name: 'esusuId', description: 'Esusu ID' })
  @ApiResponse({
    status: 200,
    description: 'Waiting room details retrieved',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
            iconUrl: { type: 'string', nullable: true },
            contributionAmount: { type: 'number' },
            frequency: { type: 'string' },
            targetMembers: { type: 'number' },
            startDate: { type: 'string', format: 'date-time' },
            status: { type: 'string' },
            payoutOrderType: { type: 'string' },
            participants: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  fullName: { type: 'string' },
                  email: { type: 'string' },
                  profileImage: { type: 'string', nullable: true },
                  inviteStatus: { type: 'string' },
                  slotNumber: { type: 'number', nullable: true },
                  isCreator: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not a participant' })
  @ApiResponse({ status: 404, description: 'Esusu not found' })
  async getWaitingRoomDetails(
    @CurrentUser() user: { userId: string },
    @Param('esusuId') esusuId: string,
  ) {
    return this.esusuService.getWaitingRoomDetails(user.userId, esusuId);
  }

  @Post(':esusuId/remind')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Send reminder to pending participants',
    description: 'Send push notification and email reminders to participants who have not yet responded to the invitation.',
  })
  @ApiParam({ name: 'esusuId', description: 'Esusu ID' })
  @ApiResponse({
    status: 200,
    description: 'Reminders sent successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            remindersSent: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not the creator' })
  @ApiResponse({ status: 404, description: 'Esusu not found' })
  async remindPendingParticipants(
    @CurrentUser() user: { userId: string },
    @Param('esusuId') esusuId: string,
  ) {
    return this.esusuService.remindPendingParticipants(user.userId, esusuId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new Esusu',
    description: 'Create a new Esusu in a community. Sends invitations to all selected participants via push notifications and email.',
  })
  @ApiResponse({
    status: 201,
    description: 'Esusu created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not an admin or not eligible' })
  async createEsusu(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateEsusuDto,
  ) {
    return this.esusuService.createEsusu(user.userId, dto);
  }
}
