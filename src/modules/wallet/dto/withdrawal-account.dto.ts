import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length } from 'class-validator';

export class CreateWithdrawalAccountDto {
  @ApiProperty({ description: 'Bank code', example: '000013' })
  @IsString()
  @IsNotEmpty()
  bankCode: string;

  @ApiProperty({ description: 'Bank name', example: 'GTBank' })
  @IsString()
  @IsNotEmpty()
  bankName: string;

  @ApiProperty({ description: 'Account number', example: '0123456789' })
  @IsString()
  @IsNotEmpty()
  @Length(10, 10, { message: 'Account number must be exactly 10 digits' })
  accountNumber: string;

  @ApiProperty({ description: 'Account holder name', example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  accountName: string;
}
