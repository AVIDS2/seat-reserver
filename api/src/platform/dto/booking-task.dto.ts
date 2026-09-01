import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class TimeCandidateDto {
  @ApiProperty({ example: 840, description: 'Minutes after midnight.' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  start: number;

  @ApiProperty({ example: 1320, description: 'Minutes after midnight.' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  end: number;
}

export class CreateBookingTaskDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  accountId: number;

  @ApiProperty({ example: '44 号优先' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '197' })
  @IsString()
  @IsNotEmpty()
  primarySeatId: string;

  @ApiProperty({ example: ['211'], required: false, default: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  backupSeatIds?: string[];

  @ApiProperty({
    type: () => [TimeCandidateDto],
    example: [{ start: 840, end: 1320 }],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeCandidateDto)
  timeCandidates: TimeCandidateDto[];

  @ApiProperty({ example: 12, required: false, default: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  maxAttempts?: number;

  @ApiProperty({ example: 1.2, required: false, default: 1.2 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(30)
  attemptDelaySeconds?: number;

  @ApiProperty({ example: 20, required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(120)
  bookingWindowSeconds?: number;

  @ApiProperty({ example: 0, required: false, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(300)
  prewarmOffsetSeconds?: number;

  @ApiProperty({ example: 1, required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(300)
  runOffsetSeconds?: number;

  @ApiProperty({ example: true, required: false, default: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateBookingTaskDto extends PartialType(CreateBookingTaskDto) {}

export class RunBookingDto {
  @ApiProperty({ example: '2026-09-01', required: false })
  @IsOptional()
  @IsString()
  targetDate?: string;
}
