import {
  Body,
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
import { GrantProDto } from './dto/platform-growth.dto';
import { PlatformMembershipService } from './platform-membership.service';
import { PlatformRedisService } from './platform-redis.service';

@ApiTags('Platform Admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PlatformAdminGuard)
@Controller({ path: 'platform/admin', version: '1' })
export class PlatformAdminController {
  constructor(
    private readonly admin: PlatformAdminService,
    private readonly membership: PlatformMembershipService,
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

  @Get('accounts')
  async accounts() {
    return { accounts: await this.admin.listAccounts() };
  }

  @Get('tasks')
  async tasks() {
    return { tasks: await this.admin.listTasks() };
  }

  @Get('runs')
  async runs() {
    return { runs: await this.admin.listRuns() };
  }

  @Get('pro-requests')
  async proRequests() {
    return { requests: await this.membership.listProRequests() };
  }

  @Post('users/:id/pro')
  async grantPro(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GrantProDto,
  ) {
    return {
      membership: await this.membership.grantPro(
        Number(request.user.id),
        id,
        dto.note,
      ),
    };
  }

  @Post('pro-requests/:id/reject')
  async rejectProRequest(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GrantProDto,
  ) {
    return {
      request: await this.membership.rejectProRequest(
        Number(request.user.id),
        id,
        dto.note,
      ),
    };
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
}
