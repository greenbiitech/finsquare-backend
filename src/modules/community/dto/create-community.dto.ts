import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export class CreateCommunityDto {
  @ApiProperty({
    example: 'Lagos Tech Cooperative',
    description: 'Name of the community',
    minLength: 3,
    maxLength: 50,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(3, { message: 'Community name must be at least 3 characters' })
  @MaxLength(50, { message: 'Community name must be at most 50 characters' })
  name: string;

  @ApiPropertyOptional({
    example: 'A community for tech professionals in Lagos',
    description: 'Description of the community',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Description must be at most 200 characters' })
  description?: string;

  @ApiPropertyOptional({
    example: 'https://cloudinary.com/logo.png',
    description: 'URL of the community logo',
  })
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiPropertyOptional({
    example: '#CD1919',
    description: 'Hex color code for community branding',
  })
  @IsOptional()
  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: 'Color must be a valid hex color code (e.g., #CD1919)',
  })
  color?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether the community is officially registered',
  })
  @IsOptional()
  @IsBoolean()
  isRegistered?: boolean;

  @ApiPropertyOptional({
    example: 'https://cloudinary.com/proof.pdf',
    description: 'URL of proof of address document',
  })
  @IsOptional()
  @IsString()
  proofOfAddress?: string;

  @ApiPropertyOptional({
    example: 'https://cloudinary.com/cac.pdf',
    description: 'URL of CAC registration certificate',
  })
  @IsOptional()
  @IsString()
  cacDocument?: string;

  @ApiPropertyOptional({
    example: 'https://cloudinary.com/address.pdf',
    description: 'URL of address verification document',
  })
  @IsOptional()
  @IsString()
  addressVerification?: string;
}
