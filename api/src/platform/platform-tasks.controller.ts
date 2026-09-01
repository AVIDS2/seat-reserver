import {
  Body,
  Controller,
  Delete,
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
  CreateBookingTaskDto,
  RunBookingDto,
  UpdateBookingTaskDto,
} from './dto/booking-task.dto';
import { PlatformTasksService } from './platform-tasks.service';

@ApiTags('Platform Tasks')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'platform/tasks', version: '1' })
export class PlatformTasksController {
  constructor(private readonly tasks: PlatformTasksService) {}

  @Get()
  async list(@Request() request: RequestWithUser<JwtPayloadType>) {
    return { tasks: await this.tasks.list(Number(request.user.id)) };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Body() dto: CreateBookingTaskDto,
  ) {
    return { task: await this.tasks.create(Number(request.user.id), dto) };
  }

  @Patch(':id')
  async update(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBookingTaskDto,
  ) {
    return { task: await this.tasks.update(Number(request.user.id), id, dto) };
  }

  @Post(':id/enable')
  async enable(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return { task: await this.tasks.toggle(Number(request.user.id), id, true) };
  }

  @Post(':id/disable')
  async disable(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return {
      task: await this.tasks.toggle(Number(request.user.id), id, false),
    };
  }

  @Post(':id/run')
  async run(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RunBookingDto,
  ) {
    return {
      run: await this.tasks.enqueue(
        Number(request.user.id),
        id,
        'booking',
        dto.targetDate,
      ),
    };
  }

  @Post(':id/prewarm')
  async prewarm(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RunBookingDto,
  ) {
    return {
      run: await this.tasks.enqueue(
        Number(request.user.id),
        id,
        'prewarm',
        dto.targetDate,
      ),
    };
  }

  @Post(':id/dry-run')
  async dryRun(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return {
      dryRun: await this.tasks.dryRun(Number(request.user.id), id),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.tasks.remove(Number(request.user.id), id);
  }
}
