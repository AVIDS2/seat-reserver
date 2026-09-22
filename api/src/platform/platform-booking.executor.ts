import {
  Injectable,
  Logger,
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
import { PlatformRewardsService } from './platform-rewards.service';
import { PlatformCaptchaSolverService } from './platform-captcha-solver.service';
import { StatusEnum } from '../statuses/statuses.enum';

type PreparedLibraryChallenge = {
  challengeToken: string;
  provider: string;
  model: string;
  latencyMs: number;
};

/** Upper bound on captcha challenges solved during prewarm for one task. */
const PREPARED_CAPTCHA_LIMIT = 6;
/** Long enough to cover the gap between prewarm (05:59:50) and the open window. */
const PREPARED_CAPTCHA_TTL_SECONDS = 15 * 60;

@Injectable()
export class PlatformBookingExecutor {
  private readonly logger = new Logger(PlatformBookingExecutor.name);

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
    private readonly rewards: PlatformRewardsService,
    private readonly captchaSolver: PlatformCaptchaSolverService,
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
    let message = '账号检查完成';
    if (task.venueType === 'library' && account.schoolCode !== 'njtech') {
      const prepared = await this.prepareLibraryChallenges(run, task, account);
      message = prepared.captchaCount
        ? `预约准备完成；已准备 ${prepared.captchaCount} 个验证`
        : `预约准备完成；验证准备跳过（${prepared.detail}）`;
    }
    run.status = 'success';
    run.finishedAt = new Date();
    run.attemptsUsed = 1;
    run.message = message;
    await this.runs.save(run);
    await this.notify(
      run.userId,
      'prewarm',
      '账号检查完成',
      message,
      '/dashboard/accounts',
    );
  }

  /**
   * Solves the library captcha ahead of the booking window so the open moment only
   * needs the actual submit. The school may still reject a stale challenge, so the
   * booking pass falls back to solving inline when nothing usable is cached.
   */
  private async prepareLibraryChallenges(
    run: BookingRunEntity,
    task: BookingTaskEntity,
    account: SchoolAccountEntity,
  ): Promise<{ captchaCount: number; detail: string }> {
    if (account.schoolCode !== 'njtech' && !this.captchaSolver.isConfigured()) {
      return { captchaCount: 0, detail: '未配置识别服务' };
    }
    const service = await this.serviceConnections.ensureReady(
      account,
      'library',
    );
    const candidates = this.seatClient.buildCandidates(
      task.primarySeatId,
      task.backupSeatIds,
      task.timeCandidates,
    );
    const wanted = Math.min(
      Math.max(task.maxAttempts, 1),
      candidates.length,
      PREPARED_CAPTCHA_LIMIT,
    );
    const prepared: PreparedLibraryChallenge[] = [];
    for (let index = 0; index < wanted; index += 1) {
      try {
        const challenge = await this.schoolAuth.createBookingCaptcha(
          service.token,
          account.schoolCode,
        );
        const solved = await this.captchaSolver.solve({
          image: challenge.image,
          wordImage: challenge.wordImage,
          requiredClicks: challenge.requiredClicks,
        });
        const verified = await this.schoolAuth.verifyBookingCaptcha(
          service.token,
          challenge.token,
          solved.points,
          account.schoolCode,
        );
        if (!verified.success) continue;
        prepared.push({
          challengeToken: challenge.token,
          provider: solved.provider,
          model: solved.model,
          latencyMs: solved.latencyMs,
        });
      } catch (error: unknown) {
        this.logger.warn(
          `验证码预解失败 run=${run.id} 第 ${index + 1} 个：${safeErrorMessage(error)}`,
        );
        break;
      }
    }
    if (prepared.length) {
      await this.redis.setJson(
        preparedCaptchaKey(task.id, run.targetDate),
        prepared,
        PREPARED_CAPTCHA_TTL_SECONDS,
      );
    }
    return {
      captchaCount: prepared.length,
      detail: prepared.length ? '可用' : '学校未通过预解结果',
    };
  }

  private async executeLibraryBooking(
    run: BookingRunEntity,
    task: BookingTaskEntity,
    account: SchoolAccountEntity,
  ): Promise<void> {
    if (account.schoolCode !== 'njtech' && !this.captchaSolver.isConfigured()) {
      throw new UnprocessableEntityException(
        '图书馆自动抢座需要配置验证码识别服务',
      );
    }
    const service = await this.serviceConnections.ensureReady(
      account,
      'library',
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
    const preparedKey = preparedCaptchaKey(task.id, run.targetDate);
    const prepared =
      (await this.redis.getJson<PreparedLibraryChallenge[]>(preparedKey)) || [];
    let lastMessage = '预约窗口结束';
    let solvedInline = 0;

    for (let index = 0; index < maxAttempts; index += 1) {
      const remainingMs = deadline - Date.now();
      if (remainingMs < 500) break;

      let authId =
        account.schoolCode === 'njtech'
          ? undefined
          : prepared[index]?.challengeToken;
      if (account.schoolCode !== 'njtech' && !authId) {
        try {
          const challenge = await this.schoolAuth.createBookingCaptcha(token);
          const solved = await this.captchaSolver.solve({
            image: challenge.image,
            wordImage: challenge.wordImage,
            requiredClicks: challenge.requiredClicks,
          });
          const verified = await this.schoolAuth.verifyBookingCaptcha(
            token,
            challenge.token,
            solved.points,
            account.schoolCode,
          );
          if (!verified.success) {
            lastMessage = verified.message || '验证码自动识别未通过';
            continue;
          }
          solvedInline += 1;
          authId = challenge.token;
        } catch (error: unknown) {
          lastMessage = safeErrorMessage(error);
          this.logger.warn(`窗口内识别失败 run=${run.id}：${lastMessage}`);
          break;
        }
      }

      const candidate = task.roomId
        ? { ...candidates[index], roomId: task.roomId }
        : candidates[index];
      const timeoutMs = Math.min(5000, Math.max(500, deadline - Date.now()));
      const response = account.schoolCode
        ? await this.schoolAuth.book(
            token,
            service.mode,
            run.targetDate,
            { ...candidate, authId },
            timeoutMs,
            'library',
            account.schoolCode,
          )
        : await this.schoolAuth.book(
            token,
            service.mode,
            run.targetDate,
            { ...candidate, authId },
            timeoutMs,
            'library',
          );
      run.attemptsUsed = index + 1;
      run.httpStatus = response.httpStatus;
      run.responseCode = response.code || null;
      lastMessage = response.message || '预约失败';

      if (response.success) {
        await this.redis.delete(preparedKey);
        const data =
          response.payload?.data && typeof response.payload.data === 'object'
            ? (response.payload.data as Record<string, unknown>)
            : {};
        run.status = 'success';
        run.finishedAt = new Date();
        run.message = solvedInline
          ? `预约成功（窗口内识别 ${solvedInline} 次）`
          : '预约成功（使用预解验证码）';
        run.receipt = stringValue(data.receipt);
        run.location = stringValue(data.location);
        run.reservedBegin = stringValue(data.begin);
        run.reservedEnd = stringValue(data.end);
        await this.runs.save(run);
        const durationMinutes = durationBetween(
          run.reservedBegin,
          run.reservedEnd,
        );
        let rewardPoints = 0;
        if (durationMinutes > 0) {
          rewardPoints = await this.rewards
            .recordBookingReward(
              run.userId,
              run.id,
              durationMinutes,
              run.targetDate,
            )
            .catch((error: unknown) => {
              this.logger.warn(
                `预约金币奖励写入失败 run=${run.id}: ${safeErrorMessage(error)}`,
              );
              return 0;
            });
        }
        if (task.scheduleMode === 'once') {
          task.enabled = false;
          await this.tasks.save(task);
        }
        await this.notify(
          run.userId,
          'booking_success',
          '预约成功',
          `${run.location ?? '目标座位'} · ${run.reservedBegin ?? ''}-${run.reservedEnd ?? ''}${rewardPoints ? ` · +${rewardPoints} 席定币` : ''}`,
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
    if (
      account.schoolCode === 'njtech' &&
      run.targetDate !== getShanghaiDate()
    ) {
      throw new UnprocessableEntityException('南京工业大学目前只支持当天预约');
    }
    if (task.venueType === 'library') {
      await this.executeLibraryBooking(run, task, account);
      return;
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

      const candidate = task.roomId
        ? { ...candidates[index], roomId: task.roomId }
        : candidates[index];
      const timeoutMs = Math.min(3000, remainingMs);
      const response = account.schoolCode
        ? await this.schoolAuth.book(
            token,
            service.mode,
            run.targetDate,
            candidate,
            timeoutMs,
            'study_room',
            account.schoolCode,
          )
        : await this.schoolAuth.book(
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
        const durationMinutes = durationBetween(
          run.reservedBegin,
          run.reservedEnd,
        );
        let rewardPoints = 0;
        if (durationMinutes > 0) {
          rewardPoints = await this.rewards
            .recordBookingReward(
              run.userId,
              run.id,
              durationMinutes,
              run.targetDate,
            )
            .catch((error: unknown) => {
              this.logger.warn(
                `预约金币奖励写入失败 run=${run.id}: ${safeErrorMessage(error)}`,
              );
              return 0;
            });
        }
        if (task.scheduleMode === 'once') {
          task.enabled = false;
          await this.tasks.save(task);
        }
        await this.notify(
          run.userId,
          'booking_success',
          '预约成功',
          `${run.location ?? '目标座位'} · ${run.reservedBegin ?? ''}-${run.reservedEnd ?? ''}${rewardPoints ? ` · +${rewardPoints} 席定币` : ''}`,
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
      run.runType === 'prewarm' ? '账号检查失败' : '预约未成功',
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

function preparedCaptchaKey(taskId: number, date: string): string {
  return `platform:library-captcha:${taskId}:${date}`;
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

function durationBetween(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const parse = (value: string) => {
    const match = value.match(/^(\d{1,2}):(\d{2})/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : NaN;
  };
  const startMinutes = parse(start);
  const endMinutes = parse(end);
  return Number.isFinite(startMinutes) &&
    Number.isFinite(endMinutes) &&
    endMinutes > startMinutes
    ? endMinutes - startMinutes
    : 0;
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
