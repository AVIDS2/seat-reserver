import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { RequestWithUser } from '../utils/types/request-with-user.type';
import { PlatformMembershipService } from './platform-membership.service';
import { PlatformRewardsService } from './platform-rewards.service';

@ApiTags('Platform Rewards')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'platform/rewards', version: '1' })
export class PlatformRewardsController {
  constructor(
    private readonly rewards: PlatformRewardsService,
    private readonly membership: PlatformMembershipService,
  ) {}

  @Get()
  async snapshot(@Request() request: RequestWithUser<JwtPayloadType>) {
    return this.rewards.getSnapshot(Number(request.user.id));
  }

  @Post('check-in')
  @HttpCode(HttpStatus.OK)
  async checkIn(@Request() request: RequestWithUser<JwtPayloadType>) {
    return {
      result: await this.rewards.checkIn(Number(request.user.id)),
    };
  }

  @Post('activities/:activityId/claim')
  @HttpCode(HttpStatus.OK)
  async claimActivity(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Param('activityId') activityId: string,
  ) {
    return {
      result: await this.rewards.claimActivity(
        Number(request.user.id),
        activityId,
      ),
    };
  }

  @Post('invite-codes')
  @HttpCode(HttpStatus.CREATED)
  async redeemInvitation(@Request() request: RequestWithUser<JwtPayloadType>) {
    return {
      result: await this.rewards.redeemInvitation(Number(request.user.id)),
    };
  }

  @Post('pro-request')
  async requestPro(@Request() request: RequestWithUser<JwtPayloadType>) {
    return this.membership.requestPro(Number(request.user.id));
  }
}
