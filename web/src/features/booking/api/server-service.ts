import { cookies } from 'next/headers';
import { bookingSnapshot } from '../data';
import type { BookingSnapshot, PlatformNotification } from '../types';
import type {
  AdminOverview,
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
  const [overview, usersResponse, invitationResponse] = await Promise.all([
    platformServerRequest<AdminOverview>('/platform/admin/overview'),
    platformServerRequest<{ users: AdminUser[] }>('/platform/admin/users'),
    platformServerRequest<{ invitations: Invitation[] }>('/platform/invitations')
  ]);
  return {
    overview,
    users: usersResponse.users,
    invitations: invitationResponse.invitations
  };
}

async function platformServerRequest<T>(path: string): Promise<T> {
  const cookieHeader = (await cookies()).toString();
  let response = await fetch(`${baseUrl}${path}`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store'
  });

  if (response.status === 401) {
    const refreshResponse = await fetch(`${baseUrl}/platform/auth/refresh`, {
      method: 'POST',
      headers: { cookie: cookieHeader },
      cache: 'no-store'
    });
    if (refreshResponse.ok) {
      response = await fetch(`${baseUrl}${path}`, {
        headers: { cookie: mergeCookies(cookieHeader, refreshResponse.headers) },
        cache: 'no-store'
      });
    }
  }

  if (!response.ok) throw new Error(`平台数据加载失败（${response.status}）`);
  return response.json() as Promise<T>;
}

function mergeCookies(original: string, headers: Headers): string {
  const result = new Map<string, string>();
  for (const part of original.split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name && value.length) result.set(name, value.join('='));
  }
  const responseHeaders = headers as Headers & { getSetCookie?: () => string[] };
  const setCookies = responseHeaders.getSetCookie?.() || [headers.get('set-cookie') || ''];
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
