import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';

export class CreateInvitationDto {
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  @IsUUID()
  propertyId!: string;

  @ApiProperty({ example: '55555555-5555-4555-8555-555555555555' })
  @IsUUID()
  tenantId!: string;

  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  @IsUUID()
  leaseId!: string;

  @ApiPropertyOptional({ example: 48, default: 48 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  expiresInHours?: number;
}

export class AcceptInvitationDto {
  @ApiProperty({ description: 'Token lời mời nhận được từ chủ trọ' })
  @IsString()
  @MinLength(32)
  token!: string;

  @ApiProperty({ example: 'tenant.new@rentflow.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Rentflow@2026' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'Nguyễn Văn Thuê' })
  @IsString()
  fullName!: string;

  @ApiPropertyOptional({ example: '0909123456' })
  @IsOptional()
  @IsString()
  phone?: string;
}
