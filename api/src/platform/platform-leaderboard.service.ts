import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, Repository } from 'typeorm';
import { BookingRunEntity } from './entities/booking-run.entity';

export type LeaderboardPeriod = 'week' | 'month' | 'all';

export type LeaderboardRanking = {
  userId: string;
  userName: string;
  rank: number;
  value: number;
  valueLabel: string;
  byline: string;
  avatarUrl: string | null;
  activeDays: number;
  sessions: number;
};

export type LeaderboardSnapshot = {
  period: LeaderboardPeriod;
  fromDate: string;
  toDate: string;
  scopeLabel: string;
  metricLabel: string;
  rankings: LeaderboardRanking[];
  currentUser: LeaderboardRanking | null;
  participantCount: number;
  trackedMinutes: number;
};

type UserAggregate = {
  userId: number;
  userName: string;
  avatarUrl: string | null;
  intervalsByDate: Map<string, Array<[number, number]>>;
};

@Injectable()
export class PlatformLeaderboardService {
  constructor(
    @InjectRepository(BookingRunEntity)
    private readonly runs: Repository<BookingRunEntity>,
  ) {}

  async getSnapshot(
    userId: number,
    requestedPeriod?: string,
  ): Promise<LeaderboardSnapshot> {
    const period = normalizePeriod(requestedPeriod);
    const toDate = getShanghaiDate();
    const fromDate = periodStart(period, toDate);
    const where: FindOptionsWhere<BookingRunEntity> = {
      runType: 'booking',
      status: 'success',
    };
    if (period !== 'all') {
      where.targetDate = Between(fromDate, toDate);
    }
    const runs = await this.runs.find({
      where,
      relations: ['user'],
      order: { targetDate: 'ASC', createdAt: 'ASC' },
      take: 10000,
    });
    const aggregates = new Map<number, UserAggregate>();

    for (const run of runs) {
      const start = parseTime(run.reservedBegin);
      const end = parseTime(run.reservedEnd);
      if (!run.userId || !run.targetDate || start === null || end === null)
        continue;
      if (end <= start) continue;

      const existing = aggregates.get(run.userId) ?? {
        userId: run.userId,
        userName: publicUserName(run.userId),
        avatarUrl: null,
        intervalsByDate: new Map<string, Array<[number, number]>>(),
      };
      const intervals = existing.intervalsByDate.get(run.targetDate) ?? [];
      intervals.push([start, end]);
      existing.intervalsByDate.set(run.targetDate, intervals);
      aggregates.set(run.userId, existing);
    }

    const rankings = [...aggregates.values()]
      .map((aggregate) => toRanking(aggregate))
      .sort((left, right) => {
        if (right.value !== left.value) return right.value - left.value;
        if (right.activeDays !== left.activeDays)
          return right.activeDays - left.activeDays;
        return left.userName.localeCompare(right.userName, 'zh-CN');
      })
      .map((ranking, index) => ({ ...ranking, rank: index + 1 }));
    const currentUser =
      rankings.find((ranking) => ranking.userId === String(userId)) ?? null;
    const trackedMinutes = rankings.reduce(
      (total, ranking) => total + ranking.value,
      0,
    );

    return {
      period,
      fromDate,
      toDate,
      scopeLabel: '席定预约榜',
      metricLabel: '预约时长',
      rankings: rankings.slice(0, 100),
      currentUser,
      participantCount: rankings.length,
      trackedMinutes,
    };
  }
}

function toRanking(aggregate: UserAggregate): LeaderboardRanking {
  const merged = [...aggregate.intervalsByDate.values()].map(mergeIntervals);
  const value = merged.reduce(
    (total, intervals) =>
      total +
      intervals.reduce((dayTotal, [start, end]) => dayTotal + end - start, 0),
    0,
  );
  const activeDays = merged.filter((intervals) => intervals.length > 0).length;
  const sessions = [...aggregate.intervalsByDate.values()].reduce(
    (total, intervals) => total + intervals.length,
    0,
  );

  return {
    userId: String(aggregate.userId),
    userName: aggregate.userName,
    rank: 0,
    value,
    valueLabel: formatDuration(value),
    byline: `${activeDays} 天 · ${sessions} 次成功预约`,
    avatarUrl: aggregate.avatarUrl,
    activeDays,
    sessions,
  };
}

function mergeIntervals(
  intervals: Array<[number, number]>,
): Array<[number, number]> {
  const sorted = [...intervals].sort((left, right) => left[0] - right[0]);
  const merged: Array<[number, number]> = [];
  for (const interval of sorted) {
    const previous = merged[merged.length - 1];
    if (!previous || interval[0] > previous[1]) {
      merged.push([...interval]);
    } else {
      previous[1] = Math.max(previous[1], interval[1]);
    }
  }
  return merged;
}

function publicUserName(userId: number): string {
  return `同学${String(userId).slice(-2).padStart(2, '0')}`;
}

function normalizePeriod(value: string | undefined): LeaderboardPeriod {
  return value === 'month' || value === 'all' ? value : 'week';
}

function periodStart(period: LeaderboardPeriod, toDate: string): string {
  if (period === 'all') return '1970-01-01';
  const date = new Date(`${toDate}T12:00:00+08:00`);
  if (period === 'week') {
    const weekday = date.getUTCDay();
    date.setUTCDate(date.getUTCDate() - ((weekday + 6) % 7));
  } else {
    date.setUTCDate(1);
  }
  return formatDate(date);
}

function parseTime(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 24 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} 分钟`;
  return remainder ? `${hours} 小时 ${remainder} 分钟` : `${hours} 小时`;
}

function getShanghaiDate(): string {
  return formatDate(new Date());
}

function formatDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}
