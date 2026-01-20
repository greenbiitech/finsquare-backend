import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsArray, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class AddCoAdminsDto {
  @ApiProperty({
    description: 'Array of user IDs to promote to Co-Admin (max 3)',
    example: ['user-uuid-1', 'user-uuid-2'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one user ID is required' })
  @ArrayMaxSize(3, { message: 'Maximum 3 co-admins can be added at once' })
  @IsString({ each: true })
  userIds: string[];
}

export class RemoveCoAdminDto {
  @ApiProperty({
    description: 'User ID to remove from Co-Admin role',
    example: 'user-uuid-123',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;
}
