import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompleteStep5Dto {
  @ApiProperty({
    description: 'Transaction PIN (4 digits)',
    example: '1234',
  })
  @IsNotEmpty({ message: 'Transaction PIN is required' })
  @IsString()
  @Length(4, 4, { message: 'Transaction PIN must be exactly 4 digits' })
  @Matches(/^\d{4}$/, { message: 'Transaction PIN must be 4 digits' })
  transactionPin: string;
}
