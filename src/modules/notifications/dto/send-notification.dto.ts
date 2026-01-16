import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject, IsNotEmpty } from 'class-validator';

export class SendNotificationDto {
  @ApiProperty({
    description: 'User ID to send notification to',
    example: 'uuid-here',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Notification title',
    example: 'Payment Received',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Notification body',
    example: 'You received ₦5,000 from John Doe',
  })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiPropertyOptional({
    description: 'Additional data payload',
    example: { type: 'transaction', id: 'txn-123' },
  })
  @IsObject()
  @IsOptional()
  data?: Record<string, string>;
}

export class SendBulkNotificationDto {
  @ApiProperty({
    description: 'User IDs to send notification to',
    example: ['uuid-1', 'uuid-2'],
    type: [String],
  })
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  userIds: string[];

  @ApiProperty({
    description: 'Notification title',
    example: 'Community Update',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Notification body',
    example: 'New contribution cycle starts tomorrow',
  })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiPropertyOptional({
    description: 'Additional data payload',
    example: { type: 'community', action: 'update' },
  })
  @IsObject()
  @IsOptional()
  data?: Record<string, string>;
}
