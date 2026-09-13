import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PlatformProfileShowcaseDto {
  @ApiPropertyOptional({ example: 'starlight' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  avatarFrameId?: string;

  @ApiPropertyOptional({ example: 'early_bird' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  titleId?: string;

  @ApiPropertyOptional({ example: 'first_success' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  badgeId?: string;
}
