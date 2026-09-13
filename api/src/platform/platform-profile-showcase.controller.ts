import {
  Body,
  Controller,
  Get,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { RequestWithUser } from '../utils/types/request-with-user.type';
import { PlatformProfileShowcaseDto } from './dto/platform-profile-showcase.dto';
import { PlatformProfileShowcaseService } from './platform-profile-showcase.service';

@ApiTags('Platform Profile Showcase')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'platform/profile/showcase', version: '1' })
export class PlatformProfileShowcaseController {
  constructor(private readonly showcase: PlatformProfileShowcaseService) {}

  @Get()
  async get(@Request() request: RequestWithUser<JwtPayloadType>) {
    return this.showcase.getShowcase(Number(request.user.id));
  }

  @Patch()
  async update(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Body() dto: PlatformProfileShowcaseDto,
  ) {
    return this.showcase.updateShowcase(Number(request.user.id), dto);
  }
}
