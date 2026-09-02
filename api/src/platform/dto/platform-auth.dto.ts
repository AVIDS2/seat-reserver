import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class PlatformLoginDto {
  @ApiProperty({ example: 'you@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}

export class PlatformRegisterDto extends PlatformLoginDto {
  @ApiProperty({ example: '张' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: '同学' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @ApiProperty({
    required: false,
    description: '首个用户可免邀请码注册，之后需要管理员生成的邀请码。',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  inviteCode?: string;
}
