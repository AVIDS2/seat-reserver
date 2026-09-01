import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSchoolAccountDto {
  @ApiProperty({ example: '我的账号' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label: string;

  @ApiProperty({ example: '2300906131' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  schoolUsername: string;

  @ApiProperty({ minLength: 1 })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  schoolPassword: string;
}
