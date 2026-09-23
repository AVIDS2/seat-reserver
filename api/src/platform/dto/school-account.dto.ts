import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateSchoolAccountDto {
  @ApiProperty({ enum: ['cczu', 'njtech'], default: 'cczu' })
  @IsOptional()
  @IsString()
  @IsIn(['cczu', 'njtech'])
  schoolCode?: 'cczu' | 'njtech';

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
  @MaxLength(200)
  schoolPassword: string;
}

export class UpdateSchoolAccountDto extends PartialType(
  CreateSchoolAccountDto,
) {}
