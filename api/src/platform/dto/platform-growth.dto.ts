import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class GrantProDto {
  @ApiPropertyOptional({ example: '线下已确认' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
