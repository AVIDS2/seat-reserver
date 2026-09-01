import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { RequestWithUser } from '../utils/types/request-with-user.type';
import { CreateInvitationDto } from './dto/invitation.dto';
import { PlatformAdminGuard } from './platform-admin.guard';
import { PlatformInvitationsService } from './platform-invitations.service';

@ApiTags('Platform Admin Invitations')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PlatformAdminGuard)
@Controller({ path: 'platform/admin/invitations', version: '1' })
export class PlatformAdminInvitationController {
  constructor(private readonly invitations: PlatformInvitationsService) {}

  @Post()
  async create(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Body() dto: CreateInvitationDto,
  ) {
    return {
      invitation: await this.invitations.create(Number(request.user.id), dto),
    };
  }
}
