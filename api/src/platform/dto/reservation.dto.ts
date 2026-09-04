import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  BOOKABLE_END_MINUTES,
  BOOKABLE_START_MINUTES,
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
  @Min(BOOKABLE_START_MINUTES)
  @Max(BOOKABLE_END_MINUTES)
  startTime: number;

  @Type(() => Number)
  @IsInt()
  @Min(BOOKABLE_START_MINUTES)
  @Max(BOOKABLE_END_MINUTES)
  endTime: number;
}
