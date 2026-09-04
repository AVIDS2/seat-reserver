import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { RequestWithUser } from '../utils/types/request-with-user.type';
import {
  ImmediateReservationDto,
  ReservationAccountDto,
} from './dto/reservation.dto';
import { PlatformReservationsService } from './platform-reservations.service';

@ApiTags('Platform Reservations')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'platform/reservations', version: '1' })
export class PlatformReservationsController {
  constructor(private readonly reservations: PlatformReservationsService) {}

  @Get()
  async list(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Query() query: ReservationAccountDto,
  ) {
    return {
      reservations: await this.reservations.list(
        Number(request.user.id),
        query.accountId,
        query.serviceType,
      ),
    };
  }

  @Post('book')
  @HttpCode(HttpStatus.CREATED)
  async book(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Body() dto: ImmediateReservationDto,
  ) {
    return {
      reservation: await this.reservations.book(Number(request.user.id), dto),
    };
  }

  @Post(':id/cancel')
  async cancel(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Param('id') id: string,
    @Body() dto: ReservationAccountDto,
  ) {
    return {
      reservation: await this.reservations.cancel(
        Number(request.user.id),
        dto.accountId,
        dto.serviceType,
        id,
      ),
    };
  }
}
