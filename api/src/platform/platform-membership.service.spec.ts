import { describe, expect, it, jest } from '@jest/globals';
import { EntityManager, Repository } from 'typeorm';
import { RoleEnum } from '../roles/roles.enum';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { PlatformMembershipEntity } from './entities/platform-membership.entity';
import { PlatformProRequestEntity } from './entities/platform-pro-request.entity';
import { SchoolAccountEntity } from './entities/school-account.entity';
import { PlatformMembershipService } from './platform-membership.service';

describe('PlatformMembershipService', () => {
  it('should enforce the one-account limit for a free user', async () => {
    const userRepository = {
      findOne: jest.fn<() => Promise<unknown>>().mockResolvedValue({
        id: 7,
        role: { id: RoleEnum.user },
      }),
    };
    const membershipRepository = {
      findOne: jest.fn<() => Promise<unknown>>().mockResolvedValue(null),
    };
    const accountRepository = {
      count: jest.fn<() => Promise<number>>().mockResolvedValue(1),
    };
    const manager = {
      query: jest.fn(),
      getRepository: jest.fn((entity: unknown) => {
        if (entity === UserEntity) return userRepository;
        if (entity === PlatformMembershipEntity) return membershipRepository;
        return accountRepository;
      }),
    } as unknown as EntityManager;
    const service = new PlatformMembershipService(
      {} as Repository<PlatformMembershipEntity>,
      {} as Repository<PlatformProRequestEntity>,
      {} as Repository<SchoolAccountEntity>,
      {} as Repository<UserEntity>,
      {} as never,
    );

    await expect(
      service.assertCanCreateSchoolAccount(7, manager),
    ).rejects.toThrow('当前方案最多绑定 1 个校园账号');
    expect(manager.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      ['platform-school-account-limit:7'],
    );
  });

  it('should allow a Pro user to add a third account', async () => {
    const manager = {
      query: jest.fn(),
      getRepository: jest.fn((entity: unknown) => {
        if (entity === UserEntity)
          return {
            findOne: jest.fn<() => Promise<unknown>>().mockResolvedValue({
              id: 7,
              role: { id: RoleEnum.user },
            }),
          };
        if (entity === PlatformMembershipEntity)
          return {
            findOne: jest.fn<() => Promise<unknown>>().mockResolvedValue({
              plan: 'pro',
              proExpiresAt: null,
            }),
          };
        return { count: jest.fn<() => Promise<number>>().mockResolvedValue(2) };
      }),
    } as unknown as EntityManager;
    const service = new PlatformMembershipService(
      {} as Repository<PlatformMembershipEntity>,
      {} as Repository<PlatformProRequestEntity>,
      {} as Repository<SchoolAccountEntity>,
      {} as Repository<UserEntity>,
      {} as never,
    );

    await expect(
      service.assertCanCreateSchoolAccount(7, manager),
    ).resolves.toBeUndefined();
  });

  it('should not restrict an administrator with the member account limit', async () => {
    const manager = {
      query: jest.fn(),
      getRepository: jest.fn((entity: unknown) => {
        if (entity === UserEntity)
          return {
            findOne: jest.fn<() => Promise<unknown>>().mockResolvedValue({
              id: 1,
              role: { id: RoleEnum.admin },
            }),
          };
        return {
          findOne: jest.fn<() => Promise<unknown>>(),
          count: jest.fn<() => Promise<number>>(),
        };
      }),
    } as unknown as EntityManager;
    const service = new PlatformMembershipService(
      {} as Repository<PlatformMembershipEntity>,
      {} as Repository<PlatformProRequestEntity>,
      {} as Repository<SchoolAccountEntity>,
      {} as Repository<UserEntity>,
      {} as never,
    );

    await expect(
      service.assertCanCreateSchoolAccount(1, manager),
    ).resolves.toBeUndefined();
    expect(manager.query).toHaveBeenCalled();
  });
});
