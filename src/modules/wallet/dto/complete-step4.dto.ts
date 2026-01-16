import { IsString, IsNotEmpty, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompleteStep4Dto {
  @ApiProperty({
    description: 'URL of the uploaded proof of address document',
    example: 'https://res.cloudinary.com/xxx/image/upload/v123/proof.jpg',
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  proofOfAddressUrl: string;
}
