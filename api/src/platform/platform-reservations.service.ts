import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PlatformAccountsService } from './platform-accounts.service';
import { PlatformServiceConnectionsService } from './platform-service-connections.service';
import { SchoolAuthenticationService } from './school-authentication.service';
import { PlatformSeatCatalogService } from './platform-seat-catalog.service';
import type { ImmediateReservationDto } from './dto/reservation.dto';
import type { SeatServiceType } from './entities/school-service-connection.entity';
import { bookingWindow, maxBookingMinutes } from './booking-time.constants';
import { PlatformRedisService } from './platform-redis.service';
import type { BookingCaptchaPointDto } from './dto/reservation.dto';

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
  ) {}

  async list(
    userId: number,
    accountId: number,
    serviceType: SeatServiceType,
  ): Promise<ReservationView[]> {
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
    this.validateBooking(dto);
    const context = await this.context(userId, dto.accountId, dto.serviceType);
    return this.submitBooking(context, dto);
  }

  async createCaptcha(
    userId: number,
    dto: ImmediateReservationDto,
  ): Promise<BookingCaptchaView> {
    this.validateBooking(dto);
    if (dto.serviceType !== 'library') {
      throw new UnprocessableEntityException('自习室预约不需要图书馆验证');
    }
    const context = await this.context(userId, dto.accountId, 'library');
    const challenge = await this.schoolAuth.createBookingCaptcha(context.token);
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
    const verified = await this.schoolAuth.verifyBookingCaptcha(
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

  private validateBooking(dto: ImmediateReservationDto): void {
    const window = bookingWindow(dto.serviceType);
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
    if (dto.endTime - dto.startTime > maxBookingMinutes(dto.serviceType)) {
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
    const response = await this.schoolAuth.book(
      context.token,
      context.mode,
      dto.date,
      {
        seatId: dto.seatId.trim(),
        startTime: dto.startTime,
        endTime: dto.endTime,
        authId,
      },
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
    const response = await this.schoolAuth.get(
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
      checkedIn: item.checkedIn === true,
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
