import { bookingSnapshot } from '../data';
import type {
  BookingAccount,
  BookingRun,
  BookingSnapshot,
  BookingTask,
  PlatformNotification
} from '../types';

export type CreateAccountPayload = {
  label: string;
  schoolUsername: string;
  schoolPassword: string;
};

export type UpdateAccountPayload = {
  label: string;
  schoolUsername: string;
  schoolPassword?: string;
};

export type TaskPayload = {
  accountId: string;
  name: string;
  primarySeatId: string;
  backupSeatIds: string[];
  timeCandidates: Array<{ start: number; end: number }>;
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
    startTime: number;
    endTime: number;
  }>;
  message: string;
};

const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';
const apiBase = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
let refreshPromise: Promise<boolean> | null = null;

function copySnapshot(): BookingSnapshot {
  return JSON.parse(JSON.stringify(bookingSnapshot)) as BookingSnapshot;
}

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
  const response = await fetch(`${apiBase}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });

  if (response.status === 401 && allowRefresh && !path.includes('/auth/')) {
    if (await refreshSession()) return platformRequest<T>(path, options, false);
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { message?: string | string[]; errors?: Record<string, string> }
      | null;
    const message = Array.isArray(body?.message)
      ? body.message.join('；')
      : body?.message || Object.values(body?.errors || {})[0] || `请求失败（${response.status}）`;
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function isDemoMode(): boolean {
  return demoMode;
}

export async function getPlatformUser(): Promise<PlatformUser> {
  if (demoMode) {
    return {
      id: 'demo-admin',
      email: 'admin@example.com',
      firstName: '平台',
      lastName: '管理员',
      displayName: '平台管理员',
      role: 'admin',
      status: 'active'
    };
  }
  const response = await platformRequest<{ user: Record<string, unknown> }>('/platform/auth/me');
  return toPlatformUser(response.user);
}

export async function signOutPlatform(): Promise<void> {
  if (demoMode) return;
  await platformRequest('/platform/auth/logout', { method: 'POST' }, false);
}

export async function updatePlatformProfile(payload: {
  firstName?: string;
  lastName?: string;
  password?: string;
  oldPassword?: string;
}): Promise<PlatformUser> {
  if (demoMode) {
    return getPlatformUser();
  }
  const response = await platformRequest<{ user: Record<string, unknown> }>('/platform/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
  return toPlatformUser(response.user);
}

export async function getClientSnapshot(): Promise<BookingSnapshot> {
  if (demoMode) return copySnapshot();
  return platformRequest<BookingSnapshot>('/platform/dashboard');
}

export async function createSchoolAccount(payload: CreateAccountPayload): Promise<BookingAccount> {
  if (demoMode) {
    return {
      id: `account-${Date.now()}`,
      label: payload.label,
      username: `${payload.schoolUsername.slice(0, 3)}******${payload.schoolUsername.slice(-2)}`,
      status: 'connected',
      statusLabel: '连接正常',
      tokenLabel: 'Token 已缓存',
      refreshedAt: '刚刚',
      lastVerifiedAt: '刚刚',
      tasks: 0
    };
  }
  const response = await platformRequest<{ account: BookingAccount }>('/platform/accounts', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return response.account;
}

export async function refreshSchoolAccount(id: string): Promise<BookingAccount> {
  if (demoMode) {
    const account = copySnapshot().accounts.find((item) => item.id === id);
    if (!account) throw new Error('账号不存在');
    return { ...account, refreshedAt: '刚刚', lastVerifiedAt: '刚刚' };
  }
  const response = await platformRequest<{ account: BookingAccount }>(`/platform/accounts/${id}/refresh`, {
    method: 'POST'
  });
  return response.account;
}

export async function updateSchoolAccount(id: string, payload: UpdateAccountPayload): Promise<BookingAccount> {
  if (demoMode) {
    const account = copySnapshot().accounts.find((item) => item.id === id);
    if (!account) throw new Error('账号不存在');
    return { ...account, label: payload.label, username: `${payload.schoolUsername.slice(0, 3)}******${payload.schoolUsername.slice(-2)}` };
  }
  const response = await platformRequest<{ account: BookingAccount }>(`/platform/accounts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
  return response.account;
}

export async function deleteSchoolAccount(id: string): Promise<void> {
  if (demoMode) return;
  await platformRequest(`/platform/accounts/${id}`, { method: 'DELETE' });
}

export async function createBookingTask(payload: TaskPayload): Promise<BookingTask> {
  if (demoMode) {
    return {
      id: `task-${Date.now()}`,
      name: payload.name,
      account: '我的账号',
      accountId: String(payload.accountId),
      seat: `${payload.primarySeatId} 号`,
      seatId: payload.primarySeatId,
      time: payload.timeCandidates.map((item) => `${formatTime(item.start)} - ${formatTime(item.end)}`).join(' / '),
      nextRun: '明早 06:00:03',
      status: payload.enabled === false ? 'paused' : 'enabled',
      enabled: payload.enabled !== false,
      backupSeatIds: payload.backupSeatIds,
      timeCandidates: payload.timeCandidates,
      maxAttempts: payload.maxAttempts,
      attemptDelaySeconds: payload.attemptDelaySeconds,
      bookingWindowSeconds: payload.bookingWindowSeconds,
      prewarmOffsetSeconds: payload.prewarmOffsetSeconds,
      runOffsetSeconds: payload.runOffsetSeconds,
      lastRun: '尚未运行',
      lastMessage: '等待第一次自动执行'
    };
  }
  const response = await platformRequest<{ task: BookingTask }>('/platform/tasks', {
    method: 'POST',
    body: JSON.stringify({ ...payload, accountId: Number(payload.accountId) })
  });
  return response.task;
}

