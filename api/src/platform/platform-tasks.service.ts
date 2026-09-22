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
import { PlatformQueueService } from './platform-queue.service';
import { SeatClientService } from './seat-client.service';
import { PlatformServiceConnectionsService } from './platform-service-connections.service';
import { PlatformCaptchaSolverService } from './platform-captcha-solver.service';
import { bookingWindow, maxBookingMinutes } from './booking-time.constants';

export type BookingTaskView = {
  id: string;
  name: string;
  venueType: 'library' | 'study_room' | 'other';
  building: string;
  roomName: string;
  buildingId: string | null;
  roomId: string | null;
  scheduleMode: 'daily' | 'weekdays' | 'weekly' | 'dates' | 'once';
  scheduleWeekdays: number[];
  scheduleDates: string[];
  targetDate: string | null;
  seatLabel: string | null;
  account: string;
  accountId: string;
  seat: string;
  seatId: string;
  time: string;
  nextRun: string;
  status: 'enabled' | 'paused' | 'attention';
  enabled: boolean;
  backupSeatIds: string[];
  backupSeatLabels: string[];
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
    seatLabel: string;
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
    private readonly queue: PlatformQueueService,
    private readonly seatClient: SeatClientService,
    private readonly serviceConnections: PlatformServiceConnectionsService,
    private readonly captchaSolver: PlatformCaptchaSolverService,
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
    const venueType = dto.venueType ?? 'study_room';
    const scheduleMode = dto.scheduleMode ?? 'daily';
    const scheduleWeekdays = normalizeWeekdays(dto.scheduleWeekdays);
    const scheduleDates = normalizeDates(dto.scheduleDates);
    validateSchedule(
      scheduleMode,
      dto.targetDate,
      scheduleWeekdays,
      scheduleDates,
    );
    const account = await this.accounts.findOwned(userId, dto.accountId);
    validateTimeCandidates(dto.timeCandidates, venueType, account.schoolCode);
    const task = this.tasks.create({
      name: requireText(dto.name, '任务名称'),
      venueType,
      building: optionalText(dto.building, '未指定'),
      roomName: optionalText(dto.roomName, '未指定'),
      buildingId: nullableText(dto.buildingId),
      roomId: nullableText(dto.roomId),
      scheduleMode,
      scheduleWeekdays,
      scheduleDates: scheduleMode === 'dates' ? scheduleDates : [],
      targetDate: scheduleMode === 'once' ? (dto.targetDate ?? null) : null,
      primarySeatId: requireText(dto.primarySeatId, '主座位'),
      primarySeatLabel: nullableText(dto.primarySeatLabel),
      backupSeatIds: normalizeSeatIds(dto.backupSeatIds ?? []),
      backupSeatLabels: normalizeSeatIds(dto.backupSeatLabels ?? []),
      timeCandidates: dto.timeCandidates,
      maxAttempts: dto.maxAttempts ?? 12,
      attemptDelaySeconds: dto.attemptDelaySeconds ?? 1.2,
      bookingWindowSeconds: dto.bookingWindowSeconds ?? 20,
      prewarmOffsetSeconds: dto.prewarmOffsetSeconds ?? 0,
      runOffsetSeconds: dto.runOffsetSeconds ?? 1,
      enabled:
        venueType === 'library' &&
        account.schoolCode !== 'njtech' &&
        !this.captchaSolver.isConfigured()
          ? false
          : (dto.enabled ?? true),
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
    const targetVenueType = dto.venueType ?? task.venueType;
    const scheduleMode = dto.scheduleMode ?? task.scheduleMode;
    const scheduleWeekdays = normalizeWeekdays(
      dto.scheduleWeekdays === undefined
        ? task.scheduleWeekdays
        : dto.scheduleWeekdays,
    );
    const scheduleDates = normalizeDates(
      dto.scheduleDates === undefined ? task.scheduleDates : dto.scheduleDates,
    );
    validateSchedule(
      scheduleMode,
      dto.targetDate === undefined ? task.targetDate : dto.targetDate,
      scheduleWeekdays,
      scheduleDates,
    );
    const account =
      dto.accountId === undefined
        ? task.schoolAccount
        : await this.accounts.findOwned(userId, dto.accountId);
    if (dto.timeCandidates)
      validateTimeCandidates(
        dto.timeCandidates,
        targetVenueType,
        account.schoolCode,
      );
    const enabled =
      targetVenueType === 'library' &&
      account.schoolCode !== 'njtech' &&
      !this.captchaSolver.isConfigured()
        ? false
        : (dto.enabled ?? task.enabled);
    task.schoolAccount = account;
    Object.assign(task, {
      name:
        dto.name === undefined ? task.name : requireText(dto.name, '任务名称'),
      venueType: targetVenueType,
      building:
        dto.building === undefined
          ? task.building
          : optionalText(dto.building, '未指定'),
      roomName:
        dto.roomName === undefined
          ? task.roomName
          : optionalText(dto.roomName, '未指定'),
      buildingId:
        dto.buildingId === undefined
          ? task.buildingId
          : nullableText(dto.buildingId),
      roomId: dto.roomId === undefined ? task.roomId : nullableText(dto.roomId),
      scheduleMode,
      scheduleWeekdays,
      scheduleDates: scheduleMode === 'dates' ? scheduleDates : [],
      targetDate:
        scheduleMode === 'once'
          ? dto.targetDate === undefined
            ? task.targetDate
            : dto.targetDate
          : null,
      primarySeatId:
        dto.primarySeatId === undefined
          ? task.primarySeatId
          : requireText(dto.primarySeatId, '主座位'),
      primarySeatLabel:
        dto.primarySeatLabel === undefined
          ? task.primarySeatLabel
          : nullableText(dto.primarySeatLabel),
      backupSeatIds:
        dto.backupSeatIds === undefined
          ? task.backupSeatIds
          : normalizeSeatIds(dto.backupSeatIds),
      backupSeatLabels:
        dto.backupSeatLabels === undefined
          ? task.backupSeatLabels
          : normalizeSeatIds(dto.backupSeatLabels),
      timeCandidates: dto.timeCandidates ?? task.timeCandidates,
      maxAttempts: dto.maxAttempts ?? task.maxAttempts,
      attemptDelaySeconds: dto.attemptDelaySeconds ?? task.attemptDelaySeconds,
      bookingWindowSeconds:
        dto.bookingWindowSeconds ?? task.bookingWindowSeconds,
      prewarmOffsetSeconds:
        dto.prewarmOffsetSeconds ?? task.prewarmOffsetSeconds,
      runOffsetSeconds: dto.runOffsetSeconds ?? task.runOffsetSeconds,
      enabled,
    });
    return this.toView(await this.tasks.save(task));
  }

  async toggle(
    userId: number,
    id: number,
    enabled: boolean,
  ): Promise<BookingTaskView> {
    const task = await this.findOwned(userId, id);
    if (
      enabled &&
      task.venueType === 'library' &&
      task.schoolAccount.schoolCode !== 'njtech' &&
      !this.captchaSolver.isConfigured()
    ) {
      throw new UnprocessableEntityException(
        '图书馆自动抢座需要先配置验证码识别服务',
      );
    }
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
    if (account) {
      try {
        await this.serviceConnections.ensureReady(
          account,
          task.venueType === 'library' ? 'library' : 'study_room',
        );
        tokenStatus = 'valid';
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
        seatLabel:
          candidate.seatId === task.primarySeatId
            ? task.primarySeatLabel || '主座位'
            : task.backupSeatLabels[
                task.backupSeatIds.indexOf(candidate.seatId)
              ] || '备选座位',
      })),
      message:
        tokenStatus === 'valid'
          ? '账号可用；本次检查未提交预约。'
          : tokenStatus === 'missing'
            ? '账号尚未验证；本次检查未提交预约。'
            : '账号验证未通过；本次检查未提交预约。',
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
    if (
      runType === 'booking' &&
      task.venueType === 'library' &&
      task.schoolAccount.schoolCode !== 'njtech' &&
      !this.captchaSolver.isConfigured()
    ) {
      throw new UnprocessableEntityException(
        '图书馆自动抢座需要先配置验证码识别服务',
      );
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
      where: { task: { id: task.id }, user: { id: task.userId } },
      order: { createdAt: 'DESC' },
    });
    const account = task.schoolAccount;
    const connections = account
      ? await this.serviceConnections.listForAccount(account.id)
      : [];
    const connection = connections.find(
      (item) =>
        item.serviceType ===
        (task.venueType === 'library' ? 'library' : 'study_room'),
    );
    const hasConnectionIssue =
      !connection ||
      connection.status !== 'active' ||
      !connection.encryptedToken;
    const time = task.timeCandidates
      .map(({ start, end }) => `${formatTime(start)} - ${formatTime(end)}`)
      .join(' / ');
    const requiresLibraryVerification = task.venueType === 'library';
    const libraryBlocked =
      requiresLibraryVerification &&
      account?.schoolCode !== 'njtech' &&
      !this.captchaSolver.isConfigured();
    const libraryReady =
      requiresLibraryVerification &&
      account?.schoolCode !== 'njtech' &&
      this.captchaSolver.isConfigured();

    return {
      id: String(task.id),
      name: task.name,
      venueType: task.venueType,
      building: task.building,
      roomName: task.roomName,
      buildingId: task.buildingId,
      roomId: task.roomId,
      scheduleMode: task.scheduleMode,
      scheduleWeekdays: task.scheduleWeekdays,
      scheduleDates: task.scheduleDates,
      targetDate: task.targetDate,
      seatLabel: task.primarySeatLabel,
      account: account?.label ?? '未关联账号',
      accountId: String(task.schoolAccountId),
      seat: task.primarySeatLabel
        ? `${task.primarySeatLabel} 号`
        : '未设置座位号',
      seatId: task.primarySeatId,
      time,
      nextRun: task.enabled
        ? `${scheduleLabel(task)} · 下次开放窗口`
        : libraryBlocked
          ? '需要配置验证码识别服务'
          : '已暂停',
      status: task.enabled ? 'enabled' : 'paused',
      enabled: task.enabled,
      backupSeatIds: task.backupSeatIds,
      backupSeatLabels: task.backupSeatLabels,
      timeCandidates: task.timeCandidates,
      maxAttempts: task.maxAttempts,
      attemptDelaySeconds: task.attemptDelaySeconds,
      bookingWindowSeconds: task.bookingWindowSeconds,
      prewarmOffsetSeconds: task.prewarmOffsetSeconds,
      runOffsetSeconds: task.runOffsetSeconds,
      lastRun: lastRun ? formatDate(lastRun.createdAt) : '尚未运行',
      lastMessage:
        lastRun?.message ??
        (hasConnectionIssue
          ? '学校暂时不可访问，闹钟会在开放窗口自动重试'
          : libraryBlocked
            ? '图书馆自动抢座需要配置验证码识别服务'
            : account?.schoolCode === 'njtech'
              ? '将在南工大开放窗口自动抢当天座位'
              : libraryReady
                ? '将在开放窗口前预解验证码，开放时自动提交'
                : '等待下一次自动执行'),
    };
  }
}

