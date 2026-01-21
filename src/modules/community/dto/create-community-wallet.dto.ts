import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsEnum,
  Length,
  Matches,
} from 'class-validator';

export enum ApprovalRuleDto {
  THIRTY_PERCENT = 'THIRTY_PERCENT',
  FIFTY_PERCENT = 'FIFTY_PERCENT',
  SEVENTY_FIVE_PERCENT = 'SEVENTY_FIVE_PERCENT',
  HUNDRED_PERCENT = 'HUNDRED_PERCENT',
}

export class CreateCommunityWalletDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'User ID of Signatory B (first Co-Admin)',
  })
  @IsNotEmpty()
  @IsString()
  signatoryBUserId: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'User ID of Signatory C (second Co-Admin)',
  })
  @IsNotEmpty()
  @IsString()
  signatoryCUserId: string;

  @ApiProperty({
    example: 'FIFTY_PERCENT',
    description: 'Approval rule for fund release',
    enum: ApprovalRuleDto,
  })
  @IsNotEmpty()
  @IsEnum(ApprovalRuleDto, {
    message:
      'Approval rule must be one of: THIRTY_PERCENT, FIFTY_PERCENT, SEVENTY_FIVE_PERCENT, HUNDRED_PERCENT',
  })
  approvalRule: ApprovalRuleDto;

  @ApiProperty({
    example: '1234',
    description: 'Transaction PIN for community wallet (4 digits)',
    minLength: 4,
    maxLength: 4,
  })
  @IsNotEmpty()
  @IsString()
  @Length(4, 4, { message: 'Transaction PIN must be exactly 4 digits' })
  @Matches(/^\d{4}$/, { message: 'Transaction PIN must contain only digits' })
  transactionPin: string;
}
