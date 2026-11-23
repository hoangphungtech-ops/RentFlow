import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TransactionType } from '../generated/prisma/client';

export class AllocationItemDto {
  @ApiProperty({ example: '77777777-7777-4777-8777-777777777777' })
  @IsUUID()
  invoiceId!: string;

  @ApiProperty({ example: 2000000, description: 'Số tiền phân bổ cho hóa đơn này (VND)' })
  @IsNumber()
  @Min(1)
  amount!: number;

  @ApiPropertyOptional({
    example: 3620000,
    description: 'Tổng tiền hóa đơn (nếu truyền sẽ chặn phân bổ vượt tổng hóa đơn)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  invoiceTotal?: number;
}

export class CreatePaymentDto {
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  @IsUUID()
  propertyId!: string;

  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  @IsUUID()
  leaseId!: string;

  @ApiProperty({ example: 2000000 })
  @IsNumber()
  @Min(1)
  amount!: number;

  @ApiProperty({ example: 'BANK_TRANSFER', enum: ['CASH', 'BANK_TRANSFER'] })
  @IsIn(['CASH', 'BANK_TRANSFER'])
  paymentMethod!: 'CASH' | 'BANK_TRANSFER';

  @ApiProperty({ example: 'Nguyễn Văn A' })
  @IsString()
  @MinLength(2)
  payerName!: string;

  @ApiProperty({ example: '2026-11-23T15:30:00.000Z' })
  @IsDateString()
  paidAt!: string;

  @ApiPropertyOptional({ enum: TransactionType, default: TransactionType.INVOICE_PAYMENT })
  @IsOptional()
  @IsEnum(TransactionType)
  transactionType?: TransactionType;

  @ApiPropertyOptional({ example: 'FT26327999888' })
  @IsOptional()
  @IsString()
  referenceCode?: string;

  @ApiPropertyOptional({ type: [AllocationItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllocationItemDto)
  allocations?: AllocationItemDto[];
}

export class ReportPaymentDto {
  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  @IsUUID()
  leaseId!: string;

  @ApiProperty({ example: 2000000 })
  @IsNumber()
  @Min(1)
  amount!: number;

  @ApiProperty({ example: 'RENTER_A' })
  @IsString()
  @MinLength(2)
  payerName!: string;

  @ApiProperty({ example: '2026-11-23T15:30:00.000Z' })
  @IsDateString()
  paidAt!: string;

  @ApiPropertyOptional({ example: 'VCB123456789' })
  @IsOptional()
  @IsString()
  referenceCode?: string;
}

export class ConfirmPaymentDto {
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  @IsUUID()
  propertyId!: string;

  @ApiPropertyOptional({ type: [AllocationItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllocationItemDto)
  allocations?: AllocationItemDto[];
}

export class ReversePaymentDto {
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  @IsUUID()
  propertyId!: string;

  @ApiProperty({ example: 'Nhập nhầm số tiền chuyển khoản của phòng R101' })
  @IsString()
  @MinLength(5)
  reason!: string;
}
