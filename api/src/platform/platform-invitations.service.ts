import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import { EntityManager, Repository } from 'typeorm';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { CreateInvitationDto } from './dto/invitation.dto';
import { PlatformInvitationEntity } from './entities/platform-invitation.entity';
import { PlatformInvitationUseEntity } from './entities/platform-invitation-use.entity';
import { PlatformReferralEntity } from './entities/platform-referral.entity';
import { PlatformCryptoService } from './platform-crypto.service';

export type InvitationView = {
  id: string;
  code?: string;
  maxUses: number;
  usedCount: number;
  source: 'admin' | 'community';
  status: string;
  expiresAt: string | null;
  createdAt: string;
};

@Injectable()
export class PlatformInvitationsService {
  constructor(
    @InjectRepository(PlatformInvitationEntity)
    private readonly invitations: Repository<PlatformInvitationEntity>,
    private readonly crypto: PlatformCryptoService,
  ) {}

  async create(
    userId: number,
    dto: CreateInvitationDto,
  ): Promise<InvitationView> {
    const code = `SEAT-${randomBytes(5).toString('hex').toUpperCase()}`;
    const validDays = dto.validDays ?? 30;
    const invitation = this.invitations.create({
      codeHash: this.crypto.digest(code),
      maxUses: dto.maxUses ?? 1,
      usedCount: 0,
      source: 'admin',
      status: 'active',
      expiresAt: new Date(Date.now() + validDays * 24 * 60 * 60 * 1000),
      createdByUser: { id: userId } as UserEntity,
    });
    const saved = await this.invitations.save(invitation);
    return { ...this.toView(saved), code };
  }

  async consume(code: string): Promise<void> {
    await this.invitations.manager.transaction((manager) =>
      this.consumeWithinTransaction(manager, code),
    );
  }

  async consumeWithinTransaction(
    manager: EntityManager,
    code: string,
  ): Promise<PlatformInvitationEntity> {
    const repository = manager.getRepository(PlatformInvitationEntity);
    const invitation = await repository
      .createQueryBuilder('invitation')
      .setLock('pessimistic_write')
      .leftJoinAndSelect('invitation.createdByUser', 'creator')
      .where('invitation."codeHash" = :codeHash', {
        codeHash: this.crypto.digest(code.trim()),
      })
      .getOne();
    if (
      !invitation ||
      invitation.status !== 'active' ||
      (invitation.expiresAt && invitation.expiresAt < new Date())
    ) {
      throw new UnprocessableEntityException('邀请码无效或已过期');
    }
    if (invitation.usedCount >= invitation.maxUses) {
      invitation.status = 'exhausted';
      await repository.save(invitation);
      throw new UnprocessableEntityException('邀请码已用完');
    }
    invitation.usedCount += 1;
    if (invitation.usedCount >= invitation.maxUses)
      invitation.status = 'exhausted';
    await repository.save(invitation);
    return invitation;
  }

  async recordUseWithinTransaction(
    manager: EntityManager,
    invitationId: number,
    userId: number,
  ): Promise<void> {
    const invitation = await manager
      .getRepository(PlatformInvitationEntity)
      .findOne({
        where: { id: invitationId },
        relations: ['createdByUser'],
      });
    if (!invitation) throw new NotFoundException('邀请码不存在');
    await manager.getRepository(PlatformInvitationUseEntity).save(
      manager.getRepository(PlatformInvitationUseEntity).create({
        invitation: { id: invitationId },
        invitationId,
        user: { id: userId },
        userId,
      }),
    );
    const referrerUserId =
      invitation.createdByUser?.id ?? invitation.createdByUserId;
    if (
      invitation.source === 'community' &&
      referrerUserId &&
      referrerUserId !== userId
    ) {
      await manager.getRepository(PlatformReferralEntity).save(
        manager.getRepository(PlatformReferralEntity).create({
          status: 'pending',
          qualifiedAt: null,
          referrerUser: { id: referrerUserId } as UserEntity,
          referredUser: { id: userId } as UserEntity,
          invitation: { id: invitationId } as PlatformInvitationEntity,
        }),
      );
    }
  }

  async list(): Promise<InvitationView[]> {
    const invitations = await this.invitations.find({
      order: { createdAt: 'DESC' },
    });
    return invitations.map((invitation) => this.toView(invitation));
  }

  async disable(id: number): Promise<InvitationView> {
    const invitation = await this.invitations.findOne({ where: { id } });
    if (!invitation) throw new NotFoundException('邀请码不存在');
    invitation.status = 'disabled';
    return this.toView(await this.invitations.save(invitation));
  }

  private toView(invitation: PlatformInvitationEntity): InvitationView {
    const expired =
      invitation.status === 'active' &&
      invitation.expiresAt !== null &&
      invitation.expiresAt < new Date();
    return {
      id: String(invitation.id),
      source: invitation.source,
      maxUses: invitation.maxUses,
      usedCount: invitation.usedCount,
      status: expired ? 'expired' : invitation.status,
      expiresAt: invitation.expiresAt?.toISOString() ?? null,
      createdAt: invitation.createdAt.toISOString(),
    };
  }
}
