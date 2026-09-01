import { bookingSnapshot } from '../data';
import type { BookingAccount, BookingRun, BookingSnapshot, BookingTask } from '../types';

export type CreateAccountPayload = {
  label: string;
  schoolUsername: string;
  schoolPassword: string;
};

export type CreateTaskPayload = {
  accountId: string;
  name: string;
  primarySeatId: string;
  backupSeatIds: string[];
  timeCandidates: Array<{ start: number; end: number }>;
};

const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';
const apiBase = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

function copySnapshot(): BookingSnapshot {
  return JSON.parse(JSON.stringify(bookingSnapshot)) as BookingSnapshot;
}

async function platformRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message || `请求失败（${response.status}）`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function isDemoMode(): boolean {
  return demoMode;
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

export async function createBookingTask(payload: CreateTaskPayload): Promise<BookingTask> {
  if (demoMode) {
    return {
      id: `task-${Date.now()}`,
      name: payload.name,
      account: '我的账号',
      accountId: String(payload.accountId),
      seat: `${payload.primarySeatId} 号`,
      seatId: payload.primarySeatId,
      time: payload.timeCandidates.map((item) => `${formatTime(item.start)} - ${formatTime(item.end)}`).join(' / '),
      nextRun: '明天 06:00:03',
      status: 'enabled',
      enabled: true,
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

export async function setBookingTaskEnabled(id: string, enabled: boolean): Promise<BookingTask> {
  if (demoMode) {
    const task = copySnapshot().tasks.find((item) => item.id === id);
    if (!task) throw new Error('任务不存在');
    return { ...task, enabled, status: enabled ? 'enabled' : 'paused', nextRun: enabled ? '明天 06:00:03' : '已暂停' };
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
      status: 'running',
      statusLabel: '执行中',
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

export async function signInPlatform(email: string, password: string): Promise<void> {
  await platformRequest('/platform/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

export async function signUpPlatform(payload: { email: string; password: string; firstName: string; lastName: string; inviteCode?: string }): Promise<void> {
  await platformRequest('/platform/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

function formatTime(minutes: number): string {
  return `${Math.floor(minutes / 60).toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`;
}
