import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length } from 'class-validator';

export class VerifyBvnOtpDto {
  @ApiProperty({
    description: 'Session ID from initiate BVN response',
    example: 'session_abc123',
  })
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @ApiProperty({
    description: 'OTP received via selected verification method',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  @Length(4, 8, { message: 'OTP must be between 4 and 8 characters' })
  otp: string;
}
