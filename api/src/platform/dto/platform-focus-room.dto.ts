import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateFocusRoomDto {
  @ApiProperty({ example: '周三晚自习' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  shareFocusData?: boolean;

  @ApiPropertyOptional({ default: 25, minimum: 5, maximum: 90 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(90)
  workMinutes?: number;

  @ApiPropertyOptional({ default: 5, minimum: 1, maximum: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  shortBreakMinutes?: number;

  @ApiPropertyOptional({ default: 15, minimum: 5, maximum: 60 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(60)
  longBreakMinutes?: number;

  @ApiPropertyOptional({ default: 4, minimum: 2, maximum: 8 })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(8)
  roundsBeforeLongBreak?: number;
}

export class JoinFocusRoomDto {
  @ApiProperty({ example: 'A7K2P9' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9]{6,8}$/i)
  code: string;
}

export class UpdateFocusPresenceDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  focused: boolean;
}

export class FocusRoomTimerActionDto {
  @ApiProperty({ enum: ['start', 'pause', 'reset'] })
  @IsIn(['start', 'pause', 'reset'])
  action: 'start' | 'pause' | 'reset';
}
