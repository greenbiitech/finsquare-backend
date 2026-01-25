import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsEnum,
  IsDateString,
  IsBoolean,
  IsOptional,
  IsArray,
  ValidateNested,
  Min,
  Max,
  MinLength,
  MaxLength,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PaymentFrequencyDto {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
}

export enum PayoutOrderTypeDto {
  RANDOM = 'RANDOM',
  FIRST_COME_FIRST_SERVED = 'FIRST_COME_FIRST_SERVED',
}

class ParticipantDto {
  @ApiProperty({ description: 'User ID of the participant' })
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class CreateEsusuDto {
  @ApiProperty({ description: 'Community ID' })
  @IsString()
  @IsNotEmpty()
  communityId: string;

  @ApiProperty({ description: 'Esusu name', example: 'Esusu for Rent' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'Esusu name must be at least 3 characters' })
  @MaxLength(50, { message: 'Esusu name cannot exceed 50 characters' })
  name: string;

  @ApiPropertyOptional({ description: 'Description of the Esusu' })
  @IsString()
  @IsOptional()
  @MaxLength(200, { message: 'Description cannot exceed 200 characters' })
  description?: string;

  @ApiPropertyOptional({ description: 'URL of the Esusu icon/picture' })
  @IsString()
  @IsOptional()
  iconUrl?: string;

  @ApiProperty({ description: 'Number of participants', minimum: 3 })
  @IsNumber()
  @Min(3, { message: 'Minimum 3 participants required' })
  numberOfParticipants: number;

  @ApiProperty({ description: 'Contribution amount per member per cycle', minimum: 100 })
  @IsNumber()
  @Min(100, { message: 'Minimum contribution is 100' })
  contributionAmount: number;

  @ApiProperty({ description: 'Payment frequency', enum: PaymentFrequencyDto })
  @IsEnum(PaymentFrequencyDto)
  frequency: PaymentFrequencyDto;

  @ApiProperty({ description: 'Deadline for participants to accept invitations' })
  @IsDateString()
  participationDeadline: string;

  @ApiProperty({ description: 'Date when the first collection starts' })
  @IsDateString()
  collectionDate: string;

  @ApiProperty({ description: 'Whether the creator takes commission', default: false })
  @IsBoolean()
  takeCommission: boolean;

  @ApiPropertyOptional({ description: 'Commission percentage (1-50%)', minimum: 1, maximum: 50 })
  @IsNumber()
  @IsOptional()
  @Min(1, { message: 'Commission must be at least 1%' })
  @Max(50, { message: 'Commission cannot exceed 50%' })
  commissionPercentage?: number;

  @ApiProperty({ description: 'Payout order type', enum: PayoutOrderTypeDto })
  @IsEnum(PayoutOrderTypeDto)
  payoutOrderType: PayoutOrderTypeDto;

  @ApiProperty({ description: 'List of participants to invite', type: [ParticipantDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParticipantDto)
  @ArrayMinSize(3, { message: 'At least 3 participants required' })
  participants: ParticipantDto[];
}
