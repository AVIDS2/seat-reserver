import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { RequestWithUser } from '../utils/types/request-with-user.type';
import {
  CreateFocusRoomDto,
  JoinFocusRoomDto,
  UpdateFocusPresenceDto,
} from './dto/platform-focus-room.dto';
import { PlatformFocusRoomsService } from './platform-focus-rooms.service';

@ApiTags('Platform Focus Rooms')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'platform/focus-rooms', version: '1' })
export class PlatformFocusRoomsController {
  constructor(private readonly focusRooms: PlatformFocusRoomsService) {}

  @Get()
  async list(@Request() request: RequestWithUser<JwtPayloadType>) {
    return this.focusRooms.list(Number(request.user.id));
  }

  @Post()
  async create(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Body() dto: CreateFocusRoomDto,
  ) {
    return {
      room: await this.focusRooms.create(Number(request.user.id), dto),
    };
  }

  @Post('join')
  async join(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Body() dto: JoinFocusRoomDto,
  ) {
    return {
      room: await this.focusRooms.join(Number(request.user.id), dto.code),
    };
  }

  @Get(':id')
  async get(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return { room: await this.focusRooms.get(Number(request.user.id), id) };
  }

  @Post(':id/heartbeat')
  async heartbeat(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return {
      room: await this.focusRooms.heartbeat(Number(request.user.id), id),
    };
  }

  @Patch(':id/me')
  async updatePresence(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFocusPresenceDto,
  ) {
    return {
      room: await this.focusRooms.setFocus(
        Number(request.user.id),
        id,
        dto.focused,
      ),
    };
  }

  @Post(':id/timer/:action')
  async timerAction(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Param('id', ParseIntPipe) id: number,
    @Param('action') action: 'start' | 'pause' | 'reset',
  ) {
    if (!['start', 'pause', 'reset'].includes(action)) {
      throw new BadRequestException('不支持的计时操作');
    }
    return {
      room: await this.focusRooms.timerAction(
        Number(request.user.id),
        id,
        action,
      ),
    };
  }

  @Post(':id/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  async leave(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.focusRooms.leave(Number(request.user.id), id);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.NO_CONTENT)
  async close(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.focusRooms.close(Number(request.user.id), id);
  }
}
