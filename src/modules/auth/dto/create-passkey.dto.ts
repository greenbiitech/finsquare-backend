import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CreatePasskeyDto {
  @ApiProperty({ example: '12345', minLength: 5, maxLength: 5 })
  @IsNotEmpty()
  @IsString()
  @Length(5, 5)
  passkey: string;
}
