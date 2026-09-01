import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformCryptoService } from './platform-crypto.service';
import { BookingRunEntity } from './entities/booking-run.entity';
import { BookingTaskEntity } from './entities/booking-task.entity';
import { SchoolAccountEntity } from './entities/school-account.entity';
import { SeatClientService } from './seat-client.service';

@Injectable()
export class PlatformBookingExecutor {
  constructor(
    @InjectRepository(BookingRunEntity)
    private readonly runs: Repository<BookingRunEntity>,
    @InjectRepository(BookingTaskEntity)
    private readonly tasks: Repository<BookingTaskEntity>,
    @InjectRepository(SchoolAccountEntity)
    private readonly accounts: Repository<SchoolAccountEntity>,
    private readonly crypto: PlatformCryptoService,
    private readonly seatClient: SeatClientService,
  ) {}

  async execute(runId: number): Promise<void> {
    const run = await this.runs.findOne({
      where: { id: runId },
      relations: ['task', 'task.schoolAccount', 'schoolAccount', 'user'],
    });
    if (!run) throw new NotFoundException('运行记录不存在');

    run.status = 'running';
    run.startedAt = new Date();
    await this.runs.save(run);

    try {
      if (run.runType === 'prewarm') {
        await this.executePrewarm(run);
      } else {
        await this.executeBooking(run);
      }
    } catch (error: unknown) {
      run.status = 'failed';
      run.finishedAt = new Date();
      run.message = safeErrorMessage(error);
      await this.runs.save(run);
    }
  }

  private async executePrewarm(run: BookingRunEntity): Promise<void> {
    const account = await this.getAccount(run);
    await this.refreshAccount(account);
    run.status = 'success';
    run.finishedAt = new Date();
    run.attemptsUsed = 1;
    run.message = 'Token 预热成功';
    await this.runs.save(run);
  }

  private async executeBooking(run: BookingRunEntity): Promise<void> {
    const account = await this.getAccount(run);
    const task = await this.getTask(run);
    let token = account.encryptedToken
      ? this.crypto.decrypt(account.encryptedToken)
      : null;

    if (!token || !(await this.seatClient.verifyToken(token)).success) {
      token = await this.refreshAccount(account);
    }

    const candidates = this.seatClient.buildCandidates(
      task.primarySeatId,
      task.backupSeatIds,
      task.timeCandidates,
    );
    const maxAttempts = Math.min(
      Math.max(task.maxAttempts, 1),
      candidates.length,
    );
    const deadline = Date.now() + Math.max(1, task.bookingWindowSeconds) * 1000;
    let lastMessage = '预约窗口结束';

    for (let index = 0; index < maxAttempts; index += 1) {
      const remainingMs = deadline - Date.now();
      if (remainingMs < 500) break;

      const candidate = candidates[index];
      const timeoutMs = Math.min(3000, remainingMs);
      const response = await this.seatClient.book(
        token,
        run.targetDate,
        candidate,
        timeoutMs,
      );
      run.attemptsUsed = index + 1;
      run.httpStatus = response.httpStatus;
      run.responseCode = response.code || null;
      lastMessage = response.message || '预约失败';

      if (response.success) {
        const data =
          response.payload?.data && typeof response.payload.data === 'object'
            ? (response.payload.data as Record<string, unknown>)
            : {};
        run.status = 'success';
        run.finishedAt = new Date();
        run.message = '预约成功';
        run.receipt = stringValue(data.receipt);
        run.location = stringValue(data.location);
        run.reservedBegin = stringValue(data.begin);
        run.reservedEnd = stringValue(data.end);
        await this.runs.save(run);
        return;
      }

      const waitMs = Math.min(
        Math.max(task.attemptDelaySeconds, 0) * 1000,
        Math.max(0, deadline - Date.now()),
      );
      if (waitMs > 0 && index + 1 < maxAttempts) await sleep(waitMs);
    }

    run.status = 'failed';
    run.finishedAt = new Date();
    run.message = lastMessage;
    await this.runs.save(run);
  }

  private async refreshAccount(account: SchoolAccountEntity): Promise<string> {
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
    await this.accounts.save(account);
    return authenticated.token;
  }

  private async getAccount(
    run: BookingRunEntity,
  ): Promise<SchoolAccountEntity> {
    const account =
      run.schoolAccount ||
      (await this.accounts.findOne({ where: { id: run.schoolAccountId } }));
    if (!account) throw new NotFoundException('预约账号不存在');
    return account;
  }

  private async getTask(run: BookingRunEntity): Promise<BookingTaskEntity> {
    const task =
      run.task || (await this.tasks.findOne({ where: { id: run.taskId } }));
    if (!task) throw new NotFoundException('预约任务不存在');
    return task;
  }
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message)
    return error.message.slice(0, 240);
  return '任务执行失败';
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
