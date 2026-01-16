import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class PasskeyLoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: '12345', minLength: 5, maxLength: 5 })
  @IsNotEmpty()
  @IsString()
  @Length(5, 5)
  passkey: string;
}
