import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsDateString,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  MAX_SUPPORTED_BOOKING_MINUTES,
  MIN_SUPPORTED_BOOKING_MINUTES,
} from '../booking-time.constants';

export class ReservationAccountDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  accountId: number;

  @IsIn(['study_room', 'library'])
  serviceType: 'study_room' | 'library';
}

export class ImmediateReservationDto extends ReservationAccountDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  seatId: string;

  @IsDateString()
  date: string;

  @Type(() => Number)
  @IsInt()
  @Min(MIN_SUPPORTED_BOOKING_MINUTES)
  @Max(MAX_SUPPORTED_BOOKING_MINUTES)
  startTime: number;

  @Type(() => Number)
  @IsInt()
  @Min(MIN_SUPPORTED_BOOKING_MINUTES)
  @Max(MAX_SUPPORTED_BOOKING_MINUTES)
  endTime: number;
}

export class BookingCaptchaPointDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(4000)
  x: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(4000)
  y: number;
}

export class VerifyBookingCaptchaDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => BookingCaptchaPointDto)
  points: BookingCaptchaPointDto[];
}
