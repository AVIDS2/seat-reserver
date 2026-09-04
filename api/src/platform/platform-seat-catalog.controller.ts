import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { RequestWithUser } from '../utils/types/request-with-user.type';
import {
  SeatCatalogQueryDto,
  SeatLayoutQueryDto,
  SeatTimesQueryDto,
} from './dto/seat-catalog.dto';
import { PlatformSeatCatalogService } from './platform-seat-catalog.service';

@ApiTags('Platform Seat Catalog')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'platform/catalog', version: '1' })
export class PlatformSeatCatalogController {
  constructor(private readonly catalog: PlatformSeatCatalogService) {}

  @Get('filters')
  filters(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Query() query: SeatCatalogQueryDto,
  ) {
    return this.catalog.filters(
      Number(request.user.id),
      query.accountId,
      query.serviceType,
      query.refresh === true,
    );
  }

  @Get('layout')
  layout(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Query() query: SeatLayoutQueryDto,
  ) {
    return this.catalog.layout(
      Number(request.user.id),
      query.accountId,
      query.serviceType,
      query.roomId,
      query.date,
      query.refresh === true,
    );
  }

  @Get('times')
  times(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Query() query: SeatTimesQueryDto,
  ) {
    return this.catalog.times(
      Number(request.user.id),
      query.accountId,
      query.serviceType,
      query.roomId,
      query.seatId,
      query.date,
      query.startTime,
      query.refresh === true,
    );
  }
}
