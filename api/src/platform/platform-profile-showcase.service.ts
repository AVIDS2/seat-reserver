import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Repository } from 'typeorm';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { BookingRunEntity } from './entities/booking-run.entity';
import { BookingTaskEntity } from './entities/booking-task.entity';
import { PlatformMembershipEntity } from './entities/platform-membership.entity';
import { PlatformPointsLedgerEntity } from './entities/platform-points-ledger.entity';
import { PlatformPointsWalletEntity } from './entities/platform-points-wallet.entity';
import { PlatformProfileDecorationEntity } from './entities/platform-profile-decoration.entity';
import { PlatformProfileShowcaseDto } from './dto/platform-profile-showcase.dto';

export type ShowcaseKind = 'frame' | 'title' | 'badge';

export type ShowcaseItem = {
  id: string;
  name: string;
  description: string;
  kind: ShowcaseKind;
  unlocked: boolean;
  unlockedAt: string | null;
  lockedReason: string | null;
};

export type PublicProfileDecoration = {
  avatarFrameId: string;
  titleId: string;
  titleLabel: string;
  badgeId: string;
  badgeLabel: string;
};

export type ProfileShowcase = {
  selected: PublicProfileDecoration;
  frames: ShowcaseItem[];
  titles: ShowcaseItem[];
  badges: ShowcaseItem[];
  stats: {
    pointsBalance: number;
    successCount: number;
    activeDays: number;
    checkInDays: number;
    checkInStreak: number;
    pointsEarned: number;
    taskCount: number;
  };
};

type CatalogItem = Omit<
  ShowcaseItem,
  'unlocked' | 'unlockedAt' | 'lockedReason'
> & {
  requirement: Requirement;
};

type ShowcaseProgress = {
  stats: ShowcaseStats;
  unlocks: Map<Requirement, string>;
};

type Requirement =
  | 'always'
  | 'first_task'
  | 'first_success'
  | 'checkin_7'
  | 'active_10'
  | 'points_300'
  | 'pro';

export const PROFILE_FRAMES: CatalogItem[] = [
  {
    id: 'plain',
    name: '基础线框',
    description: '席定默认头像框',
    kind: 'frame',
    requirement: 'always',
  },
  {
    id: 'starlight',
    name: '星轨',
    description: '完成第一次真实预约后点亮',
    kind: 'frame',
    requirement: 'first_success',
  },
  {
    id: 'aurora',
    name: '极光',
    description: '累计获得 300 席定币后点亮',
    kind: 'frame',
    requirement: 'points_300',
  },
  {
    id: 'champion',
    name: '冠军环',
    description: '累计 10 个活跃学习日后点亮',
    kind: 'frame',
    requirement: 'active_10',
  },
  {
    id: 'pro',
    name: 'Pro 光环',
    description: 'Pro 会员专属头像框',
    kind: 'frame',
    requirement: 'pro',
  },
];

export const PROFILE_TITLES: CatalogItem[] = [
  {
    id: 'newcomer',
    name: '初来乍到',
    description: '席定默认称号',
    kind: 'title',
    requirement: 'always',
  },
  {
    id: 'task_setter',
    name: '策略布置师',
    description: '创建第一条预约任务后点亮',
    kind: 'title',
    requirement: 'first_task',
  },
  {
    id: 'early_bird',
    name: '早起抢座员',
    description: '完成第一次真实预约后点亮',
    kind: 'title',
    requirement: 'first_success',
  },
  {
    id: 'steady_learner',
    name: '连续学习者',
    description: '完成 7 天签到后点亮',
    kind: 'title',
    requirement: 'checkin_7',
  },
  {
    id: 'seat_planner',
    name: '座位规划师',
    description: '累计 10 个活跃学习日后点亮',
    kind: 'title',
    requirement: 'active_10',
  },
  {
    id: 'pro_member',
    name: 'Pro 会员',
    description: 'Pro 会员专属称号',
    kind: 'title',
    requirement: 'pro',
  },
];

