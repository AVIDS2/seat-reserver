import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { PlatformAccountsService } from './platform-accounts.service';
import { PlatformRunsService } from './platform-runs.service';
import { PlatformTasksService } from './platform-tasks.service';
import { BookingRunEntity } from './entities/booking-run.entity';
import { BookingTaskEntity } from './entities/booking-task.entity';
import { SchoolAccountEntity } from './entities/school-account.entity';

@Injectable()
export class PlatformDashboardService {
  constructor(
    private readonly accounts: PlatformAccountsService,
    private readonly tasks: PlatformTasksService,
    private readonly runs: PlatformRunsService,
    @InjectRepository(BookingRunEntity)
    private readonly runEntities: Repository<BookingRunEntity>,
    @InjectRepository(BookingTaskEntity)
    private readonly taskEntities: Repository<BookingTaskEntity>,
    @InjectRepository(SchoolAccountEntity)
    private readonly accountEntities: Repository<SchoolAccountEntity>,
  ) {}

  async snapshot(userId: number) {
    const [accounts, tasks, runs] = await Promise.all([
      this.accounts.list(userId),
      this.tasks.list(userId),
      this.runs.list(userId),
    ]);
    const [enabledTasks, totalAccounts, connectedAccounts, recentRuns] =
      await Promise.all([
        this.taskEntities.count({
          where: { user: { id: userId }, enabled: true },
        }),
        this.accountEntities.count({ where: { user: { id: userId } } }),
        this.accountEntities.count({
          where: { user: { id: userId }, status: 'active' },
        }),
        this.runEntities.find({
          where: {
            user: { id: userId },
            runType: 'booking',
            targetDate: MoreThanOrEqual(getDaysAgoDate(7)),
          },
          order: { createdAt: 'DESC' },
          take: 1000,
        }),
      ]);
    const completedRuns = recentRuns.filter((run) =>
      ['success', 'failed'].includes(run.status),
    );
    const successfulRuns = completedRuns.filter(
      (run) => run.status === 'success',
    );
    const candidateGroups = tasks
      .filter((task) => task.enabled)
      .reduce(
        (total, task) =>
          total + (1 + task.backupSeatIds.length) * task.timeCandidates.length,
        0,
      );

    return {
      accounts,
      tasks,
      runs,
      summary: {
        enabledTasks,
        totalTasks: tasks.length,
        totalAccounts,
        connectedAccounts,
        successRate: completedRuns.length
          ? Math.round((successfulRuns.length / completedRuns.length) * 100)
          : null,
        candidateGroups,
        prewarmTime: '05:59:50',
        executionTime: '06:00:00',
        bookingWindowSeconds: tasks
          .filter((task) => task.enabled)
          .reduce((max, task) => Math.max(max, task.bookingWindowSeconds), 0),
        executionDate: getShanghaiDate(),
        lastCheckedAt: new Date().toISOString(),
      },
    };
  }
}

function getDaysAgoDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatShanghaiDate(date);
}

function getShanghaiDate(): string {
  return formatShanghaiDate(new Date());
}

function formatShanghaiDate(date: Date): string {
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
