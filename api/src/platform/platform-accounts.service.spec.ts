import { describe, expect, it, jest } from '@jest/globals';
import { Repository } from 'typeorm';
import { PlatformAccountsService } from './platform-accounts.service';
import { SchoolAccountEntity } from './entities/school-account.entity';
import { BookingTaskEntity } from './entities/booking-task.entity';

describe('PlatformAccountsService', () => {
  it('should authenticate before saving and store only encrypted credentials', async () => {
    const authenticate =
      jest.fn<
        (
          username: string,
          password: string,
          mode?: 'direct' | 'webvpn',
          serviceType?: 'study_room' | 'library',
        ) => Promise<{ token: string; mode: 'direct' | 'webvpn' }>
      >();
    authenticate.mockResolvedValue({ token: 'token-123', mode: 'direct' });
    const verifyToken =
      jest.fn<
        (
          token: string,
          mode: 'direct' | 'webvpn',
        ) => Promise<{ success: boolean }>
      >();
    verifyToken.mockResolvedValue({ success: true });
    const account = {
      id: 5,
      label: '我的账号',
      schoolUsername: '2300906131',
      encryptedSchoolPassword: 'encrypted-password',
      encryptedToken: 'encrypted-token',
      status: 'active',
      tokenRefreshedAt: new Date(),
      lastVerifiedAt: new Date(),
      userId: 7,
    } as unknown as SchoolAccountEntity;
    const save = jest.fn(() => Promise.resolve(account));
    const accounts = {
      create: jest.fn((value) => value),
      save,
    } as unknown as Repository<SchoolAccountEntity>;
    const tasks = {
      count: jest.fn(() => Promise.resolve(0)),
    } as unknown as Repository<BookingTaskEntity>;
    const crypto = {
      encrypt: jest.fn((value: string) => `encrypted:${value}`),
    };
    const serviceConnections = {
      saveAuthenticated: jest.fn(() => Promise.resolve({})),
      listForAccount: jest.fn(() => Promise.resolve([])),
    };

    const service = new PlatformAccountsService(
      accounts,
      tasks,
      crypto as never,
      { authenticate, verifyToken } as never,
      serviceConnections as never,
    );

    await service.create(7, {
      label: ' 我的账号 ',
      schoolUsername: ' 2300906131 ',
      schoolPassword: 'school-password',
    });

    expect(authenticate).toHaveBeenCalledWith(
      '2300906131',
      'school-password',
      undefined,
      'study_room',
    );
    expect(verifyToken).toHaveBeenCalledWith('token-123', 'direct');
    expect(crypto.encrypt).toHaveBeenCalledWith('school-password');
    expect(crypto.encrypt).toHaveBeenCalledWith('token-123');
    expect(save).toHaveBeenCalled();
  });

  it('should look up accounts with the current user id', async () => {
    const findOne =
      jest.fn<(options: unknown) => Promise<SchoolAccountEntity | null>>();
    findOne.mockResolvedValue(null);
    const accounts = { findOne } as unknown as Repository<SchoolAccountEntity>;
    const tasks = {
      count: jest.fn(),
    } as unknown as Repository<BookingTaskEntity>;
    const service = new PlatformAccountsService(
      accounts,
      tasks,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.findOwned(7, 5)).rejects.toThrow('账号不存在');
    expect(findOne).toHaveBeenCalledWith({
      where: { id: 5, user: { id: 7 } },
      relations: ['user'],
    });
  });
});
