import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { RequestWithUser } from '../utils/types/request-with-user.type';
import { PlatformDashboardService } from './platform-dashboard.service';

@ApiTags('Platform Dashboard')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'platform/dashboard', version: '1' })
export class PlatformDashboardController {
  constructor(private readonly dashboard: PlatformDashboardService) {}

  @Get()
  async snapshot(@Request() request: RequestWithUser<JwtPayloadType>) {
    return this.dashboard.snapshot(Number(request.user.id));
  }
}
