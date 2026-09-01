import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { RequestWithUser } from '../utils/types/request-with-user.type';
import { PlatformAdminGuard } from './platform-admin.guard';
import { PlatformAdminService } from './platform-admin.service';
import { PlatformInvitationsService } from './platform-invitations.service';
import { PlatformRedisService } from './platform-redis.service';

@ApiTags('Platform Admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PlatformAdminGuard)
@Controller({ path: 'platform/admin', version: '1' })
export class PlatformAdminController {
  constructor(
    private readonly admin: PlatformAdminService,
    private readonly invitations: PlatformInvitationsService,
    private readonly redis: PlatformRedisService,
  ) {}

  @Get('overview')
  async overview() {
    return this.admin.overview((await this.redis.ping()) ? 'ok' : 'degraded');
  }

  @Get('users')
  async users() {
    return { users: await this.admin.listUsers() };
  }

  @Post('users/:id/enable')
  async enable(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return {
      user: await this.admin.setStatus(Number(request.user.id), id, 'active'),
    };
  }

  @Post('users/:id/disable')
  async disable(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return {
      user: await this.admin.setStatus(Number(request.user.id), id, 'disabled'),
    };
  }

  @Get('invitations')
  async invitationList() {
    return { invitations: await this.invitations.list() };
  }
}
