import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SelectSlotDto {
  @ApiProperty({
    description: 'The slot number to select (1-indexed)',
    example: 1,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  slotNumber: number;
}
