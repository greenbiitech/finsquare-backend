import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RespondInvitationDto {
  @ApiProperty({
    description: 'Whether to accept (true) or decline (false) the invitation',
    example: true,
  })
  @IsBoolean()
  accept: boolean;
}
