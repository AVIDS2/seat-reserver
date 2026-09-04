import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BookingRunEntity } from './entities/booking-run.entity';
import { BookingTaskEntity } from './entities/booking-task.entity';
import { SchoolAccountEntity } from './entities/school-account.entity';
import { SeatClientService } from './seat-client.service';
import { SchoolAuthenticationService } from './school-authentication.service';
import { PlatformServiceConnectionsService } from './platform-service-connections.service';
import { PlatformNotificationsService } from './platform-notifications.service';
import { PlatformRedisService } from './platform-redis.service';
import { StatusEnum } from '../statuses/statuses.enum';

@Injectable()
export class PlatformBookingExecutor {
  constructor(
    @InjectRepository(BookingRunEntity)
    private readonly runs: Repository<BookingRunEntity>,
    @InjectRepository(BookingTaskEntity)
    private readonly tasks: Repository<BookingTaskEntity>,
    @InjectRepository(SchoolAccountEntity)
    private readonly accounts: Repository<SchoolAccountEntity>,
    private readonly seatClient: SeatClientService,
    private readonly schoolAuth: SchoolAuthenticationService,
    private readonly serviceConnections: PlatformServiceConnectionsService,
    private readonly notifications: PlatformNotificationsService,
    private readonly redis: PlatformRedisService,
  ) {}

  async execute(runId: number): Promise<void> {
    const lockKey = `platform:run:${runId}`;
    const lock = await this.redis.tryLock(lockKey, 300);
    if (!lock) return;
    try {
      const run = await this.runs.findOne({
        where: { id: runId },
        relations: ['task', 'task.schoolAccount', 'schoolAccount', 'user'],
      });
      if (!run) throw new NotFoundException('运行记录不存在');

      run.status = 'running';
      run.startedAt = new Date();
      await this.runs.save(run);

      if (Number(run.user?.status?.id) !== StatusEnum.active) {
        run.status = 'skipped';
        run.finishedAt = new Date();
        run.message = '用户账号已禁用，跳过本次执行';
        await this.runs.save(run);
        return;
      }

      try {
        if (run.runType === 'prewarm') {
          await this.executePrewarm(run);
        } else {
          await this.executeBooking(run);
        }
      } catch (error: unknown) {
        run.status = 'failed';
        run.finishedAt = new Date();
        run.message = safeErrorMessage(error);
        await this.runs.save(run);
        await this.notifyRunFailure(run);
      }
    } finally {
      await this.redis.unlock(lockKey, lock);
    }
  }

  private async executePrewarm(run: BookingRunEntity): Promise<void> {
    const account = await this.getAccount(run);
    const task = await this.getTask(run);
    await this.serviceConnections.ensureReady(
      account,
      serviceType(task.venueType),
      true,
    );
    run.status = 'success';
    run.finishedAt = new Date();
    run.attemptsUsed = 1;
    run.message = 'Token 预热成功';
    await this.runs.save(run);
    await this.notify(
      run.userId,
      'prewarm',
      '账号预热完成',
      '预约前 Token 已通过正常登录和用户接口验证。',
      '/dashboard/accounts',
    );
  }

