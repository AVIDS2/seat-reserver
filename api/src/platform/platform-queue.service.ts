import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { In, Repository } from 'typeorm';
import { BookingRunEntity } from './entities/booking-run.entity';
import { BookingTaskEntity } from './entities/booking-task.entity';
import { PlatformRedisService } from './platform-redis.service';

export const PLATFORM_BOOKING_QUEUE = 'platform-booking';
export type PlatformJobData = { runId: number };

@Injectable()
export class PlatformQueueService {
  constructor(
    @InjectQueue(PLATFORM_BOOKING_QUEUE)
    private readonly queue: Queue<PlatformJobData>,
    @InjectRepository(BookingRunEntity)
    private readonly runs: Repository<BookingRunEntity>,
    private readonly redis: PlatformRedisService,
  ) {}

  async enqueue(
    task: BookingTaskEntity,
    runType: 'prewarm' | 'booking',
    targetDate: string,
    delay = 0,
  ): Promise<BookingRunEntity> {
    const lockKey = `platform:enqueue:${task.id}:${runType}:${targetDate}`;
    const lock = await this.redis.tryLock(lockKey, 15);
    if (!lock) {
      const existing = await this.findExisting(task, runType, targetDate);
      if (existing) return existing;
      throw new Error('任务正在排队，请稍后重试');
    }

    try {
      const existing = await this.findExisting(task, runType, targetDate);
      if (existing) return existing;

      const run = await this.runs.save(
        this.runs.create({
          runType,
          status: 'pending',
          targetDate,
          task,
          schoolAccount: task.schoolAccount,
          user: task.user,
          startedAt: null,
          finishedAt: null,
          message: null,
          receipt: null,
          location: null,
          reservedBegin: null,
          reservedEnd: null,
          httpStatus: null,
          responseCode: null,
          attemptsUsed: 0,
        }),
      );

      try {
        await this.queue.add(
          runType,
          { runId: run.id },
          {
            jobId: `platform-${runType}-${task.id}-${targetDate}`,
            delay: Math.max(0, delay),
            removeOnComplete: 100,
            removeOnFail: 200,
          },
        );
      } catch (error: unknown) {
        run.status = 'failed';
        run.message = '任务加入队列失败';
        await this.runs.save(run);
        throw error;
      }
      return run;
    } finally {
      await this.redis.unlock(lockKey, lock);
    }
  }

  private findExisting(
    task: BookingTaskEntity,
    runType: 'prewarm' | 'booking',
    targetDate: string,
  ): Promise<BookingRunEntity | null> {
    return this.runs.findOne({
      where: {
        task: { id: task.id },
        runType,
        targetDate,
        status: In(['pending', 'running', 'success']),
      },
      order: { createdAt: 'DESC' },
    });
  }
}
