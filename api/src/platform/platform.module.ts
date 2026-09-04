import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { SessionModule } from '../session/session.module';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { PlatformAccountsController } from './platform-accounts.controller';
import { PlatformAccountsService } from './platform-accounts.service';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminGuard } from './platform-admin.guard';
import { PlatformAdminService } from './platform-admin.service';
import { PlatformAuthController } from './platform-auth.controller';
import { PlatformBookingExecutor } from './platform-booking.executor';
import { PlatformDashboardController } from './platform-dashboard.controller';
import { PlatformDashboardService } from './platform-dashboard.service';
import { PlatformHealthController } from './platform-health.controller';
import { PlatformInvitationsController } from './platform-invitations.controller';
import { PlatformInvitationsService } from './platform-invitations.service';
import { PlatformNotificationsController } from './platform-notifications.controller';
import { PlatformNotificationsService } from './platform-notifications.service';
import { PlatformRewardsController } from './platform-rewards.controller';
import { PlatformRewardsService } from './platform-rewards.service';
import { PlatformMembershipService } from './platform-membership.service';
import { BookingRunEntity } from './entities/booking-run.entity';
import { BookingTaskEntity } from './entities/booking-task.entity';
import { PlatformInvitationEntity } from './entities/platform-invitation.entity';
import { PlatformInvitationUseEntity } from './entities/platform-invitation-use.entity';
import { PlatformMembershipEntity } from './entities/platform-membership.entity';
import { PlatformPointsLedgerEntity } from './entities/platform-points-ledger.entity';
import { PlatformPointsWalletEntity } from './entities/platform-points-wallet.entity';
import { PlatformProRequestEntity } from './entities/platform-pro-request.entity';
import { PlatformReferralEntity } from './entities/platform-referral.entity';
import { PlatformNotificationEntity } from './entities/platform-notification.entity';
import { SchoolAccountEntity } from './entities/school-account.entity';
import { SchoolServiceConnectionEntity } from './entities/school-service-connection.entity';
import { PlatformProcessor } from './platform-processor';
import { PlatformCryptoService } from './platform-crypto.service';
import {
  PlatformQueueService,
  PLATFORM_BOOKING_QUEUE,
} from './platform-queue.service';
import { PlatformRedisService } from './platform-redis.service';
import { PlatformRunsController } from './platform-runs.controller';
import { PlatformRunsService } from './platform-runs.service';
import { PlatformReservationsController } from './platform-reservations.controller';
import { PlatformReservationsService } from './platform-reservations.service';
import { PlatformScheduler } from './platform-scheduler';
import { PlatformTasksController } from './platform-tasks.controller';
import { PlatformTasksService } from './platform-tasks.service';
import { PlatformServiceConnectionsService } from './platform-service-connections.service';
import { PlatformSeatCatalogController } from './platform-seat-catalog.controller';
import { PlatformSeatCatalogService } from './platform-seat-catalog.service';
import { SeatClientService } from './seat-client.service';
import { SchoolAuthenticationService } from './school-authentication.service';
import { WebVpnSeatClientService } from './webvpn-seat-client.service';

@Module({
  imports: [
    AuthModule,
    SessionModule,
    UsersModule,
    ScheduleModule.forRoot(),
    BullModule.forRoot({ connection: redisConnection() }),
    BullModule.registerQueue({ name: PLATFORM_BOOKING_QUEUE }),
    TypeOrmModule.forFeature([
      BookingRunEntity,
      BookingTaskEntity,
      PlatformInvitationEntity,
      PlatformInvitationUseEntity,
      PlatformMembershipEntity,
      PlatformNotificationEntity,
      PlatformPointsLedgerEntity,
      PlatformPointsWalletEntity,
      PlatformProRequestEntity,
      PlatformReferralEntity,
      SchoolAccountEntity,
      SchoolServiceConnectionEntity,
      UserEntity,
    ]),
  ],
  controllers: [
    PlatformAccountsController,
    PlatformAdminController,
    PlatformAuthController,
    PlatformDashboardController,
    PlatformHealthController,
    PlatformInvitationsController,
    PlatformNotificationsController,
    PlatformRewardsController,
    PlatformRunsController,
    PlatformReservationsController,
    PlatformTasksController,
    PlatformSeatCatalogController,
  ],
  providers: [
    PlatformAccountsService,
    PlatformAdminGuard,
    PlatformAdminService,
    PlatformBookingExecutor,
    PlatformCryptoService,
    PlatformDashboardService,
    PlatformInvitationsService,
    PlatformNotificationsService,
    PlatformMembershipService,
    PlatformProcessor,
    PlatformQueueService,
    PlatformRedisService,
    PlatformRewardsService,
    PlatformRunsService,
    PlatformReservationsService,
    PlatformScheduler,
    PlatformTasksService,
    PlatformServiceConnectionsService,
    PlatformSeatCatalogService,
    SchoolAuthenticationService,
    SeatClientService,
    WebVpnSeatClientService,
  ],
  exports: [PlatformDashboardService],
})
export class PlatformModule {}

function redisConnection() {
  const url = new URL(process.env.QUEUE_REDIS_URL || 'redis://redis:6379/1');
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    db: Number(url.pathname.slice(1) || 0),
  };
}
