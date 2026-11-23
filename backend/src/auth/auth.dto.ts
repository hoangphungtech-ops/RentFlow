import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'owner.a@rentflow.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Rentflow@2026' })
  @IsString()
  @MinLength(6)
  password!: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'Rentflow@2026' })
  @IsString()
  @MinLength(6)
  currentPassword!: string;

  @ApiProperty({ example: 'NewPass@2026' })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
