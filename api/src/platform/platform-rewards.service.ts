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
import { BookingRunEntity } from './entities/booking-run.entity';
import { BookingTaskEntity } from './entities/booking-task.entity';
import { PlatformAttendanceSettingEntity } from './entities/platform-attendance-setting.entity';
import { SchoolServiceConnectionEntity } from './entities/school-service-connection.entity';
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
  activities: RewardActivityView[];
};

export type RewardActivityStatus = 'available' | 'claimed' | 'locked';

export type RewardActivityView = {
  id: string;
  title: string;
  description: string;
  points: number;
  status: RewardActivityStatus;
  lockedReason: string | null;
};

type RewardActivityDefinition = Omit<
  RewardActivityView,
  'status' | 'lockedReason'
> & {
  daily?: boolean;
};

const REWARD_ACTIVITIES: RewardActivityDefinition[] = [
  {
    id: 'daily_check_in',
    title: '每日签到',
    description: '今天来工作台报到，领取每日积分。',
    points: 30,
    daily: true,
  },
  {
    id: 'first_task',
    title: '布置第一条任务',
    description: '完成一条自动预约策略，把喜欢的位置交给席定记住。',
    points: 20,
  },
  {
    id: 'library_connection',
    title: '连接图书馆服务',
    description: '完成图书馆服务连接，解锁空间目录和单次预约入口。',
    points: 40,
  },
  {
    id: 'attendance_protection',
    title: '开启签到保护',
    description: '开启未签到自动取消，减少一次违约风险。',
    points: 10,
  },
  {
    id: 'first_success',
    title: '完成第一次预约',
    description: '有一条真实预约执行成功后领取奖励。',
    points: 60,
  },
];

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
    @InjectRepository(BookingRunEntity)
    private readonly runs: Repository<BookingRunEntity>,
    @InjectRepository(BookingTaskEntity)
    private readonly tasks: Repository<BookingTaskEntity>,
    @InjectRepository(PlatformAttendanceSettingEntity)
    private readonly attendanceSettings: Repository<PlatformAttendanceSettingEntity>,
    @InjectRepository(SchoolServiceConnectionEntity)
    private readonly serviceConnections: Repository<SchoolServiceConnectionEntity>,
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
    const activities = await this.getActivities(userId);

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
      activities,
    };
  }

  async claimActivity(
    userId: number,
    activityId: string,
  ): Promise<{ activity: RewardActivityView; pointsBalance: number }> {
    const definition = REWARD_ACTIVITIES.find(
      (activity) => activity.id === activityId,
    );
    if (!definition) throw new UnprocessableEntityException('活动不存在');

    const date = getShanghaiDate();
    const eventKey = definition.daily
      ? `user:${userId}:activity:${activityId}:${date}`
      : `user:${userId}:activity:${activityId}`;
    const existing = await this.ledger.findOne({ where: { eventKey } });
    if (existing) {
      const activity = (await this.getActivities(userId)).find(
        (item) => item.id === activityId,
      );
      const wallet = await this.wallets.findOne({
        where: { user: { id: userId } },
      });
      return {
        activity: activity ?? this.activityView(definition, 'claimed', null),
        pointsBalance: wallet?.pointsBalance ?? existing.balanceAfter,
      };
    }

    await this.assertActivityUnlocked(userId, definition);
    const entry = await this.dataSource.transaction((manager) =>
      this.applyPointsWithinTransaction(
        manager,
        userId,
        definition.points,
        eventKey,
        definition.daily ? 'daily_check_in' : 'activity_reward',
        definition.title,
        { activityId, date },
      ),
    );
    return {
      activity: this.activityView(definition, 'claimed', null),
      pointsBalance: entry.balanceAfter,
    };
  }

  async checkIn(userId: number) {
    return this.claimActivity(userId, 'daily_check_in');
  }

  async recordBookingReward(
    userId: number,
    runId: number,
    durationMinutes: number,
    targetDate: string,
  ): Promise<number> {
    const reward = bookingRewardPoints(durationMinutes);
    if (reward <= 0) return 0;
    const entry = await this.dataSource.transaction((manager) =>
      this.applyPointsWithinTransaction(
        manager,
        userId,
        reward,
        `user:${userId}:booking-reward:${runId}`,
        'booking_reward',
        `完成 ${formatDuration(durationMinutes)} 预约`,
        { runId, targetDate, durationMinutes },
      ),
    );
    return Math.max(0, entry.amount);
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

  private async getActivities(userId: number): Promise<RewardActivityView[]> {
    return Promise.all(
      REWARD_ACTIVITIES.map(async (definition) => {
        const eventKey = definition.daily
          ? `user:${userId}:activity:${definition.id}:${getShanghaiDate()}`
          : `user:${userId}:activity:${definition.id}`;
        const claimed = await this.ledger.findOne({ where: { eventKey } });
        if (claimed) return this.activityView(definition, 'claimed', null);
        const unlocked = await this.isActivityUnlocked(userId, definition.id);
        return this.activityView(
          definition,
          unlocked ? 'available' : 'locked',
          unlocked ? null : this.activityLockReason(definition.id),
        );
      }),
    );
  }

  private async assertActivityUnlocked(
    userId: number,
    definition: RewardActivityDefinition,
  ): Promise<void> {
    if (await this.isActivityUnlocked(userId, definition.id)) return;
    throw new UnprocessableEntityException(
      this.activityLockReason(definition.id),
    );
  }

  private async isActivityUnlocked(
    userId: number,
    activityId: string,
  ): Promise<boolean> {
    switch (activityId) {
      case 'daily_check_in':
        return true;
      case 'first_task':
        return Boolean(
          await this.tasks.findOne({ where: { user: { id: userId } } }),
        );
      case 'library_connection':
        return Boolean(
          await this.serviceConnections.findOne({
            where: {
              user: { id: userId },
              serviceType: 'library',
              status: 'active',
            },
          }),
        );
      case 'attendance_protection':
        return Boolean(
          await this.attendanceSettings.findOne({
            where: { user: { id: userId }, autoCancelNoShow: true },
          }),
        );
      case 'first_success':
        return Boolean(
          await this.runs.findOne({
            where: {
              user: { id: userId },
              runType: 'booking',
              status: 'success',
            },
          }),
        );
      default:
        return false;
    }
  }

  private activityLockReason(activityId: string): string {
    return (
      {
        first_task: '创建一条预约任务后可领取',
        library_connection: '连接图书馆服务后可领取',
        attendance_protection: '开启签到保护后可领取',
        first_success: '完成一次真实预约后可领取',
      }[activityId] ?? '完成活动条件后可领取'
    );
  }

  private activityView(
    definition: RewardActivityDefinition,
    status: RewardActivityStatus,
    lockedReason: string | null,
  ): RewardActivityView {
    return {
      id: definition.id,
      title: definition.title,
      description: definition.description,
      points: definition.points,
      status,
      lockedReason,
    };
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
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      eventKey,
    ]);
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

export function bookingRewardPoints(durationMinutes: number): number {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return 0;
  return Math.min(60, Math.max(10, Math.ceil(durationMinutes / 60) * 5));
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} 分钟`;
  return remainder ? `${hours} 小时 ${remainder} 分钟` : `${hours} 小时`;
}
