import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class VerifyBvnDto {
  @ApiProperty({
    description: 'Session ID from initiate BVN response',
    example: 'session_abc123',
  })
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @ApiProperty({
    description: 'Verification method (phone or email)',
    example: 'phone',
    enum: ['phone', 'email'],
  })
  @IsString()
  @IsIn(['phone', 'email'], { message: 'Method must be either phone or email' })
  method: string;
}
