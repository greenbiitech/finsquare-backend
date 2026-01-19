import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsIn, ValidateIf, Matches } from 'class-validator';

export class VerifyBvnDto {
  @ApiProperty({
    description: 'Session ID from initiate BVN response',
    example: 'session_abc123',
  })
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @ApiProperty({
    description: 'Verification method (phone, email, or alternate_phone)',
    example: 'phone',
    enum: ['phone', 'email', 'alternate_phone'],
  })
  @IsString()
  @IsIn(['phone', 'email', 'alternate_phone'], { message: 'Method must be phone, email, or alternate_phone' })
  method: string;

  @ApiPropertyOptional({
    description: 'Phone number for alternate_phone method (required when method is alternate_phone)',
    example: '09012345678',
  })
  @ValidateIf((o) => o.method === 'alternate_phone')
  @IsString()
  @IsNotEmpty({ message: 'Phone number is required for alternate_phone method' })
  @Matches(/^0[789]\d{9}$/, { message: 'Phone number must be a valid Nigerian phone number' })
  phoneNumber?: string;
}
