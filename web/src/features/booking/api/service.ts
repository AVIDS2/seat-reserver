import type {
  BookingAccount,
  BookingRun,
  BookingReservation,
  BookingSnapshot,
  BookingTask,
  PlatformNotification,
  TimeCandidate,
  VenueType
} from '../types';
import type { SeatCatalog, SeatLayout, SeatTimes } from '../types';

export type CreateAccountPayload = {
  label: string;
  schoolUsername: string;
  schoolPassword: string;
};

export type UpdateAccountPayload = {
  label: string;
  schoolUsername?: string;
  schoolPassword?: string;
};

export type TaskPayload = {
  accountId: string;
  name: string;
  venueType: VenueType;
  building: string;
  roomName: string;
  buildingId?: string | null;
  roomId?: string | null;
  scheduleMode: 'daily' | 'weekdays' | 'weekly' | 'once';
  targetDate?: string | null;
  scheduleWeekdays: number[];
  primarySeatLabel?: string | null;
  primarySeatId: string;
  backupSeatIds: string[];
  backupSeatLabels: string[];
  timeCandidates: TimeCandidate[];
  maxAttempts: number;
  attemptDelaySeconds: number;
  bookingWindowSeconds: number;
  prewarmOffsetSeconds: number;
  runOffsetSeconds: number;
  enabled?: boolean;
};

export type PlatformUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  role: 'admin' | 'user';
  status: 'active' | 'disabled';
};

export type AdminOverview = {
  users: number;
  activeUsers: number;
  accounts: number;
  connectedAccounts: number;
  tasks: number;
  enabledTasks: number;
  runsToday: number;
  successfulRunsToday: number;
  failedRunsToday: number;
  queueStatus: 'ok' | 'degraded';
  serverTime: string;
};

export type AdminAccount = {
  id: string;
  label: string;
  username: string;
  status: 'connected' | 'attention';
  statusLabel: string;
  tokenLabel: string;
  ownerName: string;
  ownerEmail: string | null;
  taskCount: number;
  lastVerifiedAt: string | null;
};

export type AdminTask = {
  id: string;
  name: string;
  venueType: VenueType;
  building: string;
  roomName: string;
  seatLabel: string | null;
  ownerName: string;
  ownerEmail: string | null;
  account: string;
  seat: string;
  time: string;
  enabled: boolean;
  status: 'enabled' | 'paused' | 'attention' | 'disabled';
  lastRun: string | null;
  lastMessage: string;
};

export type AdminRun = {
  id: string;
  runType: 'prewarm' | 'booking';
  ownerName: string;
  ownerEmail: string | null;
  task: string;
  account: string;
  targetDate: string;
  status: 'success' | 'failed' | 'prewarming' | 'running' | 'pending' | 'skipped';
  statusLabel: string;
  attempts: number;
  result: string;
  detail: string;
  startedAt: string;
};

export type AdminUser = {
  id: string;
  email: string | null;
  displayName: string;
  role: 'admin' | 'user';
  status: 'active' | 'disabled';
  accountCount: number;
  taskCount: number;
  createdAt: string;
};

export type Invitation = {
  id: string;
  code?: string;
  maxUses: number;
  usedCount: number;
  status: string;
  expiresAt: string | null;
  createdAt: string;
};

