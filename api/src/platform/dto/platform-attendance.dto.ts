import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateAttendanceSettingDto {
  @ApiProperty({
    description: '预约开始后仍未签到时，是否在违约前自动取消',
    example: true,
  })
  @IsBoolean()
  autoCancelNoShow: boolean;
}
