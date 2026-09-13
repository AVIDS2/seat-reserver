import { describe, expect, it, jest } from '@jest/globals';
import { PlatformProfileShowcaseService } from './platform-profile-showcase.service';

function dateShift(date: string, amount: number): string {
  const value = new Date(`${date}T12:00:00+08:00`);
  value.setUTCDate(value.getUTCDate() + amount);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

function todayShanghai(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function makeService(options?: { pro?: boolean; points?: number }) {
  const today = todayShanghai();
  const checkIns = Array.from({ length: 7 }, (_, index) => {
    const date = dateShift(today, index - 6);
    return {
      eventKey: `user:7:activity:daily_check_in:${date}`,
      createdAt: new Date(`${date}T08:00:00+08:00`),
    };
  });
  const earned = [100, 100, 100].map((amount, index) => ({
    amount,
    createdAt: new Date(
      `2026-08-${String(index + 1).padStart(2, '0')}T09:00:00+08:00`,
    ),
  }));
  const decorations = {
    findOne: jest.fn(() =>
      Promise.resolve({
        id: 4,
        userId: 7,
        user: { id: 7 },
        avatarFrameId: 'plain',
        titleId: 'newcomer',
        badgeId: 'welcome',
        createdAt: new Date('2026-08-01T00:00:00Z'),
        updatedAt: new Date('2026-08-01T00:00:00Z'),
      }),
    ),
    find: jest.fn(() => Promise.resolve([])),
    save: jest.fn((value: Record<string, unknown>) =>
      Promise.resolve({ ...value, userId: 7 }),
    ),
  };
  const tasks = {
    findOne: jest.fn(() =>
      Promise.resolve({ id: 2, createdAt: new Date('2026-08-02T01:00:00Z') }),
    ),
  };
  const runs = {
    find: jest.fn(() =>
      Promise.resolve(
        Array.from({ length: 10 }, (_, index) => ({
          targetDate: `2026-08-${String(index + 1).padStart(2, '0')}`,
          createdAt: new Date(
            `2026-07-${String(index + 1).padStart(2, '0')}T01:00:00Z`,
          ),
        })),
      ),
    ),
  };
  const ledger = {
    find: jest.fn((query: { where: { eventType?: string } }) =>
      Promise.resolve(query.where.eventType ? checkIns : earned),
    ),
  };
  const memberships = {
    findOne: jest.fn(() =>
      Promise.resolve(
        options?.pro
          ? {
              plan: 'pro',
              proExpiresAt: null,
              proActivatedAt: new Date('2026-08-03T01:00:00Z'),
              userId: 7,
            }
          : null,
      ),
    ),
    find: jest.fn(() => Promise.resolve([])),
  };
  const service = new PlatformProfileShowcaseService(
    decorations as never,
    {
      findOne: jest.fn(() =>
        Promise.resolve({ pointsBalance: options?.points ?? 50 }),
      ),
    } as never,
    ledger as never,
    tasks as never,
    runs as never,
    memberships as never,
    {
      findOne: jest.fn(() =>
        Promise.resolve({ id: 7, createdAt: new Date('2026-07-01T00:00:00Z') }),
      ),
    } as never,
  );
  return { service, decorations, today };
}

describe('PlatformProfileShowcaseService', () => {
  it('should derive unlocks from real tasks, booking dates, check-ins, earned points, and membership', async () => {
    const { service, today } = makeService({ pro: true });

    const result = await service.getShowcase(7);

    expect(result.stats).toMatchObject({
      successCount: 10,
      activeDays: 10,
      checkInDays: 7,
      checkInStreak: 7,
      pointsEarned: 300,
      taskCount: 1,
    });
    expect(
      result.frames.find((item) => item.id === 'starlight')?.unlocked,
    ).toBe(true);
    expect(result.frames.find((item) => item.id === 'aurora')?.unlockedAt).toBe(
      earnedDate(3),
    );
    expect(
      result.titles.find((item) => item.id === 'task_setter')?.unlocked,
    ).toBe(true);
    expect(result.badges.find((item) => item.id === 'streak_7')?.unlocked).toBe(
      true,
    );
    expect(
      result.badges.find((item) => item.id === 'streak_7')?.unlockedAt,
    ).toBe(new Date(`${today}T08:00:00+08:00`).toISOString());
    expect(result.frames.find((item) => item.id === 'pro')?.unlocked).toBe(
      true,
    );
  });

  it('should reject locked selections on the server and persist unlocked selections', async () => {
    const { service, decorations } = makeService({ pro: false, points: 20 });

    await expect(
      service.updateShowcase(7, { avatarFrameId: 'pro' }),
    ).rejects.toThrow('头像框尚未解锁');

    await service.updateShowcase(7, { titleId: 'task_setter' });
    expect(decorations.save).toHaveBeenCalledWith(
      expect.objectContaining({
        titleId: 'task_setter',
        user: { id: 7 },
      }),
    );
  });
});

function earnedDate(index: number): string {
  return new Date(
    `2026-08-${String(index).padStart(2, '0')}T09:00:00+08:00`,
  ).toISOString();
}
