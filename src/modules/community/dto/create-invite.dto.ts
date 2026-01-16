import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsDateString,
  Min,
  IsEmail,
} from 'class-validator';

export enum InviteTypeDto {
  EMAIL = 'EMAIL',
  LINK = 'LINK',
}

export enum JoinTypeDto {
  OPEN = 'OPEN',
  APPROVAL_REQUIRED = 'APPROVAL_REQUIRED',
}

export class CreateInviteLinkDto {
  @ApiPropertyOptional({
    example: 'OPEN',
    description: 'Join type - OPEN for auto-join, APPROVAL_REQUIRED for admin approval',
    enum: JoinTypeDto,
  })
  @IsOptional()
  @IsEnum(JoinTypeDto)
  joinType?: JoinTypeDto;

  @ApiPropertyOptional({
    example: 100,
    description: 'Maximum number of members that can join via this link (null for unlimited)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxMembers?: number;

  @ApiPropertyOptional({
    example: '2025-02-14T00:00:00.000Z',
    description: 'Expiry date for the invite link (null for no expiry)',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class CreateEmailInviteDto {
  @ApiProperty({
    example: 'john@example.com',
    description: 'Email address to send the invite to',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    example: 'John Doe',
    description: 'Name of the person being invited (for personalization)',
  })
  @IsOptional()
  @IsString()
  name?: string;
}

export class BulkEmailInviteDto {
  @ApiProperty({
    type: [CreateEmailInviteDto],
    description: 'Array of email invites to send',
  })
  @IsNotEmpty()
  invites: CreateEmailInviteDto[];
}

export class UpdateInviteLinkConfigDto {
  @ApiProperty({
    example: 'OPEN',
    description: 'Join type - OPEN for auto-join, APPROVAL_REQUIRED for admin approval',
    enum: JoinTypeDto,
  })
  @IsNotEmpty()
  @IsEnum(JoinTypeDto)
  joinType: JoinTypeDto;

  @ApiPropertyOptional({
    example: '2025-02-14T00:00:00.000Z',
    description: 'Expiry date for the invite link (null for no expiry)',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}
