import type { BookingSnapshot } from './types';

export const bookingSnapshot: BookingSnapshot = {
  tasks: [
    {
      id: 'task-main-44',
      name: '44 号优先',
      account: '我的账号',
      accountId: 'account-main',
      seat: '44 号',
      seatId: '197',
      time: '14:00 - 22:00',
      nextRun: '明天 06:00:01',
      status: 'enabled',
      enabled: true,
      backupSeatIds: ['211'],
      timeCandidates: [{ start: 840, end: 1320 }, { start: 780, end: 1260 }, { start: 900, end: 1320 }],
      maxAttempts: 12,
      attemptDelaySeconds: 1.2,
      bookingWindowSeconds: 20,
      prewarmOffsetSeconds: 0,
      runOffsetSeconds: 1,
      lastRun: '今天 06:00',
      lastMessage: '已完成 9 次尝试，窗口结束'
    },
    {
      id: 'task-friend-199',
      name: '固定座位',
      account: '朋友账号',
      accountId: 'account-friend',
      seat: '199 号',
      seatId: '199',
      time: '14:00 - 22:00',
      nextRun: '明天 06:00:02',
      status: 'enabled',
      enabled: true,
      backupSeatIds: [],
      timeCandidates: [{ start: 840, end: 1320 }],
      maxAttempts: 7,
      attemptDelaySeconds: 1.2,
      bookingWindowSeconds: 20,
      prewarmOffsetSeconds: 1,
      runOffsetSeconds: 2,
      lastRun: '今天 06:00',
      lastMessage: '已完成 7 次尝试，窗口结束'
    },
    {
      id: 'task-evening',
      name: '晚间备选',
      account: '我的账号',
      accountId: 'account-main',
      seat: '60 号',
      seatId: '211',
      time: '18:00 - 22:00',
      nextRun: '已暂停',
      status: 'paused',
      enabled: false,
      backupSeatIds: [],
      timeCandidates: [{ start: 1080, end: 1320 }],
      maxAttempts: 6,
      attemptDelaySeconds: 1.2,
      bookingWindowSeconds: 20,
      prewarmOffsetSeconds: 0,
      runOffsetSeconds: 1,
      lastRun: '昨天 06:00',
      lastMessage: '任务已暂停，不会参与明日执行'
    }
  ],
  accounts: [
    {
      id: 'account-main',
      label: '我的账号',
      username: '2300******131',
      status: 'connected',
      statusLabel: '连接正常',
      tokenLabel: 'Token 有效',
      refreshedAt: '今天 05:59:50',
      lastVerifiedAt: '今天 05:59:51',
      tasks: 2
    },
    {
      id: 'account-friend',
      label: '朋友账号',
      username: '2300******806',
      status: 'connected',
      statusLabel: '连接正常',
      tokenLabel: 'Token 有效',
      refreshedAt: '今天 05:59:51',
      lastVerifiedAt: '今天 05:59:52',
      tasks: 1
    }
  ],
  runs: [
    {
      id: 'run-20260831-main',
      account: '我的账号',
      task: '44 号优先',
      targetDate: '2026-08-31',
      startedAt: '今天 06:00:02',
      status: 'failed',
      statusLabel: '未抢到',
      attempts: 9,
      result: '窗口结束',
      detail: '所有候选请求均未成功，最后一次请求在 06:00:23 结束。'
    },
    {
      id: 'run-20260831-friend',
      account: '朋友账号',
      task: '固定座位',
      targetDate: '2026-08-31',
      startedAt: '今天 06:00:03',
      status: 'failed',
      statusLabel: '未抢到',
      attempts: 7,
      result: '窗口结束',
      detail: '所有候选请求均未成功，最后一次请求在 06:00:23 结束。'
    },
    {
      id: 'run-20260830-main',
      account: '我的账号',
      task: '44 号优先',
      targetDate: '2026-08-30',
      startedAt: '昨天 06:00:01',
      status: 'success',
      statusLabel: '预约成功',
      attempts: 1,
      result: '44 号 · 14:00 - 22:00',
      detail: '预约请求在第 1 次尝试成功。'
    },
    {
      id: 'run-20260829-main',
      account: '我的账号',
      task: '44 号优先',
      targetDate: '2026-08-29',
      startedAt: '2026-08-29 06:00:01',
      status: 'success',
      statusLabel: '预约成功',
      attempts: 2,
      result: '44 号 · 14:00 - 22:00',
      detail: '第 2 次尝试完成预约。'
    },
    {
      id: 'run-20260828-main',
      account: '我的账号',
      task: '44 号优先',
      targetDate: '2026-08-28',
      startedAt: '2026-08-28 06:00:01',
      status: 'success',
      statusLabel: '预约成功',
      attempts: 1,
      result: '60 号 · 13:00 - 21:00',
      detail: '主座位无余量后，使用备选座位完成预约。'
    }
  ],
  summary: {
    enabledTasks: 2,
    totalTasks: 3,
    totalAccounts: 2,
    connectedAccounts: 2,
    successRate: 86,
    candidateGroups: 10,
    prewarmTime: '05:59:50',
    executionTime: '06:00:00',
    bookingWindowSeconds: 20,
    executionDate: '2026-08-31',
    lastCheckedAt: new Date().toISOString()
  }
};
