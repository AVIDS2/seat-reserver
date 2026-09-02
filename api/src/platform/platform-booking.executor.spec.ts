import { describe, expect, it, jest } from '@jest/globals';
import { Repository } from 'typeorm';
import { PlatformBookingExecutor } from './platform-booking.executor';
import { BookingRunEntity } from './entities/booking-run.entity';
import { BookingTaskEntity } from './entities/booking-task.entity';
import { SchoolAccountEntity } from './entities/school-account.entity';

function makeRun(enabled: boolean): BookingRunEntity {
  return {
    id: 1,
    runType: 'booking',
    status: 'pending',
    targetDate: '2026-09-02',
    startedAt: null,
    finishedAt: null,
    message: null,
    receipt: null,
    location: null,
    reservedBegin: null,
    reservedEnd: null,
    httpStatus: null,
    responseCode: null,
    attemptsUsed: 0,
    taskId: 11,
    schoolAccountId: 22,
    userId: 7,
    task: {
      id: 11,
      userId: 7,
      schoolAccountId: 22,
      enabled,
      primarySeatId: '197',
      backupSeatIds: [],
      timeCandidates: [{ start: 840, end: 1320 }],
      maxAttempts: 1,
      attemptDelaySeconds: 0,
      bookingWindowSeconds: 5,
    } as unknown as BookingTaskEntity,
    schoolAccount: {
      id: 22,
      userId: 7,
      status: 'active',
      encryptedToken: 'encrypted-token',
    } as SchoolAccountEntity,
    user: { id: 7, status: { id: 1 } },
  } as BookingRunEntity;
}

type BookMock = (
  token: string,
  mode: 'direct' | 'webvpn',
  date: string,
  candidate: { seatId: string; startTime: number; endTime: number },
  timeoutMs: number,
) => Promise<{
  success: boolean;
  httpStatus: number;
  code: string;
  message: string;
  payload: Record<string, unknown>;
}>;

function makeExecutor(
  run: BookingRunEntity,
  book: BookMock = jest.fn<BookMock>(),
) {
  const save = jest.fn((value: BookingRunEntity) => Promise.resolve(value));
  const runs = {
    findOne: jest.fn<(options: unknown) => Promise<BookingRunEntity | null>>(),
    save,
  } as unknown as Repository<BookingRunEntity>;
  (
    runs.findOne as jest.MockedFunction<
      (options: unknown) => Promise<BookingRunEntity | null>
    >
  ).mockResolvedValue(run);
  const tasks = {} as unknown as Repository<BookingTaskEntity>;
  const accounts = {} as unknown as Repository<SchoolAccountEntity>;
  const redis = {
    tryLock: jest.fn<() => Promise<string | null>>(),
    unlock: jest.fn<() => Promise<void>>(),
  };
  redis.tryLock.mockResolvedValue('lock-token');
  redis.unlock.mockResolvedValue(undefined);
  const notifications = {
    create: jest.fn((...args: unknown[]) => {
      void args;
      return Promise.resolve(undefined);
    }),
  };
  const seatClient = {
    buildCandidates: jest.fn(() => [
      { seatId: '197', startTime: 840, endTime: 1320 },
    ]),
  };
  const crypto = {
    decrypt: jest.fn<(value: string) => string>(() => 'school-token'),
  };
  const schoolAuth = {
    authenticate: jest.fn(() =>
      Promise.resolve({ token: 'school-token', mode: 'direct' as const }),
    ),
    verifyToken: jest.fn(() => Promise.resolve({ success: true })),
    book,
  };
  return {
    executor: new PlatformBookingExecutor(
      runs,
      tasks,
      accounts,
      crypto as never,
      seatClient as never,
      schoolAuth as never,
      notifications as never,
      redis as never,
    ),
    save,
    book,
    notifications,
    seatClient,
    schoolAuth,
  };
}

describe('PlatformBookingExecutor', () => {
  it('should skip a booking that was disabled after being queued', async () => {
    const run = makeRun(false);
    const { executor, book, schoolAuth } = makeExecutor(run);

    await executor.execute(run.id);

    expect(run.status).toBe('skipped');
    expect(run.message).toBe('任务已暂停，跳过本次预约');
    expect(book).not.toHaveBeenCalled();
    expect(schoolAuth.verifyToken).not.toHaveBeenCalled();
  });

  it('should record a successful booking and create a notification', async () => {
    const run = makeRun(true);
    const book = jest.fn<BookMock>();
    book.mockResolvedValue({
      success: true,
      httpStatus: 200,
      code: '0',
      message: '',
      payload: {
        data: {
          receipt: '0131-600-1',
          location: '座位 197',
          begin: '14:00',
          end: '22:00',
        },
      },
    });
    const { executor, notifications } = makeExecutor(run, book);

    await executor.execute(run.id);

    expect(run.status).toBe('success');
    expect(run.receipt).toBe('0131-600-1');
    expect(run.location).toBe('座位 197');
    expect(book).toHaveBeenCalledWith(
      'school-token',
      'direct',
      '2026-09-02',
      { seatId: '197', startTime: 840, endTime: 1320 },
      expect.any(Number),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'booking_success', userId: 7 }),
    );
  });
});
