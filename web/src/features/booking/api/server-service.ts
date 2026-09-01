import { cookies } from 'next/headers';
import { bookingSnapshot } from '../data';
import type { BookingSnapshot } from '../types';

export async function getBookingSnapshot(): Promise<BookingSnapshot> {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'false') return copySnapshot();

  const cookieHeader = (await cookies()).toString();
  const baseUrl = process.env.INTERNAL_API_URL || 'http://api:3001/api/v1';
  const response = await fetch(`${baseUrl}/platform/dashboard`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store'
  });

  if (!response.ok) throw new Error(`平台数据加载失败（${response.status}）`);
  return response.json() as Promise<BookingSnapshot>;
}

function copySnapshot(): BookingSnapshot {
  return JSON.parse(JSON.stringify(bookingSnapshot)) as BookingSnapshot;
}
