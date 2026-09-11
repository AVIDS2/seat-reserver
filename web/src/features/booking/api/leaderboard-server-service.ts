import { cookies } from 'next/headers';
import type { LeaderboardPeriod, LeaderboardSnapshot } from './service';

const baseUrl = process.env.INTERNAL_API_URL || 'http://api:3001/api/v1';

export async function getLeaderboardSnapshotServer(
  period: LeaderboardPeriod = 'week',
): Promise<LeaderboardSnapshot> {
  const cookieHeader = (await cookies()).toString();
  const response = await fetch(`${baseUrl}/platform/leaderboard?period=${period}`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`排行榜数据加载失败（${response.status}）`);
  return response.json() as Promise<LeaderboardSnapshot>;
}
