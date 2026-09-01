import { cookies } from 'next/headers';
import { cache } from 'react';
import { bookingSnapshot } from '../data';
import type { BookingSnapshot, PlatformNotification } from '../types';
import type {
  AdminOverview,
  AdminAccount,
  AdminRun,
  AdminTask,
  AdminUser,
  Invitation,
  PlatformUser
} from './service';

const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';
const baseUrl = process.env.INTERNAL_API_URL || 'http://api:3001/api/v1';

export type AdminSnapshot = {
  overview: AdminOverview;
  users: AdminUser[];
  invitations: Invitation[];
  accounts: AdminAccount[];
  tasks: AdminTask[];
  runs: AdminRun[];
};

export async function getBookingSnapshot(): Promise<BookingSnapshot> {
  if (demoMode) return copySnapshot();
  return platformServerRequest<BookingSnapshot>('/platform/dashboard');
}

export async function getPlatformUserServer(): Promise<PlatformUser | null> {
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
  try {
    const response = await platformServerRequest<{ user: Record<string, unknown> }>('/platform/auth/me');
    return toPlatformUser(response.user);
  } catch {
    return null;
  }
}

export async function getBookingNotifications(): Promise<PlatformNotification[]> {
  if (demoMode) return [];
  const response = await platformServerRequest<{ notifications: PlatformNotification[] }>('/platform/notifications');
  return response.notifications;
}

export async function getAdminSnapshot(): Promise<AdminSnapshot> {
  if (demoMode) {
    return {
      overview: {
        users: 2,
        activeUsers: 2,
        accounts: bookingSnapshot.accounts.length,
        connectedAccounts: bookingSnapshot.accounts.length,
        tasks: bookingSnapshot.tasks.length,
        enabledTasks: bookingSnapshot.tasks.filter((task) => task.enabled).length,
        runsToday: bookingSnapshot.runs.filter((run) => run.targetDate === bookingSnapshot.summary.executionDate).length,
        successfulRunsToday: bookingSnapshot.runs.filter((run) => run.status === 'success').length,
        failedRunsToday: bookingSnapshot.runs.filter((run) => run.status === 'failed').length,
        queueStatus: 'ok',
        serverTime: new Date().toISOString()
      },
      users: [
        { id: 'demo-admin', email: 'admin@example.com', displayName: '平台管理员', role: 'admin', status: 'active', accountCount: 1, taskCount: 2, createdAt: new Date().toISOString() },
        { id: 'demo-user', email: 'member@example.com', displayName: '示例同学', role: 'user', status: 'active', accountCount: 1, taskCount: 1, createdAt: new Date().toISOString() }
      ],
      invitations: [],
      accounts: bookingSnapshot.accounts.map((account, index) => ({
        id: account.id,
        label: account.label,
        username: account.username,
        status: account.status,
        statusLabel: account.statusLabel,
        tokenLabel: account.tokenLabel,
        ownerName: index === 0 ? '平台管理员' : '示例同学',
        ownerEmail: index === 0 ? 'admin@example.com' : 'member@example.com',
        taskCount: account.tasks,
        lastVerifiedAt: new Date().toISOString()
      })),
      tasks: bookingSnapshot.tasks.map((task, index) => ({
        id: task.id,
        name: task.name,
        ownerName: index === 1 ? '示例同学' : '平台管理员',
        ownerEmail: index === 1 ? 'member@example.com' : 'admin@example.com',
        account: task.account,
        seat: task.seat,
        time: task.time,
        enabled: task.enabled,
        status: task.status,
        lastRun: null,
        lastMessage: task.lastMessage
      })),
      runs: bookingSnapshot.runs.map((run) => ({
        id: run.id,
        runType: 'booking',
        ownerName: run.account === '朋友账号' ? '示例同学' : '平台管理员',
        ownerEmail: run.account === '朋友账号' ? 'member@example.com' : 'admin@example.com',
        task: run.task,
        account: run.account,
        targetDate: run.targetDate,
        status: run.status,
        statusLabel: run.statusLabel,
        attempts: run.attempts,
        result: run.result,
        detail: run.detail,
        startedAt: new Date().toISOString()
      }))
    };
  }
  const [overview, usersResponse, invitationResponse, accountsResponse, tasksResponse, runsResponse] = await Promise.all([
    platformServerRequest<AdminOverview>('/platform/admin/overview'),
    platformServerRequest<{ users: AdminUser[] }>('/platform/admin/users'),
    platformServerRequest<{ invitations: Invitation[] }>('/platform/invitations'),
    platformServerRequest<{ accounts: AdminAccount[] }>('/platform/admin/accounts'),
    platformServerRequest<{ tasks: AdminTask[] }>('/platform/admin/tasks'),
    platformServerRequest<{ runs: AdminRun[] }>('/platform/admin/runs')
  ]);
  return {
    overview,
    users: usersResponse.users,
    invitations: invitationResponse.invitations,
    accounts: accountsResponse.accounts,
    tasks: tasksResponse.tasks,
    runs: runsResponse.runs
  };
}

async function platformServerRequest<T>(path: string): Promise<T> {
  const cookieHeader = (await cookies()).toString();
  let response = await fetch(`${baseUrl}${path}`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store'
  });

  if (response.status === 401) {
    const refreshCookies = await refreshServerSession(cookieHeader);
    if (refreshCookies) {
      response = await fetch(`${baseUrl}${path}`, {
        headers: { cookie: mergeCookies(cookieHeader, refreshCookies) },
        cache: 'no-store'
      });
    }
  }

  if (!response.ok) throw new Error(`平台数据加载失败（${response.status}）`);
  return response.json() as Promise<T>;
}

const refreshServerSession = cache(async (cookieHeader: string): Promise<string[] | null> => {
  const response = await fetch(`${baseUrl}/platform/auth/refresh`, {
    method: 'POST',
    headers: { cookie: cookieHeader },
    cache: 'no-store'
  });
  if (!response.ok) return null;
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const setCookies = headers.getSetCookie?.() || [response.headers.get('set-cookie') || ''];
  return setCookies.filter(Boolean);
});

function mergeCookies(original: string, setCookies: string[]): string {
  const result = new Map<string, string>();
  for (const part of original.split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name && value.length) result.set(name, value.join('='));
  }
  for (const cookie of setCookies) {
    const pair = cookie.split(';', 1)[0];
    const [name, ...value] = pair.split('=');
    if (name && value.length) result.set(name, value.join('='));
  }
  return Array.from(result.entries()).map(([name, value]) => `${name}=${value}`).join('; ');
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

function copySnapshot(): BookingSnapshot {
  return JSON.parse(JSON.stringify(bookingSnapshot)) as BookingSnapshot;
}
