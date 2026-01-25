import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { EsusuService } from './esusu.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateEsusuDto } from './dto';

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