function validateSchedule(
  mode: 'daily' | 'weekdays' | 'weekly' | 'dates' | 'once',
  targetDate: string | null | undefined,
  weekdays: number[],
  dates: string[],
) {
  if (mode === 'once' && !targetDate) {
    throw new UnprocessableEntityException('单次预约必须选择日期');
  }
  if (mode === 'weekly' && !weekdays.length) {
    throw new UnprocessableEntityException('自定义周期至少选择一天');
  }
  if (mode === 'dates' && !dates.length) {
    throw new UnprocessableEntityException('指定日期至少选择一天');
  }
}

function normalizeWeekdays(value: number[] | undefined): number[] {
  const weekdays = (value ?? [1, 2, 3, 4, 5]).filter(
    (day) => Number.isInteger(day) && day >= 0 && day <= 6,
  );
  return Array.from(new Set(weekdays)).sort((a, b) => a - b);
}

function normalizeDates(value: string[] | undefined): string[] {
  return Array.from(new Set(value ?? [])).sort();
}

function scheduleLabel(task: BookingTaskEntity): string {
  if (task.scheduleMode === 'once' && task.targetDate) return task.targetDate;
  if (task.scheduleMode === 'weekdays') return '工作日';
  if (task.scheduleMode === 'weekly') {
    const labels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return (
      task.scheduleWeekdays.map((day) => labels[day]).join('、') || '自定义周期'
    );
  }
  if (task.scheduleMode === 'dates') {
    return task.scheduleDates.length === 1
      ? task.scheduleDates[0]
      : `${task.scheduleDates.length} 个指定日期`;
  }
  return '每天';
}

