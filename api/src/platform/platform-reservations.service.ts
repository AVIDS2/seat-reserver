import {
  Injectable,
  NotFoundException,
  Optional,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { PlatformAccountsService } from './platform-accounts.service';
import { PlatformServiceConnectionsService } from './platform-service-connections.service';
import { SchoolAuthenticationService } from './school-authentication.service';
import { PlatformSeatCatalogService } from './platform-seat-catalog.service';
import type { ImmediateReservationDto } from './dto/reservation.dto';
import type { SeatServiceType } from './entities/school-service-connection.entity';
import { bookingWindow, maxBookingMinutes } from './booking-time.constants';
import { PlatformRedisService } from './platform-redis.service';
import type { BookingCaptchaPointDto } from './dto/reservation.dto';
import { PlatformCaptchaSolverService } from './platform-captcha-solver.service';
import { BookingRunEntity } from './entities/booking-run.entity';

type JsonRecord = Record<string, unknown>;

export type ReservationStatus =
  | 'upcoming'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'unknown';

export type ReservationView = {
  id: string;
  receipt: string | null;
  accountId: string;
  account: string;
  venueType: SeatServiceType;
  venueLabel: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  status: ReservationStatus;
  statusLabel: string;
  checkedIn: boolean;
  canCancel: boolean;
};

type PendingCaptchaBooking = {
  userId: number;
  booking: ImmediateReservationDto;
  challengeToken: string;
  requiredClicks: number;
};

export type BookingCaptchaView = {
  id: string;
  image: string;
  wordImage: string;
  requiredClicks: number;
  expiresAt: string;
  autoSolveAvailable: boolean;
};

export type AutoSolvedBooking = {
  reservation: ReservationView;
  solve: {
    provider: string;
    model: string;
    latencyMs: number;
    targets: string[];
  };
};

const CAPTCHA_TTL_SECONDS = 180;

@Injectable()
export class PlatformReservationsService {
  constructor(
    private readonly accounts: PlatformAccountsService,
    private readonly connections: PlatformServiceConnectionsService,
    private readonly schoolAuth: SchoolAuthenticationService,
    private readonly catalog: PlatformSeatCatalogService,
    private readonly redis: PlatformRedisService,
    private readonly solver: PlatformCaptchaSolverService,
    @Optional()
    @InjectRepository(BookingRunEntity)
    private readonly runs?: Repository<BookingRunEntity>,
  ) {}

  async list(
    userId: number,
    accountId: number,
    serviceType: SeatServiceType,
  ): Promise<ReservationView[]> {
    try {
      const context = await this.context(userId, accountId, serviceType);
      const response = await this.request(
        context,
        '/rest/v2/history/1/50?page=1&pageSize=50',
      );
      const data = record(response.payload?.data);
      const reservations = Array.isArray(data.reservations)
        ? data.reservations
        : [];
      return reservations
        .map((item) =>
          this.normalize(item, context.account.label, accountId, serviceType),
        )
        .filter((item): item is ReservationView => item !== null);
    } catch (error: unknown) {
      const fallback = await this.listFromPlatformRuns(
        userId,
        accountId,
        serviceType,
      );
      if (fallback.length) return fallback;
      throw error;
    }
  }

  async cancel(
    userId: number,
    accountId: number,
    serviceType: SeatServiceType,
    reservationId: string,
  ): Promise<ReservationView> {
    const context = await this.context(userId, accountId, serviceType);
    const current = await this.list(userId, accountId, serviceType);
    const target = current.find((item) => item.id === reservationId);
    if (!target) throw new NotFoundException('预约记录不存在');
    if (!target.canCancel) {
      throw new UnprocessableEntityException('这条预约当前不可取消');
    }

    await this.request(context, `/rest/v2/cancel/${segment(reservationId)}`);
    this.catalog.invalidateAccount(userId, accountId, serviceType);
    let cancelled: ReservationView | undefined;
    try {
      const refreshed = await this.list(userId, accountId, serviceType);
      cancelled = refreshed.find((item) => item.id === reservationId);
    } catch {
      // The school may apply the cancellation before its history endpoint catches up.
    }
    return (
      cancelled ?? {
        ...target,
        status: 'cancelled',
        statusLabel: '已取消',
        canCancel: false,
      }
    );
  }

  async book(
    userId: number,
    dto: ImmediateReservationDto,
  ): Promise<ReservationView> {
    const context = await this.context(userId, dto.accountId, dto.serviceType);
    this.validateBooking(dto, context.account.schoolCode);
    return this.submitBooking(context, dto);
  }

  async createCaptcha(
    userId: number,
    dto: ImmediateReservationDto,
  ): Promise<BookingCaptchaView> {
    if (dto.serviceType !== 'library') {
      throw new UnprocessableEntityException('自习室预约不需要图书馆验证');
    }
    const context = await this.context(userId, dto.accountId, 'library');
    this.validateBooking(dto, context.account.schoolCode);
    const challenge = context.account.schoolCode
      ? await this.schoolAuth.createBookingCaptcha(
          context.token,
          context.account.schoolCode,
        )
      : await this.schoolAuth.createBookingCaptcha(context.token);
    const id = randomUUID();
    await this.redis.setJson(
      captchaKey(id),
      {
        userId,
        booking: dto,
        challengeToken: challenge.token,
        requiredClicks: challenge.requiredClicks,
      } satisfies PendingCaptchaBooking,
      CAPTCHA_TTL_SECONDS,
    );
    return {
      id,
      image: challenge.image,
      wordImage: challenge.wordImage,
      requiredClicks: challenge.requiredClicks,
      expiresAt: new Date(
        Date.now() + CAPTCHA_TTL_SECONDS * 1000,
      ).toISOString(),
      autoSolveAvailable: this.solver.isConfigured(),
    };
  }

  /**
   * Solves the challenge with the configured vision model, verifies it against the
   * school, then submits the pending reservation in one pass.
   */
  async autoSolveAndBook(
    userId: number,
    dto: ImmediateReservationDto,
  ): Promise<AutoSolvedBooking> {
    if (dto.serviceType !== 'library') {
      throw new UnprocessableEntityException('自习室预约不需要图书馆验证');
    }
    if (!this.solver.isConfigured()) {
      throw new UnprocessableEntityException('自动识别服务未配置');
    }

    const context = await this.context(userId, dto.accountId, 'library');
    this.validateBooking(dto, context.account.schoolCode);
    const challenge = context.account.schoolCode
      ? await this.schoolAuth.createBookingCaptcha(
          context.token,
          context.account.schoolCode,
        )
      : await this.schoolAuth.createBookingCaptcha(context.token);
    const solved = await this.solver.solve({
      image: challenge.image,
      wordImage: challenge.wordImage,
      requiredClicks: challenge.requiredClicks,
    });
    const verified = context.account.schoolCode
      ? await this.schoolAuth.verifyBookingCaptcha(
          context.token,
          challenge.token,
          solved.points,
          context.account.schoolCode,
        )
      : await this.schoolAuth.verifyBookingCaptcha(
          context.token,
          challenge.token,
          solved.points,
        );
    assertSuccess(verified, '自动识别结果未通过学校校验');

    const reservation = await this.submitBooking(context, dto, challenge.token);
    return {
      reservation,
      solve: {
        provider: solved.provider,
        model: solved.model,
        latencyMs: solved.latencyMs,
        targets: solved.targets,
      },
    };
  }

  async verifyCaptchaAndBook(
    userId: number,
    challengeId: string,
    points: BookingCaptchaPointDto[],
  ): Promise<ReservationView> {
    const key = captchaKey(challengeId);
    const pending = await this.redis.getJson<PendingCaptchaBooking>(key);
    if (!pending || pending.userId !== userId) {
      throw new NotFoundException('预约验证已过期，请重新获取');
    }
    await this.redis.delete(key);
    if (points.length !== pending.requiredClicks) {
      throw new UnprocessableEntityException('请按提示完成全部点选');
    }
    const context = await this.context(
      userId,
      pending.booking.accountId,
      'library',
    );
    const verified = context.account.schoolCode
      ? await this.schoolAuth.verifyBookingCaptcha(
          context.token,
          pending.challengeToken,
          points,
          context.account.schoolCode,
        )
      : await this.schoolAuth.verifyBookingCaptcha(
          context.token,
          pending.challengeToken,
          points,
        );
    assertSuccess(verified, '验证码错误，请重新验证');
    return this.submitBooking(context, pending.booking, pending.challengeToken);
  }

  private async context(
    userId: number,
    accountId: number,
    serviceType: SeatServiceType,
  ) {
    const account = await this.accounts.findOwned(userId, accountId);
    const connection = await this.connections.ensureReady(account, serviceType);
    return { ...connection, account };
  }

  private async listFromPlatformRuns(
    userId: number,
    accountId: number,
    serviceType: SeatServiceType,
  ): Promise<ReservationView[]> {
    if (!this.runs) return [];
    const runs = await this.runs.find({
      where: {
        user: { id: userId },
        schoolAccount: { id: accountId },
        task: { venueType: serviceType },
        runType: 'booking',
        status: 'success',
      },
      relations: ['task', 'schoolAccount'],
      order: { targetDate: 'DESC', createdAt: 'DESC' },
      take: 50,
    });
    return runs.map((run) => ({
      id: `platform-run-${run.id}`,
      receipt: run.receipt,
      accountId: String(accountId),
      account: run.schoolAccount?.label ?? '学校账号',
      venueType: serviceType,
      venueLabel: serviceType === 'library' ? '图书馆' : '自习室',
      date: run.targetDate,
      startTime: run.reservedBegin ?? '',
      endTime: run.reservedEnd ?? '',
      location: run.location ?? run.task?.primarySeatLabel ?? '学校座位',
      status: 'upcoming',
      statusLabel: '平台记录，学校状态待同步',
      checkedIn: false,
      canCancel: false,
    }));
  }

  private validateBooking(
    dto: ImmediateReservationDto,
    schoolCode = 'cczu',
  ): void {
    if (schoolCode === 'njtech' && dto.date !== getShanghaiDate()) {
      throw new UnprocessableEntityException('南京工业大学目前只支持当天预约');
    }
    const window = bookingWindow(dto.serviceType, schoolCode);
    if (
      !Number.isInteger(dto.startTime) ||
      !Number.isInteger(dto.endTime) ||
      dto.startTime < window.start ||
      dto.endTime > window.end ||
      dto.endTime <= dto.startTime
    ) {
      throw new UnprocessableEntityException(
        `可预约时间为 ${formatTime(window.start)}–${formatTime(window.end)}，且结束时间必须晚于开始时间`,
      );
    }
    if (
      dto.endTime - dto.startTime >
      maxBookingMinutes(dto.serviceType, schoolCode)
    ) {
      throw new UnprocessableEntityException(
        dto.serviceType === 'library'
          ? '图书馆单次预约最长 4 小时'
          : '自习室单次预约最长 8 小时',
      );
    }
  }

  private async submitBooking(
    context: Awaited<ReturnType<PlatformReservationsService['context']>>,
    dto: ImmediateReservationDto,
    authId?: string,
  ): Promise<ReservationView> {
    const candidate = {
      seatId: dto.seatId.trim(),
      ...(dto.roomId ? { roomId: dto.roomId } : {}),
      startTime: dto.startTime,
      endTime: dto.endTime,
      authId,
    };
    const response = context.schoolCode
      ? await this.schoolAuth.book(
          context.token,
          context.mode,
          dto.date,
          candidate,
          10_000,
          dto.serviceType,
          context.schoolCode,
        )
      : await this.schoolAuth.book(
          context.token,
          context.mode,
          dto.date,
          candidate,
          10_000,
          dto.serviceType,
        );
    assertSuccess(response);
    this.catalog.invalidateAccount(
      context.account.userId,
      dto.accountId,
      dto.serviceType,
    );
    return this.normalizeBooked(response, context.account.label, dto);
  }

  private normalizeBooked(
    response: { payload: JsonRecord | null },
    accountLabel: string,
    dto: ImmediateReservationDto,
  ): ReservationView {
    const data = record(response.payload?.data);
    const reservation = this.normalize(
      data,
      accountLabel,
      dto.accountId,
      dto.serviceType,
    );
    return reservation
      ? {
          ...reservation,
          status:
            reservation.status === 'unknown' ? 'upcoming' : reservation.status,
          statusLabel:
            reservation.status === 'unknown'
              ? '已预约'
              : reservation.statusLabel,
          canCancel: true,
        }
      : {
          id: stringValue(data.id) || 'pending',
          receipt: stringValue(data.receipt),
          accountId: String(dto.accountId),
          account: accountLabel,
          venueType: dto.serviceType,
          venueLabel: dto.serviceType === 'library' ? '图书馆' : '自习室',
          date: normalizeDate(stringValue(data.onDate) || dto.date),
          startTime: stringValue(data.begin) || formatTime(dto.startTime),
          endTime: stringValue(data.end) || formatTime(dto.endTime),
          location: stringValue(data.location) || `座位 ${dto.seatId}`,
          status: 'upcoming',
          statusLabel: '已预约',
          checkedIn: data.checkedIn === true,
          canCancel: true,
        };
  }

  private async request(
    context: Awaited<ReturnType<PlatformReservationsService['context']>>,
    path: string,
  ) {
    const response = context.schoolCode
      ? await this.schoolAuth.get(
          context.token,
          context.mode,
          path,
          context.serviceType,
          context.schoolCode,
        )
      : await this.schoolAuth.get(
          context.token,
          context.mode,
          path,
          context.serviceType,
        );
    assertSuccess(response);
    return response;
  }

  private normalize(
    value: unknown,
    account: string,
    accountId: number,
    serviceType: SeatServiceType,
  ): ReservationView | null {
    const item = record(value);
    const id = item.id;
    if (id === undefined || id === null || String(id).trim() === '')
      return null;
    const status = normalizeStatus(item.stat);
    return {
      id: String(id),
      receipt: stringValue(item.receipt),
      accountId: String(accountId),
      account,
      venueType: serviceType,
      venueLabel: serviceType === 'library' ? '图书馆' : '自习室',
      date: normalizeDate(stringValue(item.date) || stringValue(item.onDate)),
      startTime: stringValue(item.begin) || '',
      endTime: stringValue(item.end) || '',
      location:
        stringValue(item.loc) || stringValue(item.location) || '学校座位',
      status,
      statusLabel: statusLabel(status),
      checkedIn: item.checkedIn === true || status === 'active',
      canCancel: status === 'upcoming' || status === 'active',
    };
  }
}

function assertSuccess(
  response: {
    httpStatus: number;
    payload: JsonRecord | null;
    message: string;
    success?: boolean;
  },
  fallback = '学校预约服务暂时不可用',
): void {
  if (response.success === true) return;
  if (
    response.success === false ||
    response.httpStatus !== 200 ||
    !['success', 'OK', true].includes(
      response.payload?.status as string | boolean,
    ) ||
    (response.payload?.code !== undefined &&
      String(response.payload.code) !== '0')
  ) {
    throw new UnprocessableEntityException(response.message || fallback);
  }
}

function captchaKey(id: string): string {
  return `platform:booking-captcha:${id}`;
}

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function segment(value: string): string {
  return encodeURIComponent(value.trim());
}

function normalizeDate(value: string | null): string {
  if (!value) return '';
  const match = value.match(/^(\d{4})[-年](\d{1,2})[-月](\d{1,2})/);
  if (!match) return value;
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
}

function normalizeStatus(value: unknown): ReservationStatus {
  switch (String(value ?? '').toUpperCase()) {
    case 'RESERVE':
    case 'RESERVED':
      return 'upcoming';
    case 'USING':
    case 'CHECKIN':
    case 'IN_USE':
      return 'active';
    case 'COMPLETE':
    case 'COMPLETED':
      return 'completed';
    case 'CANCEL':
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'unknown';
  }
}

function statusLabel(status: ReservationStatus): string {
  return {
    upcoming: '待使用',
    active: '使用中',
    completed: '已完成',
    cancelled: '已取消',
    unknown: '状态未知',
  }[status];
}

function formatTime(minutes: number): string {
  return `${Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`;
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
