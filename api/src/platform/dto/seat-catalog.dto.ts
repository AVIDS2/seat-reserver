import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsBoolean,
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

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  refresh?: boolean;
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
