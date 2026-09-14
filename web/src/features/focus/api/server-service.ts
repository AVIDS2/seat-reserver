import { cookies } from 'next/headers';

import type { FocusRoom, FocusRoomsSnapshot } from '../types';

const baseUrl = process.env.INTERNAL_API_URL || 'http://api:3001/api/v1';

export async function getFocusRoomsServer(): Promise<FocusRoomsSnapshot> {
  return focusServerRequest<FocusRoomsSnapshot>('/platform/focus-rooms');
}

export async function getFocusRoomServer(id: string): Promise<FocusRoom> {
  const response = await focusServerRequest<{ room: FocusRoom }>(
    `/platform/focus-rooms/${encodeURIComponent(id)}`,
  );
  return response.room;
}

async function focusServerRequest<T>(path: string): Promise<T> {
  const cookieHeader = (await cookies()).toString();
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`专注房间加载失败（${response.status}）`);
  return response.json() as Promise<T>;
}
