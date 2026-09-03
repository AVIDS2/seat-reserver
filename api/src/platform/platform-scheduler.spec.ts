import { describe, expect, it } from '@jest/globals';
import { isTaskDue } from './platform-scheduler';
import { BookingTaskEntity } from './entities/booking-task.entity';

function task(
  scheduleMode: BookingTaskEntity['scheduleMode'],
  scheduleWeekdays = [1, 2, 3, 4, 5],
  targetDate: string | null = null,
) {
  return { scheduleMode, scheduleWeekdays, targetDate } as BookingTaskEntity;
}

describe('isTaskDue', () => {
  it('should run daily tasks every day', () => {
    expect(isTaskDue(task('daily'), '2026-09-06')).toBe(true);
  });

  it('should run weekdays only from Monday through Friday', () => {
    expect(isTaskDue(task('weekdays'), '2026-09-04')).toBe(true);
    expect(isTaskDue(task('weekdays'), '2026-09-05')).toBe(false);
  });

  it('should run custom weekly tasks on configured weekdays', () => {
    expect(isTaskDue(task('weekly', [0, 6]), '2026-09-05')).toBe(true);
    expect(isTaskDue(task('weekly', [0, 6]), '2026-09-03')).toBe(false);
  });

  it('should run one-time tasks only on their target date', () => {
    expect(isTaskDue(task('once', [], '2026-09-04'), '2026-09-04')).toBe(true);
    expect(isTaskDue(task('once', [], '2026-09-04'), '2026-09-05')).toBe(false);
  });
});
