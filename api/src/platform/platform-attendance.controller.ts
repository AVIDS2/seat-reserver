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
import { UpdateAttendanceSettingDto } from './dto/platform-attendance.dto';
import { PlatformAttendanceService } from './platform-attendance.service';

@ApiTags('Platform Attendance')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'platform/attendance', version: '1' })
export class PlatformAttendanceController {
  constructor(private readonly attendance: PlatformAttendanceService) {}

  @Get('settings')
  async settings(@Request() request: RequestWithUser<JwtPayloadType>) {
    return {
      settings: await this.attendance.getSettings(Number(request.user.id)),
    };
  }

  @Patch('settings')
  async updateSettings(
    @Request() request: RequestWithUser<JwtPayloadType>,
    @Body() dto: UpdateAttendanceSettingDto,
  ) {
    return {
      settings: await this.attendance.updateSettings(
        Number(request.user.id),
        dto,
      ),
    };
  }
}