function validateTimeCandidates(
  candidates: Array<{ start: number; end: number }>,
  venueType: string,
  schoolCode = 'cczu',
) {
  const window = bookingWindow(venueType, schoolCode);
  if (!candidates.length)
    throw new UnprocessableEntityException('至少配置一个时间段');
  if (
    candidates.some(
      ({ start, end }) =>
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < window.start ||
        end > window.end ||
        end <= start,
    )
  )
    throw new UnprocessableEntityException(
      `可预约时间为 ${formatTime(window.start)}–${formatTime(window.end)}，且结束时间必须晚于开始时间`,
    );
  if (
    candidates.some(
      ({ start, end }) =>
        end - start > maxBookingMinutes(venueType, schoolCode),
    )
  )
    throw new UnprocessableEntityException(
      venueType === 'library'
        ? '图书馆单次预约最长 4 小时'
        : '自习室单次预约最长 8 小时',
    );
}

function normalizeSeatIds(seats: string[]): string[] {
  const normalized = seats.map((seat) => seat.trim()).filter(Boolean);
  if (normalized.some((seat) => seat.length > 30))
    throw new UnprocessableEntityException('座位 ID 不能超过 30 个字符');
  return Array.from(new Set(normalized));
}

function requireText(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new UnprocessableEntityException(`${field}不能为空`);
  return trimmed;
}

function optionalText(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

function nullableText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
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
