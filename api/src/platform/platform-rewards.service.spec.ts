import { describe, expect, it, jest } from '@jest/globals';
import { PlatformRewardsService } from './platform-rewards.service';

describe('PlatformRewardsService activities', () => {
  it('should keep a daily check-in idempotent when its ledger key already exists', async () => {
    const ledger = {
      findOne: jest.fn(() =>
        Promise.resolve({
          balanceAfter: 30,
          eventKey: 'user:7:activity:daily_check_in:2026-09-08',
        }),
      ),
    };
    const wallets = {
      findOne: jest.fn(() => Promise.resolve({ pointsBalance: 45 })),
    };
    const dataSource = { transaction: jest.fn() };
    const service = new PlatformRewardsService(
      {} as never,
      wallets as never,
      ledger as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      dataSource as never,
    );

    const result = await service.checkIn(7);

    expect(result.pointsBalance).toBe(45);
    expect(result.activity.id).toBe('daily_check_in');
    expect(result.activity.status).toBe('claimed');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
