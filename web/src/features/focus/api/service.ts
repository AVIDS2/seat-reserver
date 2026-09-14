import type {
  CreateFocusRoomInput,
  FocusRoom,
  FocusRoomsSnapshot,
} from '../types';

const apiBase = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${apiBase}/platform/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function focusRequest<T>(
  path: string,
  options: RequestInit = {},
  allowRefresh = true,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
  } catch {
    throw new Error('网络暂时不可用，请稍后再试');
  }

  if (response.status === 401 && allowRefresh && !path.includes('/auth/')) {
    if (await refreshSession()) return focusRequest<T>(path, options, false);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
      errors?: Record<string, string>;
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join('；')
      : body?.message ||
        Object.values(body?.errors || {})[0] ||
        `请求失败（${response.status}）`;
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function getFocusRooms(): Promise<FocusRoomsSnapshot> {
  return focusRequest<FocusRoomsSnapshot>('/platform/focus-rooms');
}

export async function createFocusRoom(
  input: CreateFocusRoomInput,
): Promise<FocusRoom> {
  const response = await focusRequest<{ room: FocusRoom }>('/platform/focus-rooms', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response.room;
}

export async function joinFocusRoom(code: string): Promise<FocusRoom> {
  const response = await focusRequest<{ room: FocusRoom }>('/platform/focus-rooms/join', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
  return response.room;
}

export async function getFocusRoom(id: string): Promise<FocusRoom> {
  const response = await focusRequest<{ room: FocusRoom }>(`/platform/focus-rooms/${id}`);
  return response.room;
}

export async function heartbeatFocusRoom(id: string): Promise<FocusRoom> {
  const response = await focusRequest<{ room: FocusRoom }>(
    `/platform/focus-rooms/${id}/heartbeat`,
    { method: 'POST' },
  );
  return response.room;
}

export async function setFocusPresence(
  id: string,
  focused: boolean,
): Promise<FocusRoom> {
  const response = await focusRequest<{ room: FocusRoom }>(
    `/platform/focus-rooms/${id}/me`,
    {
      method: 'PATCH',
      body: JSON.stringify({ focused }),
    },
  );
  return response.room;
}

export async function focusRoomTimerAction(
  id: string,
  action: 'start' | 'pause' | 'reset',
): Promise<FocusRoom> {
  const response = await focusRequest<{ room: FocusRoom }>(
    `/platform/focus-rooms/${id}/timer/${action}`,
    { method: 'POST' },
  );
  return response.room;
}

export async function leaveFocusRoom(id: string): Promise<void> {
  await focusRequest(`/platform/focus-rooms/${id}/leave`, { method: 'POST' });
}

export async function closeFocusRoom(id: string): Promise<void> {
  await focusRequest(`/platform/focus-rooms/${id}/close`, { method: 'POST' });
}
