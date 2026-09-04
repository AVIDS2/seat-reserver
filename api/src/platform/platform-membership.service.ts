import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { RoleEnum } from '../roles/roles.enum';
import { PlatformProRequestEntity } from './entities/platform-pro-request.entity';
import { PlatformMembershipEntity } from './entities/platform-membership.entity';
import { SchoolAccountEntity } from './entities/school-account.entity';
import {
  ADMIN_SCHOOL_ACCOUNT_LIMIT,
  FREE_SCHOOL_ACCOUNT_LIMIT,
  PRO_PRICE_CENTS,
  PRO_SCHOOL_ACCOUNT_LIMIT,
} from './platform-growth.constants';

export type MembershipPlan = 'free' | 'pro' | 'admin';

export type MembershipView = {
  plan: MembershipPlan;
  planLabel: string;
  isPro: boolean;
  isPermanent: boolean;
  accountLimit: number;
  accountCount: number;
  priceCents: number;
  priceLabel: string;
};

export type ProRequestView = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string | null;
  priceCents: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  note: string | null;
  createdAt: string;
  handledAt: string | null;
};

@Injectable()
export class PlatformMembershipService {
  constructor(
    @InjectRepository(PlatformMembershipEntity)
    private readonly memberships: Repository<PlatformMembershipEntity>,
    @InjectRepository(PlatformProRequestEntity)
    private readonly proRequests: Repository<PlatformProRequestEntity>,
    @InjectRepository(SchoolAccountEntity)
    private readonly accounts: Repository<SchoolAccountEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async getEntitlement(userId: number): Promise<MembershipView> {
    const [user, membership, accountCount] = await Promise.all([
      this.users.findOne({ where: { id: userId } }),
      this.memberships.findOne({ where: { user: { id: userId } } }),
      this.accounts.count({ where: { user: { id: userId } } }),
    ]);
    if (!user) throw new NotFoundException('用户不存在');
    return this.toView(user, membership, accountCount);
  }

  async getPlanForUser(userId: number): Promise<MembershipPlan> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('用户不存在');
    if (Number(user.role?.id) === RoleEnum.admin) return 'admin';
    const membership = await this.memberships.findOne({
      where: { user: { id: userId } },
    });
    return this.isActivePro(membership) ? 'pro' : 'free';
  }