  private async executeBooking(run: BookingRunEntity): Promise<void> {
    const account = await this.getAccount(run);
    const task = await this.getTask(run);
    if (
      Number(account.userId) !== Number(run.userId) ||
      Number(task.userId) !== Number(run.userId) ||
      Number(task.schoolAccountId) !== Number(account.id)
    ) {
      throw new UnprocessableEntityException('任务账号归属校验失败');
    }
    if (!task.enabled) {
      run.status = 'skipped';
      run.finishedAt = new Date();
      run.message = '任务已暂停，跳过本次预约';
      await this.runs.save(run);
      return;
    }
    if (task.venueType === 'library') {
      throw new UnprocessableEntityException(
        '图书馆当前要求预约前完成验证码验证，请在控制台手动确认后提交',
      );
    }
    const service = await this.serviceConnections.ensureReady(
      account,
      'study_room',
    );
    const token = service.token;

    const candidates = this.seatClient.buildCandidates(
      task.primarySeatId,
      task.backupSeatIds,
      task.timeCandidates,
    );
    const maxAttempts = Math.min(
      Math.max(task.maxAttempts, 1),
      candidates.length,
    );
    const deadline = Date.now() + Math.max(1, task.bookingWindowSeconds) * 1000;
    let lastMessage = '预约窗口结束';

    for (let index = 0; index < maxAttempts; index += 1) {
      const remainingMs = deadline - Date.now();
      if (remainingMs < 500) break;

      const candidate = candidates[index];
      const timeoutMs = Math.min(3000, remainingMs);
      const response = await this.schoolAuth.book(
        token,
        service.mode,
        run.targetDate,
        candidate,
        timeoutMs,
        'study_room',
      );
      run.attemptsUsed = index + 1;
      run.httpStatus = response.httpStatus;
      run.responseCode = response.code || null;
      lastMessage = response.message || '预约失败';

      if (response.success) {
        const data =
          response.payload?.data && typeof response.payload.data === 'object'
            ? (response.payload.data as Record<string, unknown>)
            : {};
        run.status = 'success';
        run.finishedAt = new Date();
        run.message = '预约成功';
        run.receipt = stringValue(data.receipt);
        run.location = stringValue(data.location);
        run.reservedBegin = stringValue(data.begin);
        run.reservedEnd = stringValue(data.end);
        await this.runs.save(run);
        if (task.scheduleMode === 'once') {
          task.enabled = false;
          await this.tasks.save(task);
        }
        await this.notify(
          run.userId,
          'booking_success',
          '预约成功',
          `${run.location ?? '目标座位'} · ${run.reservedBegin ?? ''}-${run.reservedEnd ?? ''}`,
          '/dashboard/runs',
        );
        return;
      }

      const waitMs = Math.min(
        Math.max(task.attemptDelaySeconds, 0) * 1000,
        Math.max(0, deadline - Date.now()),
      );
      if (waitMs > 0 && index + 1 < maxAttempts) await sleep(waitMs);
    }

    run.status = 'failed';
    run.finishedAt = new Date();
    run.message = lastMessage;
    await this.runs.save(run);
    await this.notifyRunFailure(run);
  }

  private async notifyRunFailure(run: BookingRunEntity): Promise<void> {
    await this.notify(
      run.userId,
      run.runType === 'prewarm' ? 'prewarm_failed' : 'booking_failed',
      run.runType === 'prewarm' ? '账号预热失败' : '预约未成功',
      run.message ?? '任务执行失败，请查看运行记录。',
      run.runType === 'prewarm' ? '/dashboard/accounts' : '/dashboard/runs',
    );
  }

  private async notify(
    userId: number,
    kind: string,
    title: string,
    body: string,
    actionUrl: string,
  ): Promise<void> {
    try {
      await this.notifications.create({ userId, kind, title, body, actionUrl });
    } catch {
      // A notification failure must never change the booking result.
    }
  }

  private async getAccount(
    run: BookingRunEntity,
  ): Promise<SchoolAccountEntity> {
    const account =
      run.schoolAccount ||
      (await this.accounts.findOne({ where: { id: run.schoolAccountId } }));
    if (!account) throw new NotFoundException('预约账号不存在');
    return account;
  }

  private async getTask(run: BookingRunEntity): Promise<BookingTaskEntity> {
    const task =
      run.task || (await this.tasks.findOne({ where: { id: run.taskId } }));
    if (!task) throw new NotFoundException('预约任务不存在');
    return task;
  }
}

function serviceType(
  venueType: BookingTaskEntity['venueType'],
): 'study_room' | 'library' {
  return venueType === 'library' ? 'library' : 'study_room';
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message)
    return error.message.slice(0, 240);
  return '任务执行失败';
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
