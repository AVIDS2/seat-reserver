import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { RoleEnum } from '../roles/roles.enum';
import { RequestWithUser } from '../utils/types/request-with-user.type';
import { CreateInvitationDto } from './dto/invitation.dto';
import { PlatformInvitationsService } from './platform-invitations.service';

@ApiTags('Platform Invitations')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'platform/invitations', version: '1' })
export class PlatformInvitationsController {
  constructor(private readonly invitations: PlatformInvitationsService) {}

  @Get()
  async list(@Request() request: RequestWithUser<JwtPayloadType>) {
    this.assertAdmin(request);
    return { invitations: await this.invitations.list() };
  }

  @Post()
  async create(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Body() dto: CreateInvitationDto,
  ) {
    this.assertAdmin(request);
    return {
      invitation: await this.invitations.create(Number(request.user.id), dto),
    };
  }

  @Delete(':id')
  async disable(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.assertAdmin(request);
    return { invitation: await this.invitations.disable(id) };
  }

  private assertAdmin(request: RequestWithUser<JwtPayloadType>): void {
    if (Number(request.user.role?.id) !== RoleEnum.admin) {
      throw new HttpException('需要管理员权限', HttpStatus.FORBIDDEN);
    }
  }
}
