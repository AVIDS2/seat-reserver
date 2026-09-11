import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { RequestWithUser } from '../utils/types/request-with-user.type';
import { PlatformLeaderboardService } from './platform-leaderboard.service';

@ApiTags('Platform Leaderboard')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'platform/leaderboard', version: '1' })
export class PlatformLeaderboardController {
  constructor(private readonly leaderboard: PlatformLeaderboardService) {}

  @Get()
  async snapshot(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Query('period') period?: string,
  ) {
    return this.leaderboard.getSnapshot(Number(request.user.id), period);
  }
}
