import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { UserStatus } from '../generated/prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'staff.b@rentflow.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Rentflow@2026' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'Nhân viên mới' })
  @IsString()
  fullName!: string;

  @ApiPropertyOptional({ example: '0901234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'STAFF', enum: ['STAFF', 'ACCOUNTANT', 'TENANT'] })
  @IsString()
  roleName!: string;

  @ApiPropertyOptional({ example: '11111111-1111-4111-8111-111111111111' })
  @IsOptional()
  @IsUUID()
  propertyId?: string;
}

export class GrantPropertyAccessDto {
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  @IsUUID()
  propertyId!: string;
}

export class UpdateUserStatusDto {
  @ApiProperty({ enum: UserStatus, example: UserStatus.LOCKED })
  @IsEnum(UserStatus)
  status!: UserStatus;
}
