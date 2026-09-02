import { describe, expect, it, jest } from '@jest/globals';
import { Repository } from 'typeorm';
import { BookingTaskEntity } from './entities/booking-task.entity';
import { BookingRunEntity } from './entities/booking-run.entity';
import { PlatformTasksService } from './platform-tasks.service';
import { PlatformRunsService } from './platform-runs.service';
import { PlatformNotificationsService } from './platform-notifications.service';
import { PlatformNotificationEntity } from './entities/platform-notification.entity';

describe('platform tenant isolation', () => {
  it('should scope task lookups to the current user', async () => {
    const findOne =
      jest.fn<(options: unknown) => Promise<BookingTaskEntity | null>>();
    findOne.mockResolvedValue(null);
    const service = new PlatformTasksService(
      { findOne } as unknown as Repository<BookingTaskEntity>,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.findOwned(21, 9)).rejects.toThrow('预约任务不存在');
    expect(findOne).toHaveBeenCalledWith({
      where: { id: 9, user: { id: 21 } },
      relations: ['user', 'schoolAccount'],
    });
  });

  it('should scope run lookups to the current user', async () => {
    const findOne =
      jest.fn<(options: unknown) => Promise<BookingRunEntity | null>>();
    findOne.mockResolvedValue(null);
    const service = new PlatformRunsService({
      findOne,
    } as unknown as Repository<BookingRunEntity>);

    await expect(service.findOwned(21, 9)).rejects.toThrow('运行记录不存在');
    expect(findOne).toHaveBeenCalledWith({
      where: { id: 9, user: { id: 21 } },
      relations: ['task', 'schoolAccount'],
    });
  });

  it('should scope notification updates to the current user', async () => {
    const findOne =
      jest.fn<
        (options: unknown) => Promise<PlatformNotificationEntity | null>
      >();
    findOne.mockResolvedValue(null);
    const service = new PlatformNotificationsService({
      findOne,
    } as unknown as Repository<PlatformNotificationEntity>);

    await expect(service.markRead(21, 9)).rejects.toThrow('通知不存在');
    expect(findOne).toHaveBeenCalledWith({
      where: { id: 9, user: { id: 21 } },
    });
  });
});