export type DryRunResult = {
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

const apiBase = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
let refreshPromise: Promise<boolean> | null = null;

type SeatCacheEntry = {
  value: unknown;
  expiresAt: number;
};

const seatCache = new Map<string, SeatCacheEntry>();
const seatFlights = new Map<string, Promise<unknown>>();

async function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${apiBase}/platform/auth/refresh`, {
      method: 'POST',
      credentials: 'include'
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function platformRequest<T>(
  path: string,
  options: RequestInit = {},
  allowRefresh = true
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
  } catch {
    throw new Error('平台网络连接失败，请刷新页面后重试');
  }

  if (response.status === 401 && allowRefresh && !path.includes('/auth/')) {
    if (await refreshSession()) return platformRequest<T>(path, options, false);
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
      errors?: Record<string, string>;
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join('；')
      : body?.message || Object.values(body?.errors || {})[0] || `请求失败（${response.status}）`;
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function getPlatformUser(): Promise<PlatformUser> {
  const response = await platformRequest<{ user: Record<string, unknown> }>('/platform/auth/me');
  return toPlatformUser(response.user);
}

export async function signOutPlatform(): Promise<void> {
  try {
    await platformRequest('/platform/auth/logout', { method: 'POST' }, false);
  } finally {
    clearBookingDataCache();
  }
}

export async function updatePlatformProfile(payload: {
  firstName?: string;
  lastName?: string;
  password?: string;
  oldPassword?: string;
}): Promise<PlatformUser> {
  const response = await platformRequest<{ user: Record<string, unknown> }>('/platform/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
  return toPlatformUser(response.user);
}

export async function getClientSnapshot(): Promise<BookingSnapshot> {
  return platformRequest<BookingSnapshot>('/platform/dashboard');
}

export async function createSchoolAccount(payload: CreateAccountPayload): Promise<BookingAccount> {
  const response = await platformRequest<{ account: BookingAccount }>('/platform/accounts', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  clearBookingDataCache();
  return response.account;
}

export async function refreshSchoolAccount(id: string): Promise<BookingAccount> {
  const response = await platformRequest<{ account: BookingAccount }>(
    `/platform/accounts/${id}/refresh`,
    {
      method: 'POST'
    }
  );
  clearBookingDataCache();
  return response.account;
}

export async function updateSchoolAccount(
  id: string,
  payload: UpdateAccountPayload
): Promise<BookingAccount> {
  const response = await platformRequest<{ account: BookingAccount }>(`/platform/accounts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
  clearBookingDataCache();
  return response.account;
}

export async function deleteSchoolAccount(id: string): Promise<void> {
  await platformRequest(`/platform/accounts/${id}`, { method: 'DELETE' });
  clearBookingDataCache();
}

export async function createBookingTask(payload: TaskPayload): Promise<BookingTask> {
  const response = await platformRequest<{ task: BookingTask }>('/platform/tasks', {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      accountId: Number(payload.accountId)
    })
  });
  return response.task;
}