export const PROFILE_BADGES: CatalogItem[] = [
  {
    id: 'welcome',
    name: '席定新星',
    description: '加入席定后的第一枚徽章',
    kind: 'badge',
    requirement: 'always',
  },
  {
    id: 'first_success',
    name: '首席出发',
    description: '完成第一次真实预约',
    kind: 'badge',
    requirement: 'first_success',
  },
  {
    id: 'streak_7',
    name: '七日不掉线',
    description: '连续 7 天完成签到',
    kind: 'badge',
    requirement: 'checkin_7',
  },
  {
    id: 'seat_master',
    name: '预约达人',
    description: '累计 10 个活跃学习日',
    kind: 'badge',
    requirement: 'active_10',
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Pro 会员专属徽章',
    kind: 'badge',
    requirement: 'pro',
  },
];

type ShowcaseStats = ProfileShowcase['stats'];

@Injectable()
export class PlatformProfileShowcaseService {
  constructor(
    @InjectRepository(PlatformProfileDecorationEntity)
    private readonly decorations: Repository<PlatformProfileDecorationEntity>,
    @InjectRepository(PlatformPointsWalletEntity)
    private readonly wallets: Repository<PlatformPointsWalletEntity>,
    @InjectRepository(PlatformPointsLedgerEntity)
    private readonly ledger: Repository<PlatformPointsLedgerEntity>,
    @InjectRepository(BookingTaskEntity)
    private readonly tasks: Repository<BookingTaskEntity>,
    @InjectRepository(BookingRunEntity)
    private readonly runs: Repository<BookingRunEntity>,
    @InjectRepository(PlatformMembershipEntity)
    private readonly memberships: Repository<PlatformMembershipEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  async getShowcase(userId: number): Promise<ProfileShowcase> {
    const [decoration, progress, membership] = await Promise.all([
      this.getOrCreateDecoration(userId),
      this.getStats(userId),
      this.memberships.findOne({ where: { user: { id: userId } } }),
    ]);
    if (
      membership?.plan === 'pro' &&
      (!membership.proExpiresAt || membership.proExpiresAt > new Date())
    ) {
      progress.unlocks.set(
        'pro',
        membership.proActivatedAt?.toISOString() ??
          membership.createdAt.toISOString(),
      );
    }
    return this.toShowcase(decoration, progress.unlocks, progress.stats);
  }

  async getSelectedDecoration(
    userId: number,
  ): Promise<PublicProfileDecoration> {
    const [decoration, membership] = await Promise.all([
      this.getOrCreateDecoration(userId),
      this.memberships.findOne({ where: { user: { id: userId } } }),
    ]);
    const isPro =
      membership?.plan === 'pro' &&
      (!membership.proExpiresAt || membership.proExpiresAt > new Date());
    return this.toPublicDecoration({
      avatarFrameId:
        decoration.avatarFrameId === 'pro' && !isPro
          ? 'plain'
          : decoration.avatarFrameId,
      titleId:
        decoration.titleId === 'pro_member' && !isPro
          ? 'newcomer'
          : decoration.titleId,
      badgeId:
        decoration.badgeId === 'pro' && !isPro ? 'welcome' : decoration.badgeId,
    });
  }

  async updateShowcase(
    userId: number,
    dto: PlatformProfileShowcaseDto,
  ): Promise<ProfileShowcase> {
    const current = await this.getShowcase(userId);
    const next = {
      avatarFrameId: dto.avatarFrameId ?? current.selected.avatarFrameId,
      titleId: dto.titleId ?? current.selected.titleId,
      badgeId: dto.badgeId ?? current.selected.badgeId,
    };
    const choices: Array<[string, ShowcaseItem[], string]> = [
      [next.avatarFrameId, current.frames, '头像框'],
      [next.titleId, current.titles, '称号'],
      [next.badgeId, current.badges, '徽章'],
    ];
    for (const [id, items, label] of choices) {
      const item = items.find((candidate) => candidate.id === id);
      if (!item) throw new UnprocessableEntityException(`${label}不存在`);
      if (!item.unlocked)
        throw new UnprocessableEntityException(`${label}尚未解锁`);
    }
    const currentDecoration = await this.getOrCreateDecoration(userId);
    await this.decorations.save({
      id: currentDecoration.id,
      user: { id: userId } as UserEntity,
      avatarFrameId: next.avatarFrameId,
      titleId: next.titleId,
      badgeId: next.badgeId,
    });
    return this.getShowcase(userId);
  }

  async getPublicDecorations(
    userIds: number[],
  ): Promise<Map<number, PublicProfileDecoration>> {
    if (!userIds.length) return new Map();
    const [rows, memberships] = await Promise.all([
      this.decorations.find({ where: { user: { id: In(userIds) } } }),
      this.memberships.find({ where: { user: { id: In(userIds) } } }),
    ]);
    const activeProUsers = new Set(
      memberships
        .filter(
          (membership) =>
            membership.plan === 'pro' &&
            (!membership.proExpiresAt || membership.proExpiresAt > new Date()),
        )
        .map((membership) => membership.userId),
    );
    return new Map(
      rows.map((row) => {
        const isPro = activeProUsers.has(row.userId);
        return [
          row.userId,
          this.toPublicDecoration({
            ...row,
            avatarFrameId:
              row.avatarFrameId === 'pro' && !isPro
                ? 'plain'
                : row.avatarFrameId,
            titleId:
              row.titleId === 'pro_member' && !isPro ? 'newcomer' : row.titleId,
            badgeId: row.badgeId === 'pro' && !isPro ? 'welcome' : row.badgeId,
          }),
        ];
      }),
    );
  }

  private async getOrCreateDecoration(
    userId: number,
  ): Promise<PlatformProfileDecorationEntity> {
    const existing = await this.decorations.findOne({
      where: { user: { id: userId } },
    });
    if (existing) return existing;
    try {
      return await this.decorations.save(
        this.decorations.create({
          user: { id: userId } as UserEntity,
          avatarFrameId: 'plain',
          titleId: 'newcomer',
          badgeId: 'welcome',
        }),
      );
    } catch (error) {
      if (
        (error as { driverError?: { code?: string } }).driverError?.code !==
        '23505'
      )
        throw error;
      const raced = await this.decorations.findOne({
        where: { user: { id: userId } },
      });
      if (raced) return raced;
      throw error;
    }
  }

  private async getStats(userId: number): Promise<ShowcaseProgress> {
    const [user, wallet, firstTask, runs, checkIns, earnedEntries] =
      await Promise.all([
        this.users.findOne({
          where: { id: userId },
          select: ['id', 'createdAt'],
        }),
        this.wallets.findOne({ where: { user: { id: userId } } }),
        this.tasks.findOne({
          where: { user: { id: userId } },
          order: { createdAt: 'ASC' },
          select: ['id', 'createdAt'],
        }),
        this.runs.find({
          where: {
            user: { id: userId },
            runType: 'booking',
            status: 'success',
          },
          select: ['targetDate', 'createdAt'],
          order: { targetDate: 'ASC', createdAt: 'ASC' },
        }),
        this.ledger.find({
          where: { user: { id: userId }, eventType: 'daily_check_in' },
          select: ['eventKey', 'createdAt'],
          order: { createdAt: 'ASC' },
        }),
        this.ledger.find({
          where: { user: { id: userId }, amount: MoreThan(0) },
          select: ['amount', 'createdAt'],
          order: { createdAt: 'ASC' },
        }),
      ]);
    const dates = new Map<string, Date>();
    for (const run of runs) {
      if (run.targetDate && !dates.has(run.targetDate))
        dates.set(run.targetDate, run.createdAt);
    }
    const sortedActivityDates = [...dates.keys()].sort();
    const checkInDates = new Map<string, Date>();
    for (const entry of checkIns) {
      const date = entry.eventKey.match(
        /daily_check_in:(\d{4}-\d{2}-\d{2})$/,
      )?.[1];
      if (date && !checkInDates.has(date))
        checkInDates.set(date, entry.createdAt);
    }
    const sortedCheckInDates = [...checkInDates.keys()].sort();
    const firstSuccess = runs.reduce<BookingRunEntity | null>(
      (earliest, run) =>
        !earliest || run.createdAt < earliest.createdAt ? run : earliest,
      null,
    );
    const pointsEarned = earnedEntries.reduce(
      (total, entry) => total + Math.max(0, entry.amount),
      0,
    );
    const stats: ShowcaseStats = {
      pointsBalance: wallet?.pointsBalance ?? 0,
      pointsEarned,
      successCount: runs.length,
      activeDays: dates.size,
      checkInDays: checkInDates.size,
      checkInStreak: currentStreak(sortedCheckInDates),
      taskCount: firstTask ? 1 : 0,
    };
    const unlocks = new Map<Requirement, string>();
    const joinedAt = user?.createdAt?.toISOString() ?? new Date().toISOString();
    unlocks.set('always', joinedAt);
    if (firstTask) unlocks.set('first_task', firstTask.createdAt.toISOString());
    if (firstSuccess)
      unlocks.set('first_success', firstSuccess.createdAt.toISOString());
    const sevenCheckInsAt = firstStreakAt(sortedCheckInDates, checkInDates, 7);
    if (sevenCheckInsAt) unlocks.set('checkin_7', sevenCheckInsAt);
    if (sortedActivityDates[9])
      unlocks.set(
        'active_10',
        dates.get(sortedActivityDates[9])!.toISOString(),
      );
    let earnedTotal = 0;
    for (const entry of earnedEntries) {
      earnedTotal += Math.max(0, entry.amount);
      if (earnedTotal >= 300) {
        unlocks.set('points_300', entry.createdAt.toISOString());
        break;
      }
    }
    return { stats, unlocks };
  }

  private toShowcase(
    decoration: PlatformProfileDecorationEntity,
    unlocks: Map<Requirement, string>,
    stats: ShowcaseStats,
  ): ProfileShowcase {
    const toItem = (item: CatalogItem): ShowcaseItem => ({
      id: item.id,
      name: item.name,
      description: item.description,
      kind: item.kind,
      unlocked: unlocks.has(item.requirement),
      unlockedAt: unlocks.get(item.requirement) ?? null,
      lockedReason: unlocks.has(item.requirement)
        ? null
        : lockReason(item.requirement),
    });
    const frames = PROFILE_FRAMES.map(toItem);
    const titles = PROFILE_TITLES.map(toItem);
    const badges = PROFILE_BADGES.map(toItem);
    const selected = this.toPublicDecoration({
      ...decoration,
      avatarFrameId: pickUnlocked(decoration.avatarFrameId, frames, 'plain'),
      titleId: pickUnlocked(decoration.titleId, titles, 'newcomer'),
      badgeId: pickUnlocked(decoration.badgeId, badges, 'welcome'),
    });
    return {
      selected,
      frames,
      titles,
      badges,
      stats,
    };
  }

  private toPublicDecoration(
    row: Pick<
      PlatformProfileDecorationEntity,
      'avatarFrameId' | 'titleId' | 'badgeId'
    >,
  ): PublicProfileDecoration {
    return {
      avatarFrameId: row.avatarFrameId,
      titleId: row.titleId,
      titleLabel:
        PROFILE_TITLES.find((item) => item.id === row.titleId)?.name ??
        '初来乍到',
      badgeId: row.badgeId,
      badgeLabel:
        PROFILE_BADGES.find((item) => item.id === row.badgeId)?.name ??
        '席定新星',
    };
  }
}

function pickUnlocked(
  id: string,
  items: ShowcaseItem[],
  fallback: string,
): string {
  return items.some((item) => item.id === id && item.unlocked) ? id : fallback;
}

function currentStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const today = getShanghaiDate();
  const yesterday = addDays(today, -1);
  const latest = dates[dates.length - 1];
  if (latest !== today && latest !== yesterday) return 0;

  const set = new Set(dates);
  let cursor = latest;
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function firstStreakAt(
  dates: string[],
  createdAtByDate: Map<string, Date>,
  requiredDays: number,
): string | null {
  let streak = 0;
  let previous = '';
  for (const date of dates) {
    streak = previous && addDays(previous, 1) === date ? streak + 1 : 1;
    previous = date;
    if (streak >= requiredDays) {
      const earnedAt = createdAtByDate.get(date);
      return (
        earnedAt?.toISOString() ??
        new Date(`${date}T12:00:00+08:00`).toISOString()
      );
    }
  }
  return null;
}

function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T12:00:00+08:00`);
  value.setUTCDate(value.getUTCDate() + amount);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
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

function lockReason(requirement: Requirement): string | null {
  return (
    {
      always: null,
      first_task: '创建第一条预约任务后解锁',
      first_success: '完成第一次真实预约后解锁',
      checkin_7: '完成 7 天签到后解锁',
      active_10: '累计 10 个活跃学习日后解锁',
      points_300: '累计获得 300 席定币后解锁',
      pro: 'Pro 会员专属',
    }[requirement] ?? null
  );
}
