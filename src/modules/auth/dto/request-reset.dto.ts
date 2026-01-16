import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RequestResetDto {
  @ApiProperty({ example: 'john@example.com', description: 'Email or phone number' })
  @IsNotEmpty()
  @IsString()
  identifier: string;
}
