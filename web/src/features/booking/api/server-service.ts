import { cookies } from 'next/headers';
import { cache } from 'react';
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
  return platformServerRequest<BookingSnapshot>('/platform/dashboard');
}

export async function getPlatformUserServer(): Promise<PlatformUser | null> {
  try {
    const response = await platformServerRequest<{ user: Record<string, unknown> }>('/platform/auth/me');
    return toPlatformUser(response.user);
  } catch {
    return null;
  }
}

export async function getBookingNotifications(): Promise<PlatformNotification[]> {
  const response = await platformServerRequest<{ notifications: PlatformNotification[] }>('/platform/notifications');
  return response.notifications;
}

export async function getAdminSnapshot(): Promise<AdminSnapshot> {
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
