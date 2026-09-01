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
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CreateSchoolAccountDto,
  UpdateSchoolAccountDto,
} from './dto/school-account.dto';
import { PlatformAccountsService } from './platform-accounts.service';
import { RequestWithUser } from '../utils/types/request-with-user.type';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';

@ApiTags('Platform Accounts')
@ApiBearerAuth()
@Throttle({ default: { limit: 20, ttl: 60_000, blockDuration: 60_000 } })
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'platform/accounts', version: '1' })
export class PlatformAccountsController {
  constructor(private readonly accounts: PlatformAccountsService) {}

  @Get()
  async list(@Request() request: RequestWithUser<JwtPayloadType>) {
    return { accounts: await this.accounts.list(Number(request.user.id)) };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Body() dto: CreateSchoolAccountDto,
  ) {
    return {
      account: await this.accounts.create(Number(request.user.id), dto),
    };
  }

  @Post(':id/refresh')
  async refresh(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return {
      account: await this.accounts.refresh(Number(request.user.id), id),
    };
  }

  @Patch(':id')
  async update(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSchoolAccountDto,
  ) {
    return {
      account: await this.accounts.update(Number(request.user.id), id, dto),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.accounts.remove(Number(request.user.id), id);
  }
}
