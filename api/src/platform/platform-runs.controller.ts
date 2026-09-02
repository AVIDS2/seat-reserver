import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { RequestWithUser } from '../utils/types/request-with-user.type';
import { PlatformRunsService } from './platform-runs.service';

@ApiTags('Platform Runs')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'platform/runs', version: '1' })
export class PlatformRunsController {
  constructor(private readonly runs: PlatformRunsService) {}

  @Get()
  async list(@Request() request: RequestWithUser<JwtPayloadType>) {
    return { runs: await this.runs.list(Number(request.user.id)) };
  }

  @Get(':id')
  async detail(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return { run: await this.runs.findOwned(Number(request.user.id), id) };
  }
}
