import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

/**
 * DTO for completing Step 2 of wallet setup
 * Called from the Address Info screen
 * Saves personal info + address and syncs user data with BVN
 */
export class CompleteStep2Dto {
  // Address fields (required)
  @ApiProperty({
    description: 'House/Street address',
    example: '24 Kalu Road, Maryland Street',
  })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({
    description: 'State of residence',
    example: 'Lagos',
  })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiProperty({
    description: 'Local Government Area',
    example: 'Ikeja',
  })
  @IsString()
  @IsNotEmpty()
  lga: string;

  // Personal info (optional)
  @ApiPropertyOptional({
    description: 'User occupation',
    example: 'Software Engineer',
  })
  @IsString()
  @IsOptional()
  occupation?: string;

  // Name sync confirmation
  @ApiProperty({
    description: 'User confirmed to sync their name with BVN records',
    example: true,
  })
  @IsBoolean()
  syncWithBvn: boolean;
}
