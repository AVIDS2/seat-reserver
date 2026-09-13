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
    const showcase = {
      getPublicDecorations: jest.fn(() => Promise.resolve(new Map())),
    };
    const service = new PlatformLeaderboardService(
      runs as never,
      showcase as never,
    );

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

  it('should show rank movement against the previous equal-length week window', async () => {
    const resultSets = [
      [
        {
          userId: 7,
          targetDate: '2026-09-08',
          reservedBegin: '08:00',
          reservedEnd: '16:00',
          user: { firstName: '张', lastName: '涛', photo: null },
        },
        {
          userId: 8,
          targetDate: '2026-09-08',
          reservedBegin: '08:00',
          reservedEnd: '11:00',
          user: { firstName: '李', lastName: '同学', photo: null },
        },
      ],
      [
        {
          userId: 7,
          targetDate: '2026-09-01',
          reservedBegin: '08:00',
          reservedEnd: '10:00',
          user: { firstName: '张', lastName: '涛', photo: null },
        },
        {
          userId: 8,
          targetDate: '2026-09-01',
          reservedBegin: '08:00',
          reservedEnd: '16:00',
          user: { firstName: '李', lastName: '同学', photo: null },
        },
      ],
    ];
    const runs = {
      find: jest.fn(() => Promise.resolve(resultSets.shift() ?? [])),
    };
    const showcase = {
      getPublicDecorations: jest.fn(() => Promise.resolve(new Map())),
    };
    const service = new PlatformLeaderboardService(
      runs as never,
      showcase as never,
    );

    const result = await service.getSnapshot(7, 'week');

    expect(result.rankings[0]).toMatchObject({
      userId: '7',
      rank: 1,
      previousRank: 2,
      rankChange: 1,
    });
    expect(result.rankings[1]).toMatchObject({
      userId: '8',
      rank: 2,
      previousRank: 1,
      rankChange: -1,
    });
    expect(runs.find).toHaveBeenCalledTimes(2);
  });
});
