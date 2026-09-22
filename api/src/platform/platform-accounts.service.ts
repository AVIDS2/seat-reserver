import {
  Injectable,
  NotFoundException,
  Optional,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import {
  CreateSchoolAccountDto,
  UpdateSchoolAccountDto,
} from './dto/school-account.dto';
import { SchoolAccountEntity } from './entities/school-account.entity';
import { BookingTaskEntity } from './entities/booking-task.entity';
import { PlatformCryptoService } from './platform-crypto.service';
import { SchoolAuthenticationService } from './school-authentication.service';
import type { SeatServiceType } from './entities/school-service-connection.entity';
import { PlatformServiceConnectionsService } from './platform-service-connections.service';
import { PlatformMembershipService } from './platform-membership.service';
import { PlatformRewardsService } from './platform-rewards.service';
import {
  DEFAULT_SCHOOL_CODE,
  isSchoolCode,
  type SchoolCode,
} from './school-catalog';

export type SchoolAccountView = {
  id: string;
  schoolCode: SchoolCode;
  label: string;
  username: string;
  status: 'connected' | 'recovering' | 'attention';
  statusLabel: string;
  tokenLabel: string;
  refreshedAt: string;
  lastVerifiedAt: string;
  tasks: number;
  services: Array<{
    type: 'study_room' | 'library';
    status: 'connected' | 'recovering' | 'attention' | 'not_connected';
    label: string;
  }>;
};

@Injectable()
export class PlatformAccountsService {
  constructor(
    @InjectRepository(SchoolAccountEntity)
    private readonly accounts: Repository<SchoolAccountEntity>,
    @InjectRepository(BookingTaskEntity)
    private readonly tasks: Repository<BookingTaskEntity>,
    private readonly crypto: PlatformCryptoService,
    private readonly schoolAuth: SchoolAuthenticationService,
    private readonly serviceConnections: PlatformServiceConnectionsService,
    @Optional()
    private readonly membership?: PlatformMembershipService,
    @Optional()
    private readonly rewards?: PlatformRewardsService,
  ) {}

  async list(userId: number): Promise<SchoolAccountView[]> {
    const accounts = await this.accounts.find({
      where: { user: { id: userId } },
      order: { createdAt: 'ASC' },
    });

    return Promise.all(accounts.map((account) => this.toView(account)));
  }

  async create(
    userId: number,
    dto: CreateSchoolAccountDto,
  ): Promise<SchoolAccountView> {
    const schoolCode = normalizeSchoolCode(dto.schoolCode);
    if (schoolCode === 'jou') {
      throw new UnprocessableEntityException(
        '江苏海洋大学正在接入，等待授权链路验证后开放绑定',
      );
    }
    const label = requireText(dto.label, '账号名称');
    const username = requireText(dto.schoolUsername, '学校账号');
    await this.membership?.assertCanCreateSchoolAccount(userId);
    const initialServiceType: SeatServiceType =
      schoolCode === 'njtech' ? 'library' : 'study_room';
    const authenticated =
      schoolCode === 'cczu'
        ? await this.schoolAuth.authenticate(
            username,
            dto.schoolPassword,
            undefined,
            initialServiceType,
          )
        : await this.schoolAuth.authenticate(
            username,
            dto.schoolPassword,
            undefined,
            initialServiceType,
            schoolCode,
          );
    const verified =
      schoolCode === 'cczu'
        ? await this.schoolAuth.verifyToken(
            authenticated.token,
            authenticated.mode,
          )
        : await this.schoolAuth.verifyToken(
            authenticated.token,
            authenticated.mode,
            initialServiceType,
            schoolCode,
          );

    if (!verified.success) {
      throw new UnprocessableEntityException('学校账号验证失败');
    }

    const accountData = {
      schoolCode,
      label,
      schoolUsername: username,
      encryptedSchoolPassword: this.crypto.encrypt(dto.schoolPassword),
      encryptedToken: this.crypto.encrypt(authenticated.token),
      authMode: authenticated.mode,
      status: 'active',
      tokenRefreshedAt: new Date(),
      lastVerifiedAt: new Date(),
      user: { id: userId } as UserEntity,
    };
    const membership = this.membership;
    const saved = membership
      ? await this.accounts.manager.transaction(async (manager) => {
          await membership.assertCanCreateSchoolAccount(userId, manager);
          const repository = manager.getRepository(SchoolAccountEntity);
          return repository.save(repository.create(accountData));
        })
      : await this.accounts.save(this.accounts.create(accountData));
    await this.serviceConnections.saveAuthenticated(
      saved,
      initialServiceType,
      authenticated.token,
      authenticated.mode,
      authenticated.webVpnSession,
    );
    await this.rewards?.qualifyReferral(userId);
    return this.toView(saved);
  }

  async refresh(userId: number, id: number): Promise<SchoolAccountView> {
    const account = await this.findOwned(userId, id);
    try {
      const password = this.crypto.decrypt(account.encryptedSchoolPassword);
      const serviceType: SeatServiceType =
        account.schoolCode === 'njtech' ? 'library' : 'study_room';
      const authenticated =
        account.schoolCode === 'njtech'
          ? await this.schoolAuth.authenticate(
              account.schoolUsername,
              password,
              undefined,
              serviceType,
              account.schoolCode,
            )
          : await this.schoolAuth.authenticate(
              account.schoolUsername,
              password,
              undefined,
              serviceType,
            );
      const verified =
        account.schoolCode === 'njtech'
          ? await this.schoolAuth.verifyToken(
              authenticated.token,
              authenticated.mode,
              serviceType,
              account.schoolCode,
            )
          : await this.schoolAuth.verifyToken(
              authenticated.token,
              authenticated.mode,
              serviceType,
            );
      if (!verified.success)
        throw new UnprocessableEntityException(
          '学校登录状态已过期，请重新输入密码',
        );

      account.encryptedToken = this.crypto.encrypt(authenticated.token);
      account.authMode = authenticated.mode;
      account.tokenRefreshedAt = new Date();
      account.lastVerifiedAt = new Date();
      account.status = 'active';
      const saved = await this.accounts.save(account);
      await this.serviceConnections.saveAuthenticated(
        saved,
        serviceType,
        authenticated.token,
        authenticated.mode,
        authenticated.webVpnSession,
      );
      await this.rewards?.qualifyReferral(userId);
      return this.toView(saved);
    } catch (error: unknown) {
      account.status = 'attention';
      await this.accounts.save(account);
      throw error;
    }
  }

  async connectService(
    userId: number,
    id: number,
    serviceType: SeatServiceType,
  ): Promise<SchoolAccountView> {
    const account = await this.findOwned(userId, id);
    await this.serviceConnections.ensureReady(account, serviceType, true);
    return this.toView(account);
  }

  async update(
    userId: number,
    id: number,
    dto: UpdateSchoolAccountDto,
  ): Promise<SchoolAccountView> {
    const account = await this.findOwned(userId, id);
    const requestedSchoolCode =
      dto.schoolCode === undefined
        ? account.schoolCode || DEFAULT_SCHOOL_CODE
        : normalizeSchoolCode(dto.schoolCode);
    if (requestedSchoolCode !== (account.schoolCode || DEFAULT_SCHOOL_CODE)) {
      throw new UnprocessableEntityException(
        '高校归属不能直接修改，请为另一所高校新建账号',
      );
    }
    const label =
      dto.label === undefined
        ? account.label
        : requireText(dto.label, '账号名称');
    const username =
      dto.schoolUsername === undefined
        ? account.schoolUsername
        : requireText(dto.schoolUsername, '学校账号');
    const password = dto.schoolPassword
      ? dto.schoolPassword
      : this.crypto.decrypt(account.encryptedSchoolPassword);
    const credentialsChanged =
      username !== account.schoolUsername || Boolean(dto.schoolPassword);

    if (credentialsChanged) {
      const serviceType: SeatServiceType =
        account.schoolCode === 'njtech' ? 'library' : 'study_room';
      const authenticated =
        account.schoolCode === 'njtech'
          ? await this.schoolAuth.authenticate(
              username,
              password,
              undefined,
              serviceType,
              account.schoolCode,
            )
          : await this.schoolAuth.authenticate(
              username,
              password,
              undefined,
              serviceType,
            );
      const verified =
        account.schoolCode === 'njtech'
          ? await this.schoolAuth.verifyToken(
              authenticated.token,
              authenticated.mode,
              serviceType,
              account.schoolCode,
            )
          : await this.schoolAuth.verifyToken(
              authenticated.token,
              authenticated.mode,
              serviceType,
            );
      if (!verified.success)
        throw new UnprocessableEntityException('学校账号验证失败');
      account.schoolUsername = username;
      account.encryptedSchoolPassword = this.crypto.encrypt(password);
      account.encryptedToken = this.crypto.encrypt(authenticated.token);
      account.authMode = authenticated.mode;
      account.tokenRefreshedAt = new Date();
      account.lastVerifiedAt = new Date();
      account.status = 'active';
      await this.serviceConnections.saveAuthenticated(
        account,
        serviceType,
        authenticated.token,
        authenticated.mode,
        authenticated.webVpnSession,
      );
      await this.rewards?.qualifyReferral(userId);
    }
    account.label = label;
    return this.toView(await this.accounts.save(account));
  }

  async remove(userId: number, id: number): Promise<void> {
    const account = await this.findOwned(userId, id);
    const tasks = await this.tasks.find({
      where: { schoolAccount: { id: account.id }, user: { id: userId } },
    });
    if (tasks.length) await this.tasks.softRemove(tasks);
    await this.accounts.softRemove(account);
  }

  async findOwned(userId: number, id: number): Promise<SchoolAccountEntity> {
    const account = await this.accounts.findOne({
      where: { id, user: { id: userId } },
      relations: ['user'],
    });
    if (!account) {
      throw new NotFoundException('账号不存在');
    }
    return account;
  }

  async toView(account: SchoolAccountEntity): Promise<SchoolAccountView> {
    const tasks = await this.tasks.count({
      where: {
        schoolAccount: { id: account.id },
        user: { id: account.userId },
      },
    });
    const username = account.schoolUsername;
    const masked =
      username.length > 5
        ? `${username.slice(0, 3)}******${username.slice(-2)}`
        : '******';
    const connections = await this.serviceConnections.listForAccount(
      account.id,
    );
    const connected = account.status === 'active' && !!account.encryptedToken;
    const recovering = connections.some(
      (connection) => connection.status === 'recovering',
    );
    const viewStatus = connected
      ? ('connected' as const)
      : recovering
        ? ('recovering' as const)
        : ('attention' as const);
    const serviceStatus = (type: 'study_room' | 'library') => {
      const connection = connections.find((item) => item.serviceType === type);
      if (!connection) return 'not_connected' as const;
      if (connection.status === 'active' && connection.encryptedToken)
        return 'connected' as const;
      return connection.status === 'recovering'
        ? ('recovering' as const)
        : ('attention' as const);
    };

    return {
      id: String(account.id),
      schoolCode: account.schoolCode || DEFAULT_SCHOOL_CODE,
      label: account.label,
      username: masked,
      status: viewStatus,
      statusLabel:
        viewStatus === 'connected'
          ? '已连接'
          : viewStatus === 'recovering'
            ? '正在恢复连接'
            : '登录已失效',
      tokenLabel:
        viewStatus === 'connected'
          ? '账号可用'
          : viewStatus === 'recovering'
            ? '正在检查账号'
            : '请重新验证账号',
      refreshedAt: formatDate(account.tokenRefreshedAt),
      lastVerifiedAt: formatDate(account.lastVerifiedAt),
      tasks,
      services: [
        {
          type: 'study_room',
          status: serviceStatus('study_room'),
          label: '自习室',
        },
        {
          type: 'library',
          status: serviceStatus('library'),
          label: '图书馆',
        },
      ],
    };
  }
}

function normalizeSchoolCode(value: unknown): SchoolCode {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_SCHOOL_CODE;
  }
  if (!isSchoolCode(value)) {
    throw new UnprocessableEntityException('不支持的高校');
  }
  return value;
}

function requireText(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new UnprocessableEntityException(`${field}不能为空`);
  return trimmed;
}

function formatDate(value: Date | null): string {
  if (!value) return '尚未验证';
  return value.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
