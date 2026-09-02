import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { RequestWithUser } from '../utils/types/request-with-user.type';
import { PlatformNotificationsService } from './platform-notifications.service';

@ApiTags('Platform Notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'platform/notifications', version: '1' })
export class PlatformNotificationsController {
  constructor(private readonly notifications: PlatformNotificationsService) {}

  @Get()
  async list(@Request() request: RequestWithUser<JwtPayloadType>) {
    return {
      notifications: await this.notifications.list(Number(request.user.id)),
    };
  }

  @Patch(':id/read')
  async markRead(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return {
      notification: await this.notifications.markRead(
        Number(request.user.id),
        id,
      ),
    };
  }

  @Patch('read-all')
  async markAllRead(@Request() request: RequestWithUser<JwtPayloadType>) {
    await this.notifications.markAllRead(Number(request.user.id));
    return { ok: true };
  }
}