export async function updateBookingTask(id: string, payload: Partial<TaskPayload>): Promise<BookingTask> {
  if (demoMode) {
    const task = copySnapshot().tasks.find((item) => item.id === id);
    if (!task) throw new Error('任务不存在');
    return { ...task, ...payload, accountId: String(payload.accountId ?? task.accountId) };
  }
  const body = payload.accountId === undefined ? payload : { ...payload, accountId: Number(payload.accountId) };
  const response = await platformRequest<{ task: BookingTask }>(`/platform/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body)
  });
  return response.task;
}

export async function deleteBookingTask(id: string): Promise<void> {
  if (demoMode) return;
  await platformRequest(`/platform/tasks/${id}`, { method: 'DELETE' });
}

export async function setBookingTaskEnabled(id: string, enabled: boolean): Promise<BookingTask> {
  if (demoMode) {
    const task = copySnapshot().tasks.find((item) => item.id === id);
    if (!task) throw new Error('任务不存在');
    return { ...task, enabled, status: enabled ? 'enabled' : 'paused', nextRun: enabled ? '明早 06:00:03' : '已暂停' };
  }
  const response = await platformRequest<{ task: BookingTask }>(`/platform/tasks/${id}/${enabled ? 'enable' : 'disable'}`, {
    method: 'POST'
  });
  return response.task;
}

export async function runBookingTask(id: string): Promise<BookingRun> {
  if (demoMode) {
    const task = copySnapshot().tasks.find((item) => item.id === id);
    if (!task) throw new Error('任务不存在');
    return {
      id: `run-${Date.now()}`,
      account: task.account,
      task: task.name,
      targetDate: new Date().toISOString().slice(0, 10),
      startedAt: '刚刚',
      status: 'pending',
      statusLabel: '排队中',
      attempts: 0,
      result: '已加入队列',
      detail: '演示模式不会调用真实预约接口。'
    };
  }
  const response = await platformRequest<{ run: BookingRun }>(`/platform/tasks/${id}/run`, {
    method: 'POST',
    body: JSON.stringify({})
  });
  return response.run;
}

export async function prewarmBookingTask(id: string): Promise<BookingRun> {
  if (demoMode) return runBookingTask(id);
  const response = await platformRequest<{ run: BookingRun }>(`/platform/tasks/${id}/prewarm`, {
    method: 'POST',
    body: JSON.stringify({})
  });
  return response.run;
}

export async function dryRunBookingTask(id: string): Promise<DryRunResult> {
  if (demoMode) {
    return {
      taskId: id,
      accountId: 'account-main',
      tokenStatus: 'valid',
      candidates: [{ order: 1, seatId: '197', startTime: 840, endTime: 1320 }],
      message: '演示模式；本次 dry-run 未发送预约请求。'
    };
  }
  const response = await platformRequest<{ dryRun: DryRunResult }>(`/platform/tasks/${id}/dry-run`, {
    method: 'POST'
  });
  return response.dryRun;
}

export async function getClientNotifications(): Promise<PlatformNotification[]> {
  if (demoMode) return [];
  const response = await platformRequest<{ notifications: PlatformNotification[] }>('/platform/notifications');
  return response.notifications;
}

export async function markNotificationRead(id: string): Promise<PlatformNotification> {
  const response = await platformRequest<{ notification: PlatformNotification }>(`/platform/notifications/${id}/read`, {
    method: 'PATCH'
  });
  return response.notification;
}

export async function markAllNotificationsRead(): Promise<void> {
  await platformRequest('/platform/notifications/read-all', { method: 'PATCH' });
}

export async function getAdminOverview(): Promise<AdminOverview> {
  return platformRequest<AdminOverview>('/platform/admin/overview');
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  const response = await platformRequest<{ users: AdminUser[] }>('/platform/admin/users');
  return response.users;
}

export async function setAdminUserEnabled(id: string, enabled: boolean): Promise<AdminUser> {
  const response = await platformRequest<{ user: AdminUser }>(`/platform/admin/users/${id}/${enabled ? 'enable' : 'disable'}`, {
    method: 'POST'
  });
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
  const response = await platformRequest<{ invitation: Invitation }>(`/platform/invitations/${id}`, {
    method: 'DELETE'
  });
  return response.invitation;
}

export async function signInPlatform(email: string, password: string): Promise<void> {
  await platformRequest('/platform/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  }, false);
}

export async function signUpPlatform(payload: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  inviteCode?: string;
}): Promise<void> {
  await platformRequest('/platform/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload)
  }, false);
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

function formatTime(minutes: number): string {
  return `${Math.floor(minutes / 60).toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`;
}
