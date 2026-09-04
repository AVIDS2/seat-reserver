import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { SessionService } from '../session/session.service';
import { RoleEnum } from '../roles/roles.enum';
import { StatusEnum } from '../statuses/statuses.enum';
import { StatusEntity } from '../statuses/infrastructure/persistence/relational/entities/status.entity';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { BookingRunEntity } from './entities/booking-run.entity';
import { BookingTaskEntity } from './entities/booking-task.entity';
import { SchoolAccountEntity } from './entities/school-account.entity';
import {
  MembershipPlan,
  PlatformMembershipService,
} from './platform-membership.service';

export type AdminUserView = {
  id: string;
  email: string | null;
  displayName: string;
  role: 'admin' | 'user';
  plan: MembershipPlan;
  status: 'active' | 'disabled';
  accountCount: number;
  taskCount: number;
  createdAt: string;
};

export type AdminOverview = {
  users: number;
  activeUsers: number;
  accounts: number;
  connectedAccounts: number;
  tasks: number;
  enabledTasks: number;
  runsToday: number;
  successfulRunsToday: number;
  failedRunsToday: number;
  proUsers: number;
  pendingProRequests: number;
  queueStatus: 'ok' | 'degraded';
  serverTime: string;
};

export type AdminAccountView = {
  id: string;
  label: string;
  username: string;
  status: 'connected' | 'attention';
  statusLabel: string;
  tokenLabel: string;
  ownerName: string;
  ownerEmail: string | null;
  taskCount: number;
  lastVerifiedAt: string | null;
};

export type AdminTaskView = {
  id: string;
  name: string;
  venueType: 'library' | 'study_room' | 'other';
  building: string;
  roomName: string;
  seatLabel: string | null;
  ownerName: string;
  ownerEmail: string | null;
  account: string;
  seat: string;
  time: string;
  enabled: boolean;
  status: 'enabled' | 'paused' | 'attention' | 'disabled';
  lastRun: string | null;
  lastMessage: string;
};

export type AdminRunView = {
  id: string;
  runType: 'prewarm' | 'booking';
  ownerName: string;
  ownerEmail: string | null;
  task: string;
  account: string;
  targetDate: string;
  status:
    | 'success'
    | 'failed'
    | 'prewarming'
    | 'running'
    | 'pending'
    | 'skipped';
  statusLabel: string;
  attempts: number;
  result: string;
  detail: string;
  startedAt: string;
};

