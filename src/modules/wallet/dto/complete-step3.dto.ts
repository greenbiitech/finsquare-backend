import { IsString, IsNotEmpty, IsUrl } from 'class-validator';

export class CompleteStep3Dto {
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  photoUrl: string;
}
