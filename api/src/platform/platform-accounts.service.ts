import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { CreateSchoolAccountDto } from './dto/school-account.dto';
import { SchoolAccountEntity } from './entities/school-account.entity';
import { BookingTaskEntity } from './entities/booking-task.entity';
import { PlatformCryptoService } from './platform-crypto.service';
import { SeatClientService } from './seat-client.service';

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
};

@Injectable()
export class PlatformAccountsService {
  constructor(
    @InjectRepository(SchoolAccountEntity)
    private readonly accounts: Repository<SchoolAccountEntity>,
    @InjectRepository(BookingTaskEntity)
    private readonly tasks: Repository<BookingTaskEntity>,
    private readonly crypto: PlatformCryptoService,
    private readonly seatClient: SeatClientService,
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
    const authenticated = await this.seatClient.authenticate(
      dto.schoolUsername,
      dto.schoolPassword,
    );
    const verified = await this.seatClient.verifyToken(authenticated.token);

    if (!verified.success) {
      throw new NotFoundException('学校账号验证失败');
    }

    const account = this.accounts.create({
      label: dto.label.trim(),
      schoolUsername: dto.schoolUsername.trim(),
      encryptedSchoolPassword: this.crypto.encrypt(dto.schoolPassword),
      encryptedToken: this.crypto.encrypt(authenticated.token),
      status: 'active',
      tokenRefreshedAt: new Date(),
      lastVerifiedAt: new Date(),
      user: { id: userId } as UserEntity,
    });

    return this.toView(await this.accounts.save(account));
  }

  async refresh(userId: number, id: number): Promise<SchoolAccountView> {
    const account = await this.findOwned(userId, id);
    const password = this.crypto.decrypt(account.encryptedSchoolPassword);
    const authenticated = await this.seatClient.authenticate(
      account.schoolUsername,
      password,
    );
    const verified = await this.seatClient.verifyToken(authenticated.token);

    account.encryptedToken = this.crypto.encrypt(authenticated.token);
    account.tokenRefreshedAt = new Date();
    account.lastVerifiedAt = verified.success
      ? new Date()
      : account.lastVerifiedAt;
    account.status = verified.success ? 'active' : 'attention';

    return this.toView(await this.accounts.save(account));
  }

  async remove(userId: number, id: number): Promise<void> {
    const account = await this.findOwned(userId, id);
    await this.accounts.remove(account);
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
      where: { schoolAccount: { id: account.id } },
    });
    const username = account.schoolUsername;
    const masked =
      username.length > 5
        ? `${username.slice(0, 3)}******${username.slice(-2)}`
        : '******';
    const connected = account.status === 'active' && !!account.encryptedToken;

    return {
      id: String(account.id),
      label: account.label,
      username: masked,
      status: connected ? 'connected' : 'attention',
      statusLabel: connected ? '连接正常' : '需要关注',
      tokenLabel: connected ? 'Token 已缓存' : 'Token 不可用',
      refreshedAt: formatDate(account.tokenRefreshedAt),
      lastVerifiedAt: formatDate(account.lastVerifiedAt),
      tasks,
    };
  }
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
