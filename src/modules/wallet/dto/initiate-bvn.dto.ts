import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class InitiateBvnDto {
  @ApiProperty({
    description: 'Bank Verification Number (11 digits)',
    example: '22211122211',
  })
  @IsString()
  @Length(11, 11, { message: 'BVN must be exactly 11 digits' })
  @Matches(/^\d{11}$/, { message: 'BVN must contain only digits' })
  bvn: string;
}