  async assertCanCreateSchoolAccount(
    userId: number,
    manager?: EntityManager,
  ): Promise<void> {
    const executor = manager ?? this.dataSource.manager;
    if (manager) {
      await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `platform-school-account-limit:${userId}`,
      ]);
    }
    const users = executor.getRepository(UserEntity);
    const memberships = executor.getRepository(PlatformMembershipEntity);
    const accounts = executor.getRepository(SchoolAccountEntity);
    const user = await users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('用户不存在');
    if (Number(user.role?.id) === RoleEnum.admin) return;
    const membership = await memberships.findOne({
      where: { user: { id: userId } },
    });
    const limit = this.accountLimitFor(membership);
    const count = await accounts.count({ where: { user: { id: userId } } });
    if (count >= limit) {
      throw new UnprocessableEntityException(
        `当前方案最多绑定 ${limit} 个校园账号，请升级 Pro 后继续添加`,
      );
    }
  }

  async requestPro(userId: number): Promise<{
    membership: MembershipView;
    request: ProRequestView | null;
    message: string;
  }> {
    const membership = await this.getEntitlement(userId);
    if (membership.isPro) {
      return {
        membership,
        request: null,
        message: '当前账号已经拥有 Pro 权益',
      };
    }
    let request = await this.proRequests.findOne({
      where: { user: { id: userId }, status: 'pending' },
      order: { createdAt: 'DESC' },
    });
    if (!request) {
      request = await this.proRequests.save(
        this.proRequests.create({
          plan: 'pro',
          priceCents: PRO_PRICE_CENTS,
          status: 'pending',
          note: null,
          handledAt: null,
          user: { id: userId } as UserEntity,
          handledByUser: null,
        }),
      );
    }
    return {
      membership,
      request: await this.getPendingProRequest(userId),
      message: '开通申请已提交，管理员确认后会永久启用 Pro',
    };
  }

  async getPendingProRequest(userId: number): Promise<ProRequestView | null> {
    const request = await this.proRequests.findOne({
      where: { user: { id: userId }, status: 'pending' },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
    return request ? this.toRequestView(request) : null;
  }

  async grantPro(
    adminId: number,
    userId: number,
    note?: string,
  ): Promise<MembershipView> {
    await this.dataSource.transaction(async (manager) => {
      const users = manager.getRepository(UserEntity);
      const memberships = manager.getRepository(PlatformMembershipEntity);
      const requests = manager.getRepository(PlatformProRequestEntity);
      const user = await users.findOne({ where: { id: userId } });
      if (!user) throw new NotFoundException('用户不存在');

      let membership = await memberships
        .createQueryBuilder('membership')
        .setLock('pessimistic_write')
        .where('membership.userId = :userId', { userId })
        .getOne();
      if (!membership) {
        membership = memberships.create({
          plan: 'pro',
          proActivatedAt: new Date(),
          proExpiresAt: null,
          source: 'admin',
          note: note?.trim() || null,
          user: { id: userId } as UserEntity,
          grantedByUser: { id: adminId } as UserEntity,
        });
      } else {
        membership.plan = 'pro';
        membership.proActivatedAt = membership.proActivatedAt ?? new Date();
        membership.proExpiresAt = null;
        membership.source = 'admin';
        membership.note = note?.trim() || membership.note;
        membership.grantedByUser = { id: adminId } as UserEntity;
      }
      await memberships.save(membership);

      const request = await requests.findOne({
        where: { user: { id: userId }, status: 'pending' },
      });
      if (request) {
        request.status = 'approved';
        request.handledAt = new Date();
        request.handledByUser = { id: adminId } as UserEntity;
        if (note?.trim()) request.note = note.trim();
        await requests.save(request);
      }
    });
    return this.getEntitlement(userId);
  }

  async rejectProRequest(
    adminId: number,
    requestId: number,
    note?: string,
  ): Promise<ProRequestView> {
    const request = await this.proRequests.findOne({
      where: { id: requestId, status: 'pending' },
      relations: ['user'],
    });
    if (!request) throw new NotFoundException('待处理的 Pro 申请不存在');
    request.status = 'rejected';
    request.handledAt = new Date();
    request.handledByUser = { id: adminId } as UserEntity;
    if (note?.trim()) request.note = note.trim();
    return this.toRequestView(await this.proRequests.save(request));
  }

  async listProRequests(): Promise<ProRequestView[]> {
    const requests = await this.proRequests.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return requests.map((request) => this.toRequestView(request));
  }

  async adminSummary(): Promise<{
    proUsers: number;
    pendingProRequests: number;
  }> {
    const [proUsers, pendingProRequests] = await Promise.all([
      this.memberships.count({ where: { plan: 'pro' } }),
      this.proRequests.count({ where: { status: 'pending' } }),
    ]);
    return { proUsers, pendingProRequests };
  }

  private toView(
    user: UserEntity,
    membership: PlatformMembershipEntity | null,
    accountCount: number,
  ): MembershipView {
    const isAdmin = Number(user.role?.id) === RoleEnum.admin;
    const isPro = isAdmin || this.isActivePro(membership);
    const plan: MembershipPlan = isAdmin ? 'admin' : isPro ? 'pro' : 'free';
    return {
      plan,
      planLabel: isAdmin ? '管理员' : isPro ? 'Pro 会员' : '普通用户',
      isPro,
      isPermanent: isAdmin || (isPro && !membership?.proExpiresAt),
      accountLimit: isAdmin
        ? ADMIN_SCHOOL_ACCOUNT_LIMIT
        : isPro
          ? PRO_SCHOOL_ACCOUNT_LIMIT
          : FREE_SCHOOL_ACCOUNT_LIMIT,
      accountCount,
      priceCents: PRO_PRICE_CENTS,
      priceLabel: '¥20 / 永久',
    };
  }

  private accountLimitFor(membership: PlatformMembershipEntity | null): number {
    return this.isActivePro(membership)
      ? PRO_SCHOOL_ACCOUNT_LIMIT
      : FREE_SCHOOL_ACCOUNT_LIMIT;
  }

  private isActivePro(membership: PlatformMembershipEntity | null): boolean {
    return Boolean(
      membership?.plan === 'pro' &&
      (!membership.proExpiresAt || membership.proExpiresAt > new Date()),
    );
  }

  private toRequestView(request: PlatformProRequestEntity): ProRequestView {
    return {
      id: String(request.id),
      userId: String(request.userId),
      userName:
        [request.user?.firstName, request.user?.lastName]
          .filter(Boolean)
          .join(' ') || '未命名用户',
      userEmail: request.user?.email ?? null,
      priceCents: request.priceCents,
      status: request.status,
      note: request.note,
      createdAt: request.createdAt.toISOString(),
      handledAt: request.handledAt?.toISOString() ?? null,
    };
  }
}
