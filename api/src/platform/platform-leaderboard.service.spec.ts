import { describe, expect, it, jest } from '@jest/globals';
import { PlatformLeaderboardService } from './platform-leaderboard.service';

describe('PlatformLeaderboardService', () => {
  it('should merge overlapping successful reservations for one user', async () => {
    const runs = {
      find: jest.fn(() =>
        Promise.resolve([
          {
            userId: 7,
            targetDate: '2026-09-08',
            reservedBegin: '14:00',
            reservedEnd: '22:00',
            user: { firstName: '张', lastName: '涛', photo: null },
          },
          {
            userId: 7,
            targetDate: '2026-09-08',
            reservedBegin: '16:00',
            reservedEnd: '20:00',
            user: { firstName: '张', lastName: '涛', photo: null },
          },
          {
            userId: 8,
            targetDate: '2026-09-08',
            reservedBegin: '12:00',
            reservedEnd: '15:00',
            user: { firstName: '伯', lastName: '乐', photo: null },
          },
        ]),
      ),
    };
    const service = new PlatformLeaderboardService(runs as never);

    const result = await service.getSnapshot(7, 'all');

    expect(result.rankings[0]).toMatchObject({
      userId: '7',
      userName: '张 涛',
      value: 480,
      valueLabel: '8 小时',
      activeDays: 1,
      sessions: 2,
      avatarUrl: null,
    });
    expect(result.rankings[1]).toMatchObject({ userId: '8', value: 180 });
    expect(result.currentUser?.rank).toBe(1);
    expect(result.participantCount).toBe(2);
  });
});