export async function updateBookingTask(
  id: string,
  payload: Partial<TaskPayload>
): Promise<BookingTask> {
  const body =
    payload.accountId === undefined
      ? payload
      : { ...payload, accountId: Number(payload.accountId) };
  const response = await platformRequest<{ task: BookingTask }>(`/platform/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body)
  });
  return response.task;
}

export async function deleteBookingTask(id: string): Promise<void> {
  await platformRequest(`/platform/tasks/${id}`, { method: 'DELETE' });
}

export async function setBookingTaskEnabled(id: string, enabled: boolean): Promise<BookingTask> {
  const response = await platformRequest<{ task: BookingTask }>(
    `/platform/tasks/${id}/${enabled ? 'enable' : 'disable'}`,
    {
      method: 'POST'
    }
  );
  return response.task;
}

export async function runBookingTask(id: string): Promise<BookingRun> {
  const response = await platformRequest<{ run: BookingRun }>(`/platform/tasks/${id}/run`, {
    method: 'POST',
    body: JSON.stringify({})
  });
  return response.run;
}

export async function prewarmBookingTask(id: string): Promise<BookingRun> {
  const response = await platformRequest<{ run: BookingRun }>(`/platform/tasks/${id}/prewarm`, {
    method: 'POST',
    body: JSON.stringify({})
  });
  return response.run;
}

export async function dryRunBookingTask(id: string): Promise<DryRunResult> {
  const response = await platformRequest<{ dryRun: DryRunResult }>(
    `/platform/tasks/${id}/dry-run`,
    {
      method: 'POST'
    }
  );
  return response.dryRun;
}

export async function getSeatCatalog(
  accountId: string,
  serviceType: VenueType,
  options: { refresh?: boolean } = {}
): Promise<SeatCatalog> {
  const query = new URLSearchParams({ accountId, serviceType });
  if (options.refresh) query.set('refresh', '1');
  return cachedSeatRequest(
    `filters:${accountId}:${serviceType}`,
    `/platform/catalog/filters?${query}`,
    5 * 60_000,
    options.refresh === true
  );
}

export async function connectSchoolService(
  id: string,
  serviceType: VenueType
): Promise<BookingAccount> {
  const response = await platformRequest<{ account: BookingAccount }>(
    `/platform/accounts/${id}/services/${serviceType}/connect`,
    { method: 'POST' }
  );
  clearBookingDataCache();
  return response.account;
}

export async function getSeatLayout(
  input: {
    accountId: string;
    serviceType: VenueType;
    roomId: string;
    date: string;
  },
  options: { refresh?: boolean } = {}
): Promise<SeatLayout> {
  const query = new URLSearchParams(input);
  if (options.refresh) query.set('refresh', '1');
  return cachedSeatRequest(
    `layout:${input.accountId}:${input.serviceType}:${input.roomId}:${input.date}`,
    `/platform/catalog/layout?${query}`,
    15_000,
    options.refresh === true
  );
}

export async function getSeatTimes(
  input: {
    accountId: string;
    serviceType: VenueType;
    roomId: string;
    seatId: string;
    date: string;
    startTime?: string;
  },
  options: { refresh?: boolean } = {}
): Promise<SeatTimes> {
  const query = new URLSearchParams(
    Object.entries(input).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  );
  if (options.refresh) query.set('refresh', '1');
  return cachedSeatRequest(
    `times:${input.accountId}:${input.serviceType}:${input.roomId}:${input.seatId}:${input.date}:${input.startTime || ''}`,
    `/platform/catalog/times?${query}`,
    10_000,
    options.refresh === true
  );
}

export async function getBookingReservations(input: {
  accountId: string;
  serviceType: VenueType;
}): Promise<BookingReservation[]> {
  const query = new URLSearchParams(input);
  const response = await platformRequest<{
    reservations: BookingReservation[];
  }>(`/platform/reservations?${query}`);
  return response.reservations;
}

export async function bookBookingReservation(input: {
  accountId: string;
  serviceType: VenueType;
  seatId: string;
  date: string;
  startTime: number;
  endTime: number;
}): Promise<BookingReservation> {
  const response = await platformRequest<{ reservation: BookingReservation }>(
    '/platform/reservations/book',
    {
      method: 'POST',
      body: JSON.stringify({ ...input, accountId: Number(input.accountId) })
    }
  );
  clearBookingDataCache();
  return response.reservation;
}

export async function cancelBookingReservation(input: {
  reservationId: string;
  accountId: string;
  serviceType: VenueType;
}): Promise<BookingReservation> {
  const response = await platformRequest<{ reservation: BookingReservation }>(
    `/platform/reservations/${encodeURIComponent(input.reservationId)}/cancel`,
    {
      method: 'POST',
      body: JSON.stringify({
        accountId: Number(input.accountId),
        serviceType: input.serviceType
      })
    }
  );
  clearBookingDataCache();
  return response.reservation;
}

export async function getClientNotifications(): Promise<PlatformNotification[]> {
  const response = await platformRequest<{
    notifications: PlatformNotification[];
  }>('/platform/notifications');
  return response.notifications;
}

export async function markNotificationRead(id: string): Promise<PlatformNotification> {
  const response = await platformRequest<{
    notification: PlatformNotification;
  }>(`/platform/notifications/${id}/read`, {
    method: 'PATCH'
  });
  return response.notification;
}

export async function markAllNotificationsRead(): Promise<void> {
  await platformRequest('/platform/notifications/read-all', {
    method: 'PATCH'
  });
}

export async function getAdminOverview(): Promise<AdminOverview> {
  return platformRequest<AdminOverview>('/platform/admin/overview');
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  const response = await platformRequest<{ users: AdminUser[] }>('/platform/admin/users');
  return response.users;
}

export async function getAdminAccounts(): Promise<AdminAccount[]> {
  const response = await platformRequest<{ accounts: AdminAccount[] }>('/platform/admin/accounts');
  return response.accounts;
}

export async function getAdminTasks(): Promise<AdminTask[]> {
  const response = await platformRequest<{ tasks: AdminTask[] }>('/platform/admin/tasks');
  return response.tasks;
}

export async function getAdminRuns(): Promise<AdminRun[]> {
  const response = await platformRequest<{ runs: AdminRun[] }>('/platform/admin/runs');
  return response.runs;
}

export async function setAdminUserEnabled(id: string, enabled: boolean): Promise<AdminUser> {
  const response = await platformRequest<{ user: AdminUser }>(
    `/platform/admin/users/${id}/${enabled ? 'enable' : 'disable'}`,
    {
      method: 'POST'
    }
  );
  return response.user;
}

export async function getInvitations(): Promise<Invitation[]> {
  const response = await platformRequest<{ invitations: Invitation[] }>('/platform/invitations');
  return response.invitations;
}

export async function createInvitation(maxUses: number, validDays: number): Promise<Invitation> {
  const response = await platformRequest<{ invitation: Invitation }>('/platform/invitations', {
    method: 'POST',
    body: JSON.stringify({ maxUses, validDays })
  });
  return response.invitation;
}

export async function disableInvitation(id: string): Promise<Invitation> {
  const response = await platformRequest<{ invitation: Invitation }>(
    `/platform/invitations/${id}`,
    {
      method: 'DELETE'
    }
  );
  return response.invitation;
}

export async function signInPlatform(email: string, password: string): Promise<void> {
  await platformRequest(
    '/platform/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password })
    },
    false
  );
  clearBookingDataCache();
}

export async function signUpPlatform(payload: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  inviteCode?: string;
}): Promise<void> {
  await platformRequest(
    '/platform/auth/register',
    {
      method: 'POST',
      body: JSON.stringify(payload)
    },
    false
  );
  clearBookingDataCache();
}

export function clearBookingDataCache(): void {
  seatCache.clear();
  seatFlights.clear();
}

async function cachedSeatRequest<T>(
  key: string,
  path: string,
  ttlMs: number,
  refresh: boolean
): Promise<T> {
  if (!refresh) {
    const cached = seatCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value as T;
    const flight = seatFlights.get(key);
    if (flight) return flight as Promise<T>;
  }

  const flight = platformRequest<T>(path)
    .then((value) => {
      seatCache.set(key, { value, expiresAt: Date.now() + ttlMs });
      while (seatCache.size > 256) {
        const oldest = seatCache.keys().next().value;
        if (oldest === undefined) break;
        seatCache.delete(oldest);
      }
      return value;
    })
    .finally(() => {
      if (seatFlights.get(key) === flight) seatFlights.delete(key);
    });
  seatFlights.set(key, flight);
  return flight;
}

function toPlatformUser(value: Record<string, unknown>): PlatformUser {
  const role = value.role as { id?: number } | null | undefined;
  const status = value.status as { id?: number } | null | undefined;
  const firstName = typeof value.firstName === 'string' ? value.firstName : '';
  const lastName = typeof value.lastName === 'string' ? value.lastName : '';
  return {
    id: String(value.id),
    email: typeof value.email === 'string' ? value.email : '',
    firstName,
    lastName,
    displayName: [firstName, lastName].filter(Boolean).join(' ') || '平台用户',
    role: Number(role?.id) === 1 ? 'admin' : 'user',
    status: Number(status?.id) === 1 ? 'active' : 'disabled'
  };
}
