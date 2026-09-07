import { describe, expect, it, jest } from '@jest/globals';
import { PlatformAttendanceService } from './platform-attendance.service';

describe('PlatformAttendanceService', () => {
  it('should return a safe disabled default when no preference has been saved', async () => {
    const settings = { findOne: jest.fn(() => Promise.resolve(null)) };
    const service = new PlatformAttendanceService(
      settings as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.getSettings(7)).resolves.toEqual({
      autoCancelNoShow: false,
      checkInAheadMinutes: 30,
      lateAllowedMinutes: 15,
      cancelLeadMinutes: 1,
    });
  });

  it('should cancel an un-checked-in study-room reservation one minute before the late limit', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-07T06:14:30+08:00'));

    const setting = {
      userId: 7,
      autoCancelNoShow: true,
      graceMinutes: 15,
      leadMinutes: 1,
    };
    const settings = { find: jest.fn(() => Promise.resolve([setting])) };
    const accounts = {
      find: jest.fn(() => Promise.resolve([{ id: 4, status: 'active' }])),
    };
    const reservation = {
      id: '735563',
      accountId: '4',
      date: '2026-09-07',
      startTime: '06:00',
      endTime: '08:00',
      status: 'upcoming',
      checkedIn: false,
      canCancel: true,
      location: '5号楼智能自习室044号',
    };
    const reservations = {
      list: jest.fn(() => Promise.resolve([reservation])),
      cancel: jest.fn((...args: unknown[]) => {
        void args;
        return Promise.resolve({ ...reservation, status: 'cancelled' });
      }),
    };
    const notifications = {
      create: jest.fn((...args: unknown[]) => {
        void args;
        return Promise.resolve({});
      }),
    };
    const redis = {
      tryLock: jest.fn(() => Promise.resolve('lock-value')),
      unlock: jest.fn(() => Promise.resolve()),
    };
    const service = new PlatformAttendanceService(
      settings as never,
      accounts as never,
      reservations as never,
      notifications as never,
      redis as never,
    );

    await service.monitorDueReservations();

    expect(reservations.cancel).toHaveBeenCalledWith(
      7,
      4,
      'study_room',
      '735563',
    );
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        kind: 'attendance_protection',
        actionUrl: '/dashboard/reservations',
      }),
    );
    expect(redis.unlock).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('should not cancel an already checked-in or active reservation', async () => {
    const settings = {
      find: jest.fn(() =>
        Promise.resolve([
          {
            userId: 7,
            autoCancelNoShow: true,
            graceMinutes: 15,
            leadMinutes: 1,
          },
        ]),
      ),
    };
    const accounts = {
      find: jest.fn(() => Promise.resolve([{ id: 4, status: 'active' }])),
    };
    const reservations = {
      list: jest.fn(() =>
        Promise.resolve([
          {
            id: 'checked-in',
            accountId: '4',
            date: '2026-09-07',
            startTime: '00:00',
            endTime: '02:00',
            status: 'active',
            checkedIn: true,
            canCancel: true,
            location: '座位',
          },
        ]),
      ),
      cancel: jest.fn((...args: unknown[]) => {
        void args;
        return undefined;
      }),
    };
    const service = new PlatformAttendanceService(
      settings as never,
      accounts as never,
      reservations as never,
      {} as never,
      {} as never,
    );

    await service.monitorDueReservations();

    expect(reservations.cancel).not.toHaveBeenCalled();
  });
});
