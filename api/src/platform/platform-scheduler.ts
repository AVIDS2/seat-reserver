import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BookingTaskEntity } from './entities/booking-task.entity';
import { PlatformQueueService } from './platform-queue.service';
import { PlatformRedisService } from './platform-redis.service';
import { StatusEnum } from '../statuses/statuses.enum';

@Injectable()
export class PlatformScheduler {
  private readonly logger = new Logger(PlatformScheduler.name);

  constructor(
    @InjectRepository(BookingTaskEntity)
    private readonly tasks: Repository<BookingTaskEntity>,
    private readonly queue: PlatformQueueService,
    private readonly redis: PlatformRedisService,
  ) {}

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
      const runnableTasks = tasks.filter(
        (task) => task.scheduleMode === 'daily' || task.targetDate === date,
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
