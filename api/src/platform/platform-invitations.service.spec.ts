import { describe, expect, it, jest } from '@jest/globals';
import { PlatformInvitationsService } from './platform-invitations.service';

describe('PlatformInvitationsService', () => {
  it('should lock the invitation row without locking a nullable creator join', async () => {
    const invitation = {
      id: 42,
      status: 'active',
      expiresAt: null,
      usedCount: 0,
      maxUses: 1,
    };
    const queryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(() => Promise.resolve(invitation)),
      leftJoinAndSelect: jest.fn(),
    };
    const repository = {
      createQueryBuilder: jest.fn(() => queryBuilder),
      save: jest.fn((value: unknown) => Promise.resolve(value)),
    };
    const manager = {
      getRepository: jest.fn(() => repository),
    };
    const crypto = { digest: jest.fn(() => 'hashed-code') };
    const service = new PlatformInvitationsService(
      repository as never,
      crypto as never,
    );

    await expect(
      service.consumeWithinTransaction(manager as never, ' CODE '),
    ).resolves.toBe(invitation);

    expect(queryBuilder.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(queryBuilder.leftJoinAndSelect).not.toHaveBeenCalled();
    expect(queryBuilder.where).toHaveBeenCalledWith(
      'invitation."codeHash" = :codeHash',
      { codeHash: 'hashed-code' },
    );
  });
});
