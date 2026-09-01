import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import {
  CreateBookingTaskDto,
  UpdateBookingTaskDto,
} from './dto/booking-task.dto';
import { BookingRunEntity } from './entities/booking-run.entity';
import { BookingTaskEntity } from './entities/booking-task.entity';
import { PlatformAccountsService } from './platform-accounts.service';
import { PlatformCryptoService } from './platform-crypto.service';
import { PlatformQueueService } from './platform-queue.service';
import { SeatClientService } from './seat-client.service';

export type BookingTaskView = {
  id: string;
  name: string;
  account: string;
  accountId: string;
  seat: string;
  seatId: string;
  time: string;
  nextRun: string;
  status: 'enabled' | 'paused' | 'attention';
  enabled: boolean;
  backupSeatIds: string[];
  timeCandidates: Array<{ start: number; end: number }>;
  maxAttempts: number;
  attemptDelaySeconds: number;
  bookingWindowSeconds: number;
  prewarmOffsetSeconds: number;
  runOffsetSeconds: number;
  lastRun: string;
  lastMessage: string;
};

export type DryRunView = {
  taskId: string;
  accountId: string;
  tokenStatus: 'valid' | 'missing' | 'invalid' | 'unavailable';
  candidates: Array<{
    order: number;
    seatId: string;
    startTime: number;
    endTime: number;
  }>;
  message: string;
};

@Injectable()
export class PlatformTasksService {
  constructor(
    @InjectRepository(BookingTaskEntity)
    private readonly tasks: Repository<BookingTaskEntity>,
    @InjectRepository(BookingRunEntity)
    private readonly runs: Repository<BookingRunEntity>,
    private readonly accounts: PlatformAccountsService,
    private readonly crypto: PlatformCryptoService,
    private readonly queue: PlatformQueueService,
    private readonly seatClient: SeatClientService,
  ) {}

  async list(userId: number): Promise<BookingTaskView[]> {
    const tasks = await this.tasks.find({
      where: { user: { id: userId } },
      relations: ['schoolAccount'],
      order: { createdAt: 'ASC' },
    });

    return Promise.all(tasks.map((task) => this.toView(task)));
  }

  async create(
    userId: number,
    dto: CreateBookingTaskDto,
  ): Promise<BookingTaskView> {
    validateTimeCandidates(dto.timeCandidates);
    const account = await this.accounts.findOwned(userId, dto.accountId);
    const task = this.tasks.create({
      name: dto.name.trim(),
      primarySeatId: dto.primarySeatId.trim(),
      backupSeatIds: dto.backupSeatIds ?? [],
      timeCandidates: dto.timeCandidates,
      maxAttempts: dto.maxAttempts ?? 12,
      attemptDelaySeconds: dto.attemptDelaySeconds ?? 1.2,
      bookingWindowSeconds: dto.bookingWindowSeconds ?? 20,
      prewarmOffsetSeconds: dto.prewarmOffsetSeconds ?? 0,
      runOffsetSeconds: dto.runOffsetSeconds ?? 1,
      enabled: dto.enabled ?? true,
      user: { id: userId } as UserEntity,
      schoolAccount: account,
    });

    return this.toView(await this.tasks.save(task));
  }

  async update(
    userId: number,
    id: number,
    dto: UpdateBookingTaskDto,
  ): Promise<BookingTaskView> {
    const task = await this.findOwned(userId, id);
    if (dto.timeCandidates) validateTimeCandidates(dto.timeCandidates);
    if (dto.accountId !== undefined)
      task.schoolAccount = await this.accounts.findOwned(userId, dto.accountId);
    Object.assign(task, {
      name: dto.name?.trim() ?? task.name,
      primarySeatId: dto.primarySeatId?.trim() ?? task.primarySeatId,
      backupSeatIds: dto.backupSeatIds ?? task.backupSeatIds,
      timeCandidates: dto.timeCandidates ?? task.timeCandidates,
      maxAttempts: dto.maxAttempts ?? task.maxAttempts,
      attemptDelaySeconds: dto.attemptDelaySeconds ?? task.attemptDelaySeconds,
      bookingWindowSeconds:
        dto.bookingWindowSeconds ?? task.bookingWindowSeconds,
      prewarmOffsetSeconds:
        dto.prewarmOffsetSeconds ?? task.prewarmOffsetSeconds,
      runOffsetSeconds: dto.runOffsetSeconds ?? task.runOffsetSeconds,
      enabled: dto.enabled ?? task.enabled,
    });
    return this.toView(await this.tasks.save(task));
  }

