import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { SchoolAccountEntity } from './entities/school-account.entity';
import {
  SchoolServiceConnectionEntity,
  SeatServiceType,
} from './entities/school-service-connection.entity';
import { PlatformCryptoService } from './platform-crypto.service';
import { SchoolAuthenticationService } from './school-authentication.service';

export type ReadySeatConnection = {
  token: string;
  mode: 'direct' | 'webvpn';
  serviceType: SeatServiceType;
  connection: SchoolServiceConnectionEntity;
};

@Injectable()
export class PlatformServiceConnectionsService {
  private readonly readyFlights = new Map<
    string,
    Promise<ReadySeatConnection>
  >();

  constructor(
    @InjectRepository(SchoolServiceConnectionEntity)
    private readonly connections: Repository<SchoolServiceConnectionEntity>,
    @InjectRepository(SchoolAccountEntity)
    private readonly accounts: Repository<SchoolAccountEntity>,
    private readonly crypto: PlatformCryptoService,
    private readonly schoolAuth: SchoolAuthenticationService,
  ) {}

  async saveAuthenticated(
    account: SchoolAccountEntity,
    serviceType: SeatServiceType,
    token: string,
    mode: 'direct' | 'webvpn',
  ): Promise<SchoolServiceConnectionEntity> {
    const ownerId = account.userId || account.user?.id;
    if (!ownerId) {
      throw new UnprocessableEntityException('校园账号归属信息不完整');
    }
    let connection = await this.connections.findOne({
      where: { schoolAccount: { id: account.id }, serviceType },
    });
    connection ??= this.connections.create({
      schoolAccount: account,
      user: { id: ownerId } as UserEntity,
      serviceType,
      identifier: serviceType === 'library' ? 'cczu' : 'cczukaoyan',
    });
    connection.encryptedToken = this.crypto.encrypt(token);
    connection.authMode = mode;
    connection.status = 'active';
    connection.tokenRefreshedAt = new Date();
    connection.lastVerifiedAt = new Date();
    return this.connections.save(connection);
  }

  async ensureReady(
    account: SchoolAccountEntity,
    serviceType: SeatServiceType,
    forceRefresh = false,
  ): Promise<ReadySeatConnection> {
    const ownerId = account.userId || account.user?.id;
    if (!ownerId) {
      throw new UnprocessableEntityException('校园账号归属信息不完整');
    }
    const key = `${ownerId}:${account.id}:${serviceType}:${forceRefresh ? 'force' : 'normal'}`;
    const current = this.readyFlights.get(key);
    if (current) return current;
    const flight = this.ensureReadyOnce(
      account,
      serviceType,
      forceRefresh,
    ).finally(() => {
      if (this.readyFlights.get(key) === flight) this.readyFlights.delete(key);
    });
    this.readyFlights.set(key, flight);
    return flight;
  }

  private async ensureReadyOnce(
    account: SchoolAccountEntity,
    serviceType: SeatServiceType,
    forceRefresh: boolean,
  ): Promise<ReadySeatConnection> {
    const ownerId = account.userId || account.user?.id;
    if (!ownerId) {
      throw new UnprocessableEntityException('校园账号归属信息不完整');
    }
    let connection = await this.connections.findOne({
      where: {
        schoolAccount: { id: account.id },
        user: { id: ownerId },
        serviceType,
      },
    });

    if (!forceRefresh && connection?.encryptedToken) {
      try {
        const token = this.crypto.decrypt(connection.encryptedToken);
        const recentlyVerified =
          connection.authMode === 'direct' &&
          connection.lastVerifiedAt &&
          Date.now() - connection.lastVerifiedAt.getTime() < 60_000;
        if (recentlyVerified) {
          connection.status = 'active';
          return {
            token,
            mode: connection.authMode,
            serviceType,
            connection,
          };
        }
        const verified = await this.schoolAuth.verifyToken(
          token,
          connection.authMode,
          serviceType,
        );
        if (verified.success) {
          connection.lastVerifiedAt = new Date();
          connection.status = 'active';
          await this.connections.save(connection);
          return {
            token,
            mode: connection.authMode,
            serviceType,
            connection,
          };
        }
      } catch {
        // Re-authenticate below. WebVPN sessions are intentionally process-local.
      }
    }

    try {
      const password = this.crypto.decrypt(account.encryptedSchoolPassword);
      const authenticated = await this.schoolAuth.authenticate(
        account.schoolUsername,
        password,
        undefined,
        serviceType,
      );
      const verified = await this.schoolAuth.verifyToken(
        authenticated.token,
        authenticated.mode,
        serviceType,
      );
      if (!verified.success) {
        throw new UnprocessableEntityException('学校服务授权验证失败');
      }
      connection = await this.saveAuthenticated(
        account,
        serviceType,
        authenticated.token,
        authenticated.mode,
      );
      if (serviceType === 'study_room') {
        account.encryptedToken = this.crypto.encrypt(authenticated.token);
        account.authMode = authenticated.mode;
        account.status = 'active';
        account.tokenRefreshedAt = new Date();
        account.lastVerifiedAt = new Date();
        await this.accounts.save(account);
      }
      return {
        token: authenticated.token,
        mode: authenticated.mode,
        serviceType,
        connection,
      };
    } catch (error: unknown) {
      if (connection) {
        connection.status = 'attention';
        connection.encryptedToken = null;
        await this.connections.save(connection);
      }
      throw error;
    }
  }

  async listForAccount(accountId: number) {
    return this.connections.find({
      where: { schoolAccount: { id: accountId } },
      order: { serviceType: 'ASC' },
    });
  }
}
