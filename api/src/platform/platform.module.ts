import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { PlatformAccountsController } from './platform-accounts.controller';
import { PlatformAccountsService } from './platform-accounts.service';
import { PlatformAuthController } from './platform-auth.controller';
import { PlatformBookingExecutor } from './platform-booking.executor';
import { PlatformDashboardController } from './platform-dashboard.controller';
import { PlatformDashboardService } from './platform-dashboard.service';
import { PlatformHealthController } from './platform-health.controller';
import { PlatformInvitationsController } from './platform-invitations.controller';
import { PlatformInvitationsService } from './platform-invitations.service';
import { BookingRunEntity } from './entities/booking-run.entity';
import { BookingTaskEntity } from './entities/booking-task.entity';
import { PlatformInvitationEntity } from './entities/platform-invitation.entity';
import { SchoolAccountEntity } from './entities/school-account.entity';
import { PlatformProcessor } from './platform-processor';
import { PlatformCryptoService } from './platform-crypto.service';
import {
  PlatformQueueService,
  PLATFORM_BOOKING_QUEUE,
} from './platform-queue.service';
import { PlatformRedisService } from './platform-redis.service';
import { PlatformRunsController } from './platform-runs.controller';
import { PlatformRunsService } from './platform-runs.service';
import { PlatformScheduler } from './platform-scheduler';
import { PlatformTasksController } from './platform-tasks.controller';
import { PlatformTasksService } from './platform-tasks.service';
import { SeatClientService } from './seat-client.service';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    ScheduleModule.forRoot(),
    BullModule.forRoot({ connection: redisConnection() }),
    BullModule.registerQueue({ name: PLATFORM_BOOKING_QUEUE }),
    TypeOrmModule.forFeature([
      BookingRunEntity,
      BookingTaskEntity,
      PlatformInvitationEntity,
      SchoolAccountEntity,
      UserEntity,
    ]),
  ],
  controllers: [
    PlatformAccountsController,
    PlatformAuthController,
    PlatformDashboardController,
    PlatformHealthController,
    PlatformInvitationsController,
    PlatformRunsController,
    PlatformTasksController,
  ],
  providers: [
    PlatformAccountsService,
    PlatformBookingExecutor,
    PlatformCryptoService,
    PlatformDashboardService,
    PlatformInvitationsService,
    PlatformProcessor,
    PlatformQueueService,
    PlatformRedisService,
    PlatformRunsService,
    PlatformScheduler,
    PlatformTasksService,
    SeatClientService,
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
