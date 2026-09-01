import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SessionService } from '../session/session.service';
import { RoleEnum } from '../roles/roles.enum';
import { StatusEnum } from '../statuses/statuses.enum';
import { StatusEntity } from '../statuses/infrastructure/persistence/relational/entities/status.entity';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { BookingRunEntity } from './entities/booking-run.entity';
import { BookingTaskEntity } from './entities/booking-task.entity';
import { SchoolAccountEntity } from './entities/school-account.entity';

export type AdminUserView = {
  id: string;
  email: string | null;
  displayName: string;
  role: 'admin' | 'user';
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
  queueStatus: 'ok' | 'degraded';
  serverTime: string;
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
      this.accounts.count({ where: { status: 'active' } }),
      this.tasks.count(),
      this.tasks.count({ where: { enabled: true } }),
    ]);
    const today = getShanghaiDate();
    const todaysRuns = await this.runs.find({ where: { targetDate: today } });
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
      queueStatus,
      serverTime: new Date().toISOString(),
    };
  }

  async listUsers(): Promise<AdminUserView[]> {
    const users = await this.users.find({ order: { createdAt: 'ASC' } });
    return Promise.all(
      users.map(async (user) => {
        const [accountCount, taskCount] = await Promise.all([
          this.accounts.count({ where: { user: { id: user.id } } }),
          this.tasks.count({ where: { user: { id: user.id } } }),
        ]);
        return this.toView(user, accountCount, taskCount);
      }),
    );
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
    user.status = {
      id: status === 'active' ? StatusEnum.active : StatusEnum.inactive,
    } as StatusEntity;
    const saved = await this.users.save(user);
    if (status === 'disabled') await this.sessions.deleteByUserId({ userId });
    const [accountCount, taskCount] = await Promise.all([
      this.accounts.count({ where: { user: { id: userId } } }),
      this.tasks.count({ where: { user: { id: userId } } }),
    ]);
    return this.toView(saved, accountCount, taskCount);
  }

  private toView(
    user: UserEntity,
    accountCount: number,
    taskCount: number,
  ): AdminUserView {
    const isAdmin = Number(user.role?.id) === RoleEnum.admin;
    return {
      id: String(user.id),
      email: user.email,
      displayName:
        [user.firstName, user.lastName].filter(Boolean).join(' ') ||
        '未命名用户',
      role: isAdmin ? 'admin' : 'user',
      status:
        Number(user.status?.id) === StatusEnum.active ? 'active' : 'disabled',
      accountCount,
      taskCount,
      createdAt: user.createdAt.toISOString(),
    };
  }
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
