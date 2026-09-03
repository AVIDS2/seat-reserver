import {
  Injectable,
  NotFoundException,
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
import { PlatformServiceConnectionsService } from './platform-service-connections.service';

export type SchoolAccountView = {
  id: string;
  label: string;
  username: string;
  status: 'connected' | 'attention';
  statusLabel: string;
  tokenLabel: string;
  refreshedAt: string;
  lastVerifiedAt: string;
  tasks: number;
  services: Array<{
    type: 'study_room' | 'library';
    status: 'connected' | 'attention' | 'not_connected';
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
    const label = requireText(dto.label, '账号名称');
    const username = requireText(dto.schoolUsername, '学校账号');
    const authenticated = await this.schoolAuth.authenticate(
      username,
      dto.schoolPassword,
    );
    const verified = await this.schoolAuth.verifyToken(
      authenticated.token,
      authenticated.mode,
    );

    if (!verified.success) {
      throw new UnprocessableEntityException('学校账号验证失败');
    }

    const account = this.accounts.create({
      label,
      schoolUsername: username,
      encryptedSchoolPassword: this.crypto.encrypt(dto.schoolPassword),
      encryptedToken: this.crypto.encrypt(authenticated.token),
      authMode: authenticated.mode,
      status: 'active',
      tokenRefreshedAt: new Date(),
      lastVerifiedAt: new Date(),
      user: { id: userId } as UserEntity,
    });

    const saved = await this.accounts.save(account);
    await this.serviceConnections.saveAuthenticated(
      saved,
      'study_room',
      authenticated.token,
      authenticated.mode,
    );
    return this.toView(saved);
  }

  async refresh(userId: number, id: number): Promise<SchoolAccountView> {
    const account = await this.findOwned(userId, id);
    try {
      const password = this.crypto.decrypt(account.encryptedSchoolPassword);
      const authenticated = await this.schoolAuth.authenticate(
        account.schoolUsername,
        password,
      );
      const verified = await this.schoolAuth.verifyToken(
        authenticated.token,
        authenticated.mode,
      );
      if (!verified.success)
        throw new UnprocessableEntityException('学校账号 Token 验证失败');

      account.encryptedToken = this.crypto.encrypt(authenticated.token);
      account.authMode = authenticated.mode;
      account.tokenRefreshedAt = new Date();
      account.lastVerifiedAt = new Date();
      account.status = 'active';
      const saved = await this.accounts.save(account);
      await this.serviceConnections.saveAuthenticated(
        saved,
        'study_room',
        authenticated.token,
        authenticated.mode,
      );
      return this.toView(saved);
    } catch (error: unknown) {
      account.encryptedToken = null;
      account.status = 'attention';
      await this.accounts.save(account);
      throw error;
    }
  }

  async update(
    userId: number,
    id: number,
    dto: UpdateSchoolAccountDto,
  ): Promise<SchoolAccountView> {
    const account = await this.findOwned(userId, id);
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
      const authenticated = await this.schoolAuth.authenticate(
        username,
        password,
      );
      const verified = await this.schoolAuth.verifyToken(
        authenticated.token,
        authenticated.mode,
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
        'study_room',
        authenticated.token,
        authenticated.mode,
      );
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
    const connected = account.status === 'active' && !!account.encryptedToken;
    const connections = await this.serviceConnections.listForAccount(
      account.id,
    );
    const serviceStatus = (type: 'study_room' | 'library') => {
      const connection = connections.find((item) => item.serviceType === type);
      if (!connection) return 'not_connected' as const;
      return connection.status === 'active' && connection.encryptedToken
        ? ('connected' as const)
        : ('attention' as const);
    };

    return {
      id: String(account.id),
      label: account.label,
      username: masked,
      status: connected ? 'connected' : 'attention',
      statusLabel: connected ? '连接正常' : '需要关注',
      tokenLabel: connected ? '连接可用' : '需要重新连接',
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
