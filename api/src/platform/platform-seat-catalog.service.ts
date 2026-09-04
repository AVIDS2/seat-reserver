import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PlatformAccountsService } from './platform-accounts.service';
import { PlatformServiceConnectionsService } from './platform-service-connections.service';
import { SchoolAuthenticationService } from './school-authentication.service';
import type { SeatServiceType } from './entities/school-service-connection.entity';

type JsonRecord = Record<string, unknown>;

type CacheEntry = {
  value: unknown;
  expiresAt: number;
};

@Injectable()
export class PlatformSeatCatalogService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly flights = new Map<string, Promise<unknown>>();

  constructor(
    private readonly accounts: PlatformAccountsService,
    private readonly connections: PlatformServiceConnectionsService,
    private readonly schoolAuth: SchoolAuthenticationService,
  ) {}

  async filters(
    userId: number,
    accountId: number,
    serviceType: SeatServiceType,
    refresh = false,
  ) {
    const account = await this.accounts.findOwned(userId, accountId);
    return this.cached(
      `filters:${userId}:${accountId}:${serviceType}`,
      5 * 60_000,
      async () => {
        const context = await this.context(account, serviceType);
        const [filters, settings] = await Promise.all([
          this.request(context, '/rest/v2/free/filters'),
          this.request(context, '/rest/v2/settings'),
        ]);
        const data = record(filters.payload?.data);
        const settingsData = record(settings.payload?.data);
        return {
          serviceType,
          buildings: tuples(data.buildings).map((item) => ({
            id: String(item[0]),
            name: String(item[1] || '未命名馆区'),
          })),
          rooms: tuples(data.rooms).map((item) => ({
            id: String(item[0]),
            name: String(item[1] || '未命名空间'),
            buildingId: String(item[2] ?? ''),
            floor: Number(item[3] ?? 0),
          })),
          dates: strings(data.dates),
          captchaRequired: settingsData.isCaptchaOpen === true,
          hours: Number(data.hours ?? 0),
        };
      },
      refresh,
    );
  }

  async layout(
    userId: number,
    accountId: number,
    serviceType: SeatServiceType,
    roomId: string,
    date: string,
    refresh = false,
  ) {
    const account = await this.accounts.findOwned(userId, accountId);
    return this.cached(
      `layout:${userId}:${accountId}:${serviceType}:${roomId}:${date}`,
      15_000,
      async () => {
        const context = await this.context(account, serviceType);
        const response = await this.request(
          context,
          `/rest/v2/room/layoutByDate/${segment(roomId)}/${segment(date)}`,
        );
        const data = record(response.payload?.data);
        const layout = record(data.layout);
        const nodes = Object.entries(layout).map(([position, value]) => {
          const node = record(value);
          const numericPosition = Number(position);
          const type = string(node.type) || 'empty';
          return {
            key: position,
            row: Number.isFinite(numericPosition)
              ? Math.floor(numericPosition / 1000)
              : 0,
            col: Number.isFinite(numericPosition) ? numericPosition % 1000 : 0,
            kind: type === 'seat' ? 'seat' : type,
            id: node.id === undefined ? null : String(node.id),
            label: string(node.name),
            status: normalizeSeatStatus(node),
            power: node.power === true,
            window: node.window === true,
            computer: node.computer === true,
            enabled: node.enabled !== false,
            direction: Number(node.direction ?? 0),
          };
        });
        return {
          serviceType,
          room: { id: String(data.id ?? roomId), name: string(data.name) },
          rows: Number(data.rows ?? 0),
          cols: Number(data.cols ?? 0),
          nodes,
          refreshedAt: new Date().toISOString(),
        };
      },
      refresh,
    );
  }

  async times(
    userId: number,
    accountId: number,
    serviceType: SeatServiceType,
    roomId: string,
    seatId: string,
    date: string,
    startTime?: string,
    refresh = false,
  ) {
    const account = await this.accounts.findOwned(userId, accountId);
    return this.cached(
      `times:${userId}:${accountId}:${serviceType}:${roomId}:${seatId}:${date}:${startTime || ''}`,
      10_000,
      async () => {
        const context = await this.context(account, serviceType);
        const start = await this.request(
          context,
          `/rest/v2/startTimesForSeat/${segment(seatId)}/${segment(date)}`,
        );
        const startTimes = slots(record(start.payload?.data).startTimes);
        if (!startTime) return { startTimes, endTimes: [] };
        const end = await this.request(
          context,
          `/rest/v2/endTimesForSeat/${segment(seatId)}/${segment(date)}/${segment(startTime)}`,
        );
        return {
          startTimes,
          endTimes: slots(record(end.payload?.data).endTimes),
        };
      },
      refresh,
    );
  }

  private context(
    account: Parameters<PlatformServiceConnectionsService['ensureReady']>[0],
    serviceType: SeatServiceType,
  ) {
    return this.connections.ensureReady(account, serviceType);
  }

  private async cached<T>(
    key: string,
    ttlMs: number,
    factory: () => Promise<T>,
    refresh: boolean,
  ): Promise<T> {
    if (!refresh) {
      const entry = this.cache.get(key);
      if (entry && entry.expiresAt > Date.now()) return entry.value as T;
      const flight = this.flights.get(key);
      if (flight) return flight as Promise<T>;
    }
    const flight = factory()
      .then((value) => {
        this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
        this.trimCache();
        return value;
      })
      .finally(() => {
        if (this.flights.get(key) === flight) this.flights.delete(key);
      });
    this.flights.set(key, flight);
    return flight;
  }

  private trimCache(): void {
    while (this.cache.size > 256) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) return;
      this.cache.delete(oldest);
    }
  }

  invalidateAccount(
    userId: number,
    accountId: number,
    serviceType?: SeatServiceType,
  ): void {
    const prefix = serviceType
      ? `:${userId}:${accountId}:${serviceType}`
      : `:${userId}:${accountId}:`;
    for (const key of this.cache.keys()) {
      if (key.includes(prefix)) this.cache.delete(key);
    }
    for (const key of this.flights.keys()) {
      if (key.includes(prefix)) this.flights.delete(key);
    }
  }

  private async request(
    context: Awaited<ReturnType<PlatformSeatCatalogService['context']>>,
    path: string,
  ) {
    const response = await this.schoolAuth.get(
      context.token,
      context.mode,
      path,
      context.serviceType,
    );
    if (!response.success) {
      throw new UnprocessableEntityException(
        response.message || '学校座位数据暂时不可用',
      );
    }
    return response;
  }
}

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function tuples(value: unknown): unknown[][] {
  return Array.isArray(value) ? value.filter(Array.isArray) : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function string(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function segment(value: string): string {
  return encodeURIComponent(value.trim());
}

function slots(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((item) => record(item))
        .map((item) => ({
          id: String(item.id ?? ''),
          label: String(item.value ?? item.id ?? ''),
        }))
        .filter((item) => item.id)
    : [];
}

function normalizeSeatStatus(node: JsonRecord) {
  if (node.enabled === false) return 'unavailable';
  if (node.local === true) return 'mine';
  const status = String(node.status ?? '').toUpperCase();
  if (['FREE', 'AVAILABLE'].includes(status)) return 'available';
  if (['AWAY', 'LEAVE'].includes(status)) return 'away';
  if (['BOOK', 'BOOKED', 'RESERVED', 'USED', 'IN_USE'].includes(status))
    return 'reserved';
  return status ? 'unavailable' : 'unknown';
}
