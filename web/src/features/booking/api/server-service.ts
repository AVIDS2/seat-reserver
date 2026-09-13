import { cookies } from 'next/headers';
import type { BookingSnapshot, PlatformNotification } from '../types';
import type {
  AdminOverview,
  AdminAccount,
  AdminRun,
  AdminTask,
  AdminUser,
  AdminProRequest,
  Invitation,
  PlatformUser,
  RewardsSnapshot,
  ProfileDecoration
} from './service';
import { normalizeAvatarUrl } from '@/lib/avatar-url';

const baseUrl = process.env.INTERNAL_API_URL || 'http://api:3001/api/v1';

export type AdminSnapshot = {
  overview: AdminOverview;
  users: AdminUser[];
  invitations: Invitation[];
  accounts: AdminAccount[];
  tasks: AdminTask[];
  runs: AdminRun[];
  proRequests: AdminProRequest[];
};

export async function getBookingSnapshot(): Promise<BookingSnapshot> {
  return platformServerRequest<BookingSnapshot>('/platform/dashboard');
}

export async function getPlatformUserServer(): Promise<PlatformUser | null> {
  try {
    const response = await platformServerRequest<{
      user: Record<string, unknown>;
      profileDecoration?: ProfileDecoration;
    }>('/platform/auth/me');
    return toPlatformUser({ ...response.user, profileDecoration: response.profileDecoration });
  } catch {
    return null;
  }
}

export async function getBookingNotifications(): Promise<PlatformNotification[]> {
  const response = await platformServerRequest<{ notifications: PlatformNotification[] }>(
    '/platform/notifications'
  );
  return response.notifications;
}

export async function getAdminSnapshot(): Promise<AdminSnapshot> {
  const [
    overview,
    usersResponse,
    invitationResponse,
    accountsResponse,
    tasksResponse,
    runsResponse,
    proRequestsResponse
  ] = await Promise.all([
    platformServerRequest<AdminOverview>('/platform/admin/overview'),
    platformServerRequest<{ users: AdminUser[] }>('/platform/admin/users'),
    platformServerRequest<{ invitations: Invitation[] }>('/platform/invitations'),
    platformServerRequest<{ accounts: AdminAccount[] }>('/platform/admin/accounts'),
    platformServerRequest<{ tasks: AdminTask[] }>('/platform/admin/tasks'),
    platformServerRequest<{ runs: AdminRun[] }>('/platform/admin/runs'),
    platformServerRequest<{ requests: AdminProRequest[] }>('/platform/admin/pro-requests')
  ]);
  return {
    overview,
    users: usersResponse.users,
    invitations: invitationResponse.invitations,
    accounts: accountsResponse.accounts,
    tasks: tasksResponse.tasks,
    runs: runsResponse.runs,
    proRequests: proRequestsResponse.requests
  };
}

export async function getRewardsSnapshotServer(): Promise<RewardsSnapshot> {
  return platformServerRequest<RewardsSnapshot>('/platform/rewards');
}

async function platformServerRequest<T>(path: string): Promise<T> {
  const cookieHeader = (await cookies()).toString();
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store'
  });

  if (!response.ok) throw new Error(`平台数据加载失败（${response.status}）`);
  return response.json() as Promise<T>;
}

function toPlatformUser(value: Record<string, unknown>): PlatformUser {
  const role = value.role as { id?: number } | null | undefined;
  const status = value.status as { id?: number } | null | undefined;
  const firstName = typeof value.firstName === 'string' ? value.firstName : '';
  const lastName = typeof value.lastName === 'string' ? value.lastName : '';
  const photo = value.photo as { path?: string } | null | undefined;
  return {
    id: String(value.id),
    email: typeof value.email === 'string' ? value.email : '',
    firstName,
    lastName,
    displayName: [firstName, lastName].filter(Boolean).join(' ') || '平台用户',
    avatarUrl: normalizeAvatarUrl(photo?.path),
    role: Number(role?.id) === 1 ? 'admin' : 'user',
    status: Number(status?.id) === 1 ? 'active' : 'disabled',
    profileDecoration: value.profileDecoration as ProfileDecoration | undefined
  };
}