@Injectable()
export class PlatformAdminService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(SchoolAccountEntity)
    private readonly accounts: Repository<SchoolAccountEntity>,
    @InjectRepository(BookingTaskEntity)
    private readonly tasks: Repository<BookingTaskEntity>,
    @InjectRepository(BookingRunEntity)
    private readonly runs: Repository<BookingRunEntity>,
    private readonly memberships: PlatformMembershipService,
    private readonly sessions: SessionService,
  ) {}

  async overview(queueStatus: 'ok' | 'degraded'): Promise<AdminOverview> {
    const [
      users,
      activeUsers,
      accounts,
      connectedAccounts,
      tasks,
      enabledTasks,
    ] = await Promise.all([
      this.users.count(),
      this.users.count({ where: { status: { id: StatusEnum.active } } }),
      this.accounts.count(),
      this.accounts.count({
        where: { status: 'active', encryptedToken: Not(IsNull()) },
      }),
      this.tasks.count(),
      this.tasks.count({
        where: { enabled: true, user: { status: { id: StatusEnum.active } } },
      }),
    ]);
    const today = getShanghaiDate();
    const todaysRuns = await this.runs.find({ where: { targetDate: today } });
    const membershipSummary = await this.memberships.adminSummary();
    return {
      users,
      activeUsers,
      accounts,
      connectedAccounts,
      tasks,
      enabledTasks,
      runsToday: todaysRuns.length,
      successfulRunsToday: todaysRuns.filter((run) => run.status === 'success')
        .length,
      failedRunsToday: todaysRuns.filter((run) => run.status === 'failed')
        .length,
      proUsers: membershipSummary.proUsers,
      pendingProRequests: membershipSummary.pendingProRequests,
      queueStatus,
      serverTime: new Date().toISOString(),
    };
  }

  async listUsers(): Promise<AdminUserView[]> {
    const users = await this.users.find({ order: { createdAt: 'ASC' } });
    return Promise.all(
      users.map(async (user) => {
        const [accountCount, taskCount, plan] = await Promise.all([
          this.accounts.count({ where: { user: { id: user.id } } }),
          this.tasks.count({ where: { user: { id: user.id } } }),
          this.memberships.getPlanForUser(user.id),
        ]);
        return this.toView(user, accountCount, taskCount, plan);
      }),
    );
  }

  async listAccounts(): Promise<AdminAccountView[]> {
    const accounts = await this.accounts.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return Promise.all(
      accounts.map(async (account) => {
        const taskCount = await this.tasks.count({
          where: {
            schoolAccount: { id: account.id },
            user: { id: account.userId },
          },
        });
        const connected =
          account.status === 'active' && !!account.encryptedToken;
        return {
          id: String(account.id),
          label: account.label,
          username: maskUsername(account.schoolUsername),
          status: connected ? 'connected' : 'attention',
          statusLabel: connected ? '连接正常' : '需要关注',
          tokenLabel: connected ? 'Token 已缓存' : 'Token 不可用',
          ownerName: formatUserName(account.user),
          ownerEmail: account.user?.email ?? null,
          taskCount,
          lastVerifiedAt: account.lastVerifiedAt?.toISOString() ?? null,
        };
      }),
    );
  }

  async listTasks(): Promise<AdminTaskView[]> {
    const tasks = await this.tasks.find({
      relations: ['user', 'schoolAccount'],
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return Promise.all(
      tasks.map(async (task) => {
        const lastRun = await this.runs.findOne({
          where: { task: { id: task.id } },
          order: { createdAt: 'DESC' },
        });
        const userActive = Number(task.user?.status?.id) === StatusEnum.active;
        const accountReady =
          task.schoolAccount?.status === 'active' &&
          !!task.schoolAccount?.encryptedToken;
        return {
          id: String(task.id),
          name: task.name,
          venueType: task.venueType,
          building: task.building,
          roomName: task.roomName,
          seatLabel: task.primarySeatLabel,
          ownerName: formatUserName(task.user),
          ownerEmail: task.user?.email ?? null,
          account: task.schoolAccount?.label ?? '账号已移除',
          seat: task.primarySeatLabel
            ? `${task.primarySeatLabel} 号`
            : '未设置座位号',
          time: task.timeCandidates
            .map(
              ({ start, end }) => `${formatTime(start)} - ${formatTime(end)}`,
            )
            .join(' / '),
          enabled: task.enabled,
          status: !userActive
            ? 'disabled'
            : !accountReady || lastRun?.status === 'failed'
              ? 'attention'
              : task.enabled
                ? 'enabled'
                : 'paused',
          lastRun: lastRun?.createdAt.toISOString() ?? null,
          lastMessage: lastRun?.message ?? '尚未运行',
        };
      }),
    );
  }

  async listRuns(): Promise<AdminRunView[]> {
    const runs = await this.runs.find({
      relations: ['task', 'schoolAccount', 'user'],
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return runs.map((run) => {
      const status =
        run.status === 'success'
          ? 'success'
          : run.status === 'failed'
            ? 'failed'
            : run.status === 'running'
              ? 'running'
              : run.status === 'pending'
                ? 'pending'
                : run.status === 'skipped'
                  ? 'skipped'
                  : 'prewarming';
      return {
        id: String(run.id),
        runType: run.runType,
        ownerName: formatUserName(run.user),
        ownerEmail: run.user?.email ?? null,
        task:
          run.task?.name ??
          (run.runType === 'prewarm' ? 'Token 预热' : '预约任务'),
        account: run.schoolAccount?.label ?? '账号已移除',
        targetDate: run.targetDate,
        status,
        statusLabel: runStatusLabel(status),
        attempts: run.attemptsUsed,
        result: run.receipt
          ? `${run.reservedBegin ?? ''} - ${run.reservedEnd ?? ''}`.trim()
          : run.status === 'failed'
            ? (run.message ?? '窗口结束')
            : run.status === 'skipped'
              ? '未执行'
              : '处理中',
        detail: run.message ?? '任务已进入队列，等待执行。',
        startedAt: formatDate(run.startedAt ?? run.createdAt),
      };
    });
  }

  async setStatus(
    adminId: number,
    userId: number,
    status: 'active' | 'disabled',
  ): Promise<AdminUserView> {
    if (adminId === userId && status === 'disabled') {
      throw new UnprocessableEntityException('不能禁用当前管理员账号');
    }
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('用户不存在');
    if (
      status === 'disabled' &&
      Number(user.role?.id) === RoleEnum.admin &&
      (await this.users.count({
        where: {
          role: { id: RoleEnum.admin },
          status: { id: StatusEnum.active },
        },
      })) <= 1
    ) {
      throw new UnprocessableEntityException('至少需要保留一个启用中的管理员');
    }
    user.status = {
      id: status === 'active' ? StatusEnum.active : StatusEnum.inactive,
    } as StatusEntity;
    const saved = await this.users.save(user);
    if (status === 'disabled') await this.sessions.deleteByUserId({ userId });
    const [accountCount, taskCount, plan] = await Promise.all([
      this.accounts.count({ where: { user: { id: userId } } }),
      this.tasks.count({ where: { user: { id: userId } } }),
      this.memberships.getPlanForUser(userId),
    ]);
    return this.toView(saved, accountCount, taskCount, plan);
  }

  private toView(
    user: UserEntity,
    accountCount: number,
    taskCount: number,
    plan: MembershipPlan,
  ): AdminUserView {
    const isAdmin = Number(user.role?.id) === RoleEnum.admin;
    return {
      id: String(user.id),
      email: user.email,
      displayName:
        [user.firstName, user.lastName].filter(Boolean).join(' ') ||
        '未命名用户',
      role: isAdmin ? 'admin' : 'user',
      plan,
      status:
        Number(user.status?.id) === StatusEnum.active ? 'active' : 'disabled',
      accountCount,
      taskCount,
      createdAt: user.createdAt.toISOString(),
    };
  }
}

function formatUserName(user: UserEntity | null | undefined): string {
  return (
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || '未命名用户'
  );
}

function maskUsername(username: string): string {
  return username.length > 5
    ? `${username.slice(0, 3)}******${username.slice(-2)}`
    : '******';
}

function formatTime(minutes: number): string {
  return `${Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`;
}

function formatDate(value: Date): string {
  return value.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function runStatusLabel(status: AdminRunView['status']): string {
  return status === 'success'
    ? '预约成功'
    : status === 'failed'
      ? '未抢到'
      : status === 'running'
        ? '执行中'
        : status === 'pending'
          ? '排队中'
          : status === 'skipped'
            ? '已跳过'
            : '预热中';
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
