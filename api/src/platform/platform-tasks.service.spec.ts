import { describe, expect, it, jest } from '@jest/globals';
import { Repository } from 'typeorm';
import { BookingRunEntity } from './entities/booking-run.entity';
import { BookingTaskEntity } from './entities/booking-task.entity';
import { PlatformTasksService } from './platform-tasks.service';
import { SchoolAccountEntity } from './entities/school-account.entity';

function makeHarness() {
  const account = {
    id: 4,
    userId: 7,
    label: '我的账号',
  } as unknown as SchoolAccountEntity;
  const task = {
    id: 12,
    userId: 7,
    schoolAccountId: 4,
    schoolAccount: account,
    name: '早起座位',
    venueType: 'study_room',
    building: '5号楼',
    roomName: '智能自习室',
    buildingId: '5',
    roomId: 'room-1',
    scheduleMode: 'daily',
    scheduleWeekdays: [1, 2, 3, 4, 5],
    scheduleDates: [],
    targetDate: null,
    primarySeatId: '197',
    primarySeatLabel: '044',
    backupSeatIds: [],
    backupSeatLabels: [],
    timeCandidates: [{ start: 480, end: 840 }],
    maxAttempts: 12,
    attemptDelaySeconds: 1.2,
    bookingWindowSeconds: 20,
    prewarmOffsetSeconds: 0,
    runOffsetSeconds: 1,
    enabled: false,
  } as unknown as BookingTaskEntity;
  const ensureReady = jest.fn(() =>
    Promise.reject(new Error('学校系统维护中')),
  );
  const tasks = {
    create: jest.fn((value: unknown) => {
      Object.assign(task, value);
      return task;
    }),
    save: jest.fn((value: BookingTaskEntity) => Promise.resolve(value)),
    findOne: jest.fn(() => Promise.resolve(task)),
  } as unknown as Repository<BookingTaskEntity>;
  const runs = {
    findOne: jest.fn(() => Promise.resolve(null)),
  } as unknown as Repository<BookingRunEntity>;
  const accounts = {
    findOwned: jest.fn(() => Promise.resolve(account)),
  };
  const serviceConnections = {
    ensureReady,
    listForAccount: jest.fn(() => Promise.resolve([])),
  };
  const captchaSolver = {
    isConfigured: jest.fn(() => true),
  };
  const service = new PlatformTasksService(
    tasks,
    runs,
    accounts as never,
    {} as never,
    { buildCandidates: jest.fn() } as never,
    serviceConnections as never,
    captchaSolver as never,
  );
  return { service, tasks, ensureReady, account, task };
}

describe('PlatformTasksService', () => {
  it('should save a task while the school service is unavailable', async () => {
    const { service, ensureReady } = makeHarness();

    await expect(
      service.create(7, {
        name: '早起座位',
        accountId: 4,
        venueType: 'study_room',
        building: '5号楼',
        roomName: '智能自习室',
        primarySeatId: '197',
        primarySeatLabel: '044',
        timeCandidates: [{ start: 480, end: 840 }],
      }),
    ).resolves.toEqual(expect.objectContaining({ id: '12', enabled: true }));
    expect(ensureReady).not.toHaveBeenCalled();
  });

  it('should toggle a task without requiring a live school connection', async () => {
    const { service, ensureReady, task } = makeHarness();

    await expect(service.toggle(7, 12, true)).resolves.toEqual(
      expect.objectContaining({ id: '12', enabled: true }),
    );
    expect(task.enabled).toBe(true);
    expect(ensureReady).not.toHaveBeenCalled();
  });
});
