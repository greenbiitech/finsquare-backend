import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ResendResetOtpDto {
  @ApiProperty({ example: 'reset-token-uuid', description: 'Reset token received from request-reset' })
  @IsNotEmpty()
  @IsString()
  token: string;
}
