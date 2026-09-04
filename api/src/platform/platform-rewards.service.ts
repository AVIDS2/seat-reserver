import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { PlatformCryptoService } from './platform-crypto.service';
import { PlatformInvitationEntity } from './entities/platform-invitation.entity';
import { PlatformPointsLedgerEntity } from './entities/platform-points-ledger.entity';
import { PlatformPointsWalletEntity } from './entities/platform-points-wallet.entity';
import { PlatformReferralEntity } from './entities/platform-referral.entity';
import {
  DEFAULT_DAILY_ACTIVITY_POINTS,
  DEFAULT_INVITE_POINTS_COST,
  DEFAULT_INVITE_VALID_DAYS,
  DEFAULT_REFERRAL_REWARD_POINTS,
} from './platform-growth.constants';
import {
  MembershipView,
  ProRequestView,
  PlatformMembershipService,
} from './platform-membership.service';

export type CommunityInvitationView = {
  id: string;
  maxUses: number;
  usedCount: number;
  status: 'active' | 'disabled' | 'exhausted' | 'expired';
  expiresAt: string | null;
  createdAt: string;
};

export type PointsLedgerView = {
  id: string;
  amount: number;
  balanceAfter: number;
  eventType: string;
  description: string;
  createdAt: string;
};

export type RewardsSnapshot = {
  membership: MembershipView;
  pointsBalance: number;
  invitePointsCost: number;
  dailyActivityPoints: number;
  referralRewardPoints: number;
  inviteValidDays: number;
  proRequest: ProRequestView | null;
  referrals: {
    pending: number;
    qualified: number;
    total: number;
  };
  invitations: CommunityInvitationView[];
  ledger: PointsLedgerView[];
};

@Injectable()
export class PlatformRewardsService {
  constructor(
    @InjectRepository(PlatformInvitationEntity)
    private readonly invitations: Repository<PlatformInvitationEntity>,
    @InjectRepository(PlatformPointsWalletEntity)
    private readonly wallets: Repository<PlatformPointsWalletEntity>,
    @InjectRepository(PlatformPointsLedgerEntity)
    private readonly ledger: Repository<PlatformPointsLedgerEntity>,
    @InjectRepository(PlatformReferralEntity)
    private readonly referrals: Repository<PlatformReferralEntity>,
    private readonly crypto: PlatformCryptoService,
    private readonly membership: PlatformMembershipService,
    private readonly dataSource: DataSource,
  ) {}

  async getSnapshot(userId: number): Promise<RewardsSnapshot> {
    const [membership, wallet, invitations, referrals, ledger, proRequest] =
      await Promise.all([
        this.membership.getEntitlement(userId),
        this.wallets.findOne({ where: { user: { id: userId } } }),
        this.invitations.find({
          where: { createdByUser: { id: userId }, source: 'community' },
          order: { createdAt: 'DESC' },
          take: 20,
        }),
        this.referrals.find({
          where: { referrerUser: { id: userId } },
          order: { createdAt: 'DESC' },
          take: 100,
        }),
        this.ledger.find({
          where: { user: { id: userId } },
          order: { createdAt: 'DESC' },
          take: 20,
        }),
        this.membership.getPendingProRequest(userId),
      ]);

    return {
      membership,
      pointsBalance: wallet?.pointsBalance ?? 0,
      invitePointsCost: this.invitePointsCost(),
      dailyActivityPoints: this.dailyActivityPoints(),
      referralRewardPoints: this.referralRewardPoints(),
      inviteValidDays: this.inviteValidDays(),
      proRequest,
      referrals: {
        pending: referrals.filter((referral) => referral.status === 'pending')
          .length,
        qualified: referrals.filter(
          (referral) => referral.status === 'qualified',
        ).length,
        total: referrals.length,
      },
      invitations: invitations.map((invitation) =>
        this.toInvitationView(invitation),
      ),
      ledger: ledger.map((entry) => this.toLedgerView(entry)),
    };
  }

  async redeemInvitation(userId: number): Promise<{
    invitation: CommunityInvitationView;
    code: string;
    pointsBalance: number;
  }> {
    const pointsCost = this.invitePointsCost();
    return this.dataSource.transaction(async (manager) => {
      const code = `SEAT-${randomBytes(5).toString('hex').toUpperCase()}`;
      const invitationRepository = manager.getRepository(
        PlatformInvitationEntity,
      );
      const invitation = invitationRepository.create({
        codeHash: this.crypto.digest(code),
        maxUses: 1,
        usedCount: 0,
        status: 'active',
        source: 'community',
        expiresAt: new Date(
          Date.now() + this.inviteValidDays() * 24 * 60 * 60 * 1000,
        ),
        createdByUser: { id: userId } as UserEntity,
      });
      const saved = await invitationRepository.save(invitation);

      const entry = await this.applyPointsWithinTransaction(
        manager,
        userId,
        -pointsCost,
        `user:${userId}:invite:${saved.id}`,
        'invite_redeemed',
        '兑换一个好友邀请码',
        { invitationId: saved.id },
      );
      return {
        invitation: this.toInvitationView(saved),
        code,
        pointsBalance: entry.balanceAfter,
      };
    });
  }

