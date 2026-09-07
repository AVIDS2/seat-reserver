import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchoolAccountEntity } from './entities/school-account.entity';
import { PlatformAttendanceSettingEntity } from './entities/platform-attendance-setting.entity';
import { PlatformReservationsService } from './platform-reservations.service';
import { PlatformNotificationsService } from './platform-notifications.service';
import { PlatformRedisService } from './platform-redis.service';
import type { UpdateAttendanceSettingDto } from './dto/platform-attendance.dto';
import type { ReservationView } from './platform-reservations.service';

export type AttendanceSettingView = {
  autoCancelNoShow: boolean;
  checkInAheadMinutes: number;
  lateAllowedMinutes: number;
  cancelLeadMinutes: number;
};

const CHECK_IN_AHEAD_MINUTES = 30;
const LATE_ALLOWED_MINUTES = 15;
const DEFAULT_CANCEL_LEAD_MINUTES = 1;

@Injectable()
export class PlatformAttendanceService {
  private readonly logger = new Logger(PlatformAttendanceService.name);

  constructor(
    @InjectRepository(PlatformAttendanceSettingEntity)
    private readonly settings: Repository<PlatformAttendanceSettingEntity>,
    @InjectRepository(SchoolAccountEntity)
    private readonly accounts: Repository<SchoolAccountEntity>,
    private readonly reservations: PlatformReservationsService,
    private readonly notifications: PlatformNotificationsService,
    private readonly redis: PlatformRedisService,
  ) {}

  async getSettings(userId: number): Promise<AttendanceSettingView> {
    const setting = await this.settings.findOne({
      where: { user: { id: userId } },
    });
    return this.toView(setting);
  }

  async updateSettings(
    userId: number,
    dto: UpdateAttendanceSettingDto,
  ): Promise<AttendanceSettingView> {
    let setting = await this.settings.findOne({
      where: { user: { id: userId } },
    });
    if (!setting) {
      setting = this.settings.create({
        user: { id: userId } as never,
        autoCancelNoShow: dto.autoCancelNoShow,
        graceMinutes: LATE_ALLOWED_MINUTES,
        leadMinutes: DEFAULT_CANCEL_LEAD_MINUTES,
      });
    } else {
      setting.autoCancelNoShow = dto.autoCancelNoShow;
    }
    return this.toView(await this.settings.save(setting));
  }

  async monitorDueReservations(): Promise<void> {
    const enabled = await this.settings.find({
      where: { autoCancelNoShow: true },
    });
    for (const setting of enabled) {
      await this.monitorUser(setting).catch((error: unknown) => {
        this.logger.warn(
          `签到保护检查失败 user=${setting.userId}: ${errorMessage(error)}`,
        );
      });
    }
  }

  private async monitorUser(setting: PlatformAttendanceSettingEntity) {
    const accounts = await this.accounts.find({
      where: { user: { id: setting.userId }, status: 'active' },
    });
    for (const account of accounts) {
      const reservations = await this.reservations.list(
        setting.userId,
        account.id,
        'study_room',
      );
      for (const reservation of reservations) {
        if (!this.shouldProtect(reservation, setting)) continue;
        const lockKey = `platform:attendance:auto-cancel:${setting.userId}:${account.id}:${reservation.id}`;
        const lock = await this.redis.tryLock(lockKey, 24 * 60 * 60);
        if (!lock) continue;
        let cancelled = false;
        try {
          await this.reservations.cancel(
            setting.userId,
            account.id,
            'study_room',
            reservation.id,
          );
          cancelled = true;
          await this.notifications.create({
            userId: setting.userId,
            kind: 'attendance_protection',
            title: '已为你取消未签到预约',
            body: `${reservation.location || '该座位'} 在签到截止前仍未签到，系统已自动取消，避免产生违约记录。`,
            actionUrl: '/dashboard/reservations',
          });
        } finally {
          if (!cancelled) await this.redis.unlock(lockKey, lock);
        }
      }
    }
  }

  private shouldProtect(
    reservation: ReservationView,
    setting: PlatformAttendanceSettingEntity,
  ): boolean {
    if (reservation.status !== 'upcoming' || reservation.checkedIn)
      return false;
    if (!reservation.canCancel) return false;
    const start = parseShanghaiDateTime(
      reservation.date,
      reservation.startTime,
    );
    if (!start) return false;
    const now = Date.now();
    const deadline = start.getTime() + setting.graceMinutes * 60 * 1000;
    const cancelAt = deadline - setting.leadMinutes * 60 * 1000;
    return now >= cancelAt && now <= deadline + 60 * 1000;
  }

  private toView(
    setting: PlatformAttendanceSettingEntity | null,
  ): AttendanceSettingView {
    return {
      autoCancelNoShow: setting?.autoCancelNoShow ?? false,
      checkInAheadMinutes: CHECK_IN_AHEAD_MINUTES,
      lateAllowedMinutes: setting?.graceMinutes ?? LATE_ALLOWED_MINUTES,
      cancelLeadMinutes: setting?.leadMinutes ?? DEFAULT_CANCEL_LEAD_MINUTES,
    };
  }
}

function parseShanghaiDateTime(date: string, time: string): Date | null {
  const dateMatch = date.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  const timeMatch = time.match(/^(\d{1,2}):(\d{2})/);
  if (!dateMatch || !timeMatch) return null;
  const [, year, month, day] = dateMatch;
  const [, hour, minute] = timeMatch;
  const parsed = new Date(
    `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}+08:00`,
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
