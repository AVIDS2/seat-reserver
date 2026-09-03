import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class SeatCatalogQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  accountId: number;

  @IsIn(['study_room', 'library'])
  serviceType: 'study_room' | 'library';
}

export class SeatLayoutQueryDto extends SeatCatalogQueryDto {
  @IsString()
  roomId: string;

  @IsDateString()
  date: string;
}

export class SeatTimesQueryDto extends SeatLayoutQueryDto {
  @IsString()
  seatId: string;

  @IsOptional()
  @IsString()
  startTime?: string;
}