  async recordVerifiedActivity(userId: number): Promise<void> {
    const date = getShanghaiDate();
    await this.dataSource.transaction((manager) =>
      this.applyPointsWithinTransaction(
        manager,
        userId,
        this.dailyActivityPoints(),
        `user:${userId}:activity:${date}`,
        'daily_activity',
        '完成今日账号验证',
        { date },
      ).then(() => undefined),
    );
  }

  async qualifyReferral(referredUserId: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const referral = await manager
        .getRepository(PlatformReferralEntity)
        .createQueryBuilder('referral')
        .setLock('pessimistic_write')
        .where('referral.referredUserId = :referredUserId', {
          referredUserId,
        })
        .andWhere('referral.status = :status', { status: 'pending' })
        .getOne();
      if (!referral) return;

      await this.applyPointsWithinTransaction(
        manager,
        referral.referrerUserId,
        this.referralRewardPoints(),
        `user:${referral.referrerUserId}:referral:${referral.id}`,
        'referral_qualified',
        '好友完成首次账号验证',
        { referralId: referral.id },
      );
      referral.status = 'qualified';
      referral.qualifiedAt = new Date();
      await manager.getRepository(PlatformReferralEntity).save(referral);
    });
  }

  private async applyPointsWithinTransaction(
    manager: EntityManager,
    userId: number,
    amount: number,
    eventKey: string,
    eventType: string,
    description: string,
    metadata: Record<string, unknown>,
  ): Promise<PlatformPointsLedgerEntity> {
    await manager.query(
      `INSERT INTO "platform_points_wallet" ("userId", "pointsBalance")
       VALUES ($1, 0)
       ON CONFLICT ("userId") DO NOTHING`,
      [userId],
    );
    const wallets = manager.getRepository(PlatformPointsWalletEntity);
    const ledger = manager.getRepository(PlatformPointsLedgerEntity);
    const wallet = await wallets
      .createQueryBuilder('wallet')
      .setLock('pessimistic_write')
      .where('wallet.userId = :userId', { userId })
      .getOne();
    if (!wallet) throw new UnprocessableEntityException('积分账户不可用');

    const existing = await ledger.findOne({ where: { eventKey } });
    if (existing) return existing;
    const nextBalance = wallet.pointsBalance + amount;
    if (nextBalance < 0) {
      throw new UnprocessableEntityException(
        `积分不足，兑换一个邀请码需要 ${this.invitePointsCost()} 积分`,
      );
    }
    wallet.pointsBalance = nextBalance;
    await wallets.save(wallet);
    return ledger.save(
      ledger.create({
        amount,
        balanceAfter: nextBalance,
        eventType,
        eventKey,
        description,
        metadata,
        user: { id: userId } as UserEntity,
        createdByUser: null,
      }),
    );
  }

  private toInvitationView(
    invitation: PlatformInvitationEntity,
  ): CommunityInvitationView {
    const expired =
      invitation.status === 'active' &&
      invitation.expiresAt !== null &&
      invitation.expiresAt < new Date();
    return {
      id: String(invitation.id),
      maxUses: invitation.maxUses,
      usedCount: invitation.usedCount,
      status: expired ? 'expired' : invitation.status,
      expiresAt: invitation.expiresAt?.toISOString() ?? null,
      createdAt: invitation.createdAt.toISOString(),
    };
  }

  private toLedgerView(entry: PlatformPointsLedgerEntity): PointsLedgerView {
    return {
      id: String(entry.id),
      amount: entry.amount,
      balanceAfter: entry.balanceAfter,
      eventType: entry.eventType,
      description: entry.description,
      createdAt: entry.createdAt.toISOString(),
    };
  }

  private invitePointsCost(): number {
    return readPositiveInteger(
      process.env.PLATFORM_INVITE_POINTS_COST,
      DEFAULT_INVITE_POINTS_COST,
    );
  }

  private inviteValidDays(): number {
    return readPositiveInteger(
      process.env.PLATFORM_INVITE_VALID_DAYS,
      DEFAULT_INVITE_VALID_DAYS,
    );
  }

  private dailyActivityPoints(): number {
    return readPositiveInteger(
      process.env.PLATFORM_DAILY_ACTIVITY_POINTS,
      DEFAULT_DAILY_ACTIVITY_POINTS,
    );
  }

  private referralRewardPoints(): number {
    return readPositiveInteger(
      process.env.PLATFORM_REFERRAL_REWARD_POINTS,
      DEFAULT_REFERRAL_REWARD_POINTS,
    );
  }
}

function readPositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getShanghaiDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}
