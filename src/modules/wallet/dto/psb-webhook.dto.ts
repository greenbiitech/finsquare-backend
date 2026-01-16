import { IsString, IsNotEmpty } from 'class-validator';

export class PsbWebhookDto {
  @IsString()
  @IsNotEmpty()
  merchantNameOfPartner: string;

  @IsString()
  @IsNotEmpty()
  amount: string;

  @IsString()
  @IsNotEmpty()
  sourceaccount: string;

  @IsString()
  @IsNotEmpty()
  sourcebank: string;

  @IsString()
  @IsNotEmpty()
  sendername: string;

  @IsString()
  @IsNotEmpty()
  nipsessionid: string;

  @IsString()
  @IsNotEmpty()
  accountnumber: string;

  @IsString()
  @IsNotEmpty()
  narration: string;

  @IsString()
  @IsNotEmpty()
  transactionref: string;

  @IsString()
  @IsNotEmpty()
  orderref: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  message: string;
}
