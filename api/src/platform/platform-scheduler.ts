import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BookingTaskEntity } from './entities/booking-task.entity';
import { PlatformQueueService } from './platform-queue.service';
import { PlatformRedisService } from './platform-redis.service';
import { StatusEnum } from '../statuses/statuses.enum';
import { PlatformServiceConnectionsService } from './platform-service-connections.service';
import { PlatformAttendanceService } from './platform-attendance.service';

@Injectable()
export class PlatformScheduler {
  private readonly logger = new Logger(PlatformScheduler.name);

  constructor(
    @InjectRepository(BookingTaskEntity)
    private readonly tasks: Repository<BookingTaskEntity>,
    private readonly queue: PlatformQueueService,
    private readonly redis: PlatformRedisService,
    private readonly connections: PlatformServiceConnectionsService,
    private readonly attendance: PlatformAttendanceService,
  ) {}

  @Cron('0 */5 * * * *', { timeZone: 'Asia/Shanghai' })
  async recoverConnections(): Promise<void> {
    await this.connections.recoverDueConnections();
  }

  @Cron('0 * * * * *', { timeZone: 'Asia/Shanghai' })
  async protectAttendance(): Promise<void> {
    await this.attendance.monitorDueReservations();
  }

  @Cron('50 59 5 * * *', { timeZone: 'Asia/Shanghai' })
  async schedulePrewarm(): Promise<void> {
    await this.schedule('prewarm');
  }

  @Cron('0 0 6 * * *', { timeZone: 'Asia/Shanghai' })
  async scheduleBooking(): Promise<void> {
    await this.schedule('booking');
  }

  private async schedule(runType: 'prewarm' | 'booking'): Promise<void> {
    const date = getShanghaiDate();
    const lockKey = `platform:scheduler:${runType}:${date}`;
    const lock = await this.redis.tryLock(lockKey, 120);
    if (!lock) return;

    try {
      const tasks = await this.tasks.find({
        where: { enabled: true, user: { status: { id: StatusEnum.active } } },
        relations: ['user', 'schoolAccount'],
      });
      // Library tasks keep their own opt-in switch; everything else is due-based.
      const runnableTasks = tasks.filter(
        (task) =>
          isTaskDue(task, date) &&
          (task.venueType !== 'library' ||
            process.env.PLATFORM_LIBRARY_AUTO_BOOKING !== 'false'),
      );
      const results = await Promise.allSettled(
        runnableTasks.map((task) =>
          this.queue.enqueue(
            task,
            runType,
            date,
            runType === 'booking'
              ? task.runOffsetSeconds * 1000
              : task.prewarmOffsetSeconds * 1000,
          ),
        ),
      );
      const rejected = results.filter((result) => result.status === 'rejected');
      if (rejected.length) {
        this.logger.error(
          `Failed to schedule ${rejected.length}/${runnableTasks.length} ${runType} tasks for ${date}`,
        );
      }
      this.logger.log(
        `Scheduled ${runnableTasks.length - rejected.length}/${runnableTasks.length} ${runType} tasks for ${date}`,
      );
    } finally {
      await this.redis.unlock(lockKey, lock);
    }
  }
}

export function isTaskDue(task: BookingTaskEntity, date: string): boolean {
  if (task.scheduleMode === 'once') return task.targetDate === date;
  if (task.scheduleMode === 'dates') return task.scheduleDates.includes(date);
  if (task.scheduleMode === 'daily') return true;
  const weekday = new Date(`${date}T12:00:00+08:00`).getUTCDay();
  if (task.scheduleMode === 'weekdays') return weekday >= 1 && weekday <= 5;
  return task.scheduleWeekdays.includes(weekday);
}

function getShanghaiDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}
