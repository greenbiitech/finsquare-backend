import { IsString, IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResolveAccountDto {
    @ApiProperty({ example: '0123456789' })
    @IsString()
    accountNumber: string;

    @ApiProperty({ example: '058' })
    @IsString()
    bankCode: string;
}

export class WithdrawDto {
    @ApiProperty({ example: 5000 })
    @IsNumber()
    @Min(100)
    amount: number;

    @ApiProperty({ example: '0123456789' })
    @IsString()
    destinationAccountNumber: string;

    @ApiProperty({ example: '058' })
    @IsString()
    destinationBankCode: string;

    @ApiProperty({ example: 'John Doe' })
    @IsString()
    destinationAccountName: string;

    @ApiProperty({ example: 'Withdrawal' })
    @IsString()
    narration: string;

    @ApiProperty({ example: '1234' })
    @IsString()
    transactionPin: string;

    @ApiProperty({ required: false })
    @IsBoolean()
    @IsOptional()
    saveBeneficiary?: boolean;
}

export class TransferDto {
    @ApiProperty({ example: 5000 })
    @IsNumber()
    @Min(100)
    amount: number;

    @ApiProperty({ example: '1234567890' })
    @IsString()
    recipientAccountNumber: string;

    @ApiProperty({ example: '058' })
    @IsString()
    destinationBankCode: string;

    @ApiProperty({ example: 'John Doe' })
    @IsString()
    destinationAccountName: string;

    @ApiProperty({ example: 'Transfer' })
    @IsString()
    narration: string;

    @ApiProperty({ example: '1234' })
    @IsString()
    transactionPin: string;
}