  async toggle(
    userId: number,
    id: number,
    enabled: boolean,
  ): Promise<BookingTaskView> {
    const task = await this.findOwned(userId, id);
    task.enabled = enabled;
    return this.toView(await this.tasks.save(task));
  }

  async remove(userId: number, id: number): Promise<void> {
    const task = await this.findOwned(userId, id);
    await this.tasks.softRemove(task);
  }

  async dryRun(userId: number, id: number): Promise<DryRunView> {
    const task = await this.findOwned(userId, id);
    const account = task.schoolAccount;
    const candidates = this.seatClient.buildCandidates(
      task.primarySeatId,
      task.backupSeatIds,
      task.timeCandidates,
    );
    let tokenStatus: DryRunView['tokenStatus'] = 'missing';
    if (account?.encryptedToken) {
      try {
        const token = this.crypto.decrypt(account.encryptedToken);
        tokenStatus = (await this.seatClient.verifyToken(token)).success
          ? 'valid'
          : 'invalid';
      } catch {
        tokenStatus = 'unavailable';
      }
    }
    return {
      taskId: String(task.id),
      accountId: String(task.schoolAccountId),
      tokenStatus,
      candidates: candidates.map((candidate, index) => ({
        order: index + 1,
        ...candidate,
      })),
      message:
        tokenStatus === 'valid'
          ? 'Token 有效；本次 dry-run 未发送预约请求。'
          : tokenStatus === 'missing'
            ? '尚未缓存 Token；本次 dry-run 未发送预约请求。'
            : 'Token 检查未通过；本次 dry-run 未发送预约请求。',
    };
  }

  async enqueue(
    userId: number,
    id: number,
    runType: 'prewarm' | 'booking',
    targetDate?: string,
  ) {
    const task = await this.findOwned(userId, id);
    if (!task.enabled && runType === 'booking') {
      throw new UnprocessableEntityException('任务已暂停');
    }
    return this.queue.enqueue(
      task,
      runType,
      targetDate ?? getShanghaiDate(),
      runType === 'booking'
        ? task.runOffsetSeconds * 1000
        : task.prewarmOffsetSeconds * 1000,
    );
  }

  async findOwned(userId: number, id: number): Promise<BookingTaskEntity> {
    const task = await this.tasks.findOne({
      where: { id, user: { id: userId } },
      relations: ['user', 'schoolAccount'],
    });
    if (!task) throw new NotFoundException('预约任务不存在');
    return task;
  }

  async toView(task: BookingTaskEntity): Promise<BookingTaskView> {
    const lastRun = await this.runs.findOne({
      where: { task: { id: task.id } },
      order: { createdAt: 'DESC' },
    });
    const account = task.schoolAccount;
    const hasIssue = account?.status !== 'active' || !account?.encryptedToken;
    const time = task.timeCandidates
      .map(({ start, end }) => `${formatTime(start)} - ${formatTime(end)}`)
      .join(' / ');

    return {
      id: String(task.id),
      name: task.name,
      account: account?.label ?? '未关联账号',
      accountId: String(task.schoolAccountId),
      seat: `${task.primarySeatId} 号`,
      seatId: task.primarySeatId,
      time,
      nextRun: task.enabled
        ? `明天 06:00:0${Math.min(task.runOffsetSeconds, 9)}`
        : '已暂停',
      status: hasIssue ? 'attention' : task.enabled ? 'enabled' : 'paused',
      enabled: task.enabled,
      backupSeatIds: task.backupSeatIds,
      timeCandidates: task.timeCandidates,
      maxAttempts: task.maxAttempts,
      attemptDelaySeconds: task.attemptDelaySeconds,
      bookingWindowSeconds: task.bookingWindowSeconds,
      prewarmOffsetSeconds: task.prewarmOffsetSeconds,
      runOffsetSeconds: task.runOffsetSeconds,
      lastRun: lastRun ? formatDate(lastRun.createdAt) : '尚未运行',
      lastMessage:
        lastRun?.message ??
        (hasIssue ? '账号授权需要检查' : '等待下一次自动执行'),
    };
  }
}

function validateTimeCandidates(
  candidates: Array<{ start: number; end: number }>,
) {
  if (!candidates.length)
    throw new UnprocessableEntityException('至少配置一个时间段');
  if (candidates.some(({ start, end }) => end <= start))
    throw new UnprocessableEntityException('结束时间必须晚于开始时间');
}

function formatTime(minutes: number): string {
  const hour = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0');
  const minute = (minutes % 60).toString().padStart(2, '0');
  return `${hour}:${minute}`;
}

function formatDate(value: Date): string {
  return value.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
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
