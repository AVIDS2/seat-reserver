import { cookies } from 'next/headers';

import type { FocusRoomsSnapshot } from '@/features/focus/types';
import type { BookingSnapshot } from '@/features/booking/types';
import type { RewardsSnapshot } from '@/features/booking/api/service';

const baseUrl = process.env.INTERNAL_API_URL || 'http://api:3001/api/v1';

export type AssistantContext = {
  generatedAt: string;
  booking: {
    executionDate: string;
    enabledTasks: number;
    totalTasks: number;
    connectedAccounts: number;
    totalAccounts: number;
    successRate: number | null;
    tasks: Array<{
      name: string;
      venue: string;
      location: string;
      time: string;
      schedule: string;
      status: string;
      nextRun: string;
      lastMessage: string;
    }>;
    recentRuns: Array<{
      account: string;
      targetDate: string;
      status: string;
      result: string;
    }>;
  };
  focus: {
    joinedRooms: Array<{
      name: string;
      phase: string;
      timerStatus: string;
      remainingSeconds: number;
      memberCount: number;
      completedRounds: number;
    }>;
  };
  rewards: {
    pointsBalance: number;
    membership: string;
    checkInPoints: number;
    availableActivities: string[];
  };
};

const EMPTY_CONTEXT: AssistantContext = {
  generatedAt: new Date(0).toISOString(),
  booking: {
    executionDate: '',
    enabledTasks: 0,
    totalTasks: 0,
    connectedAccounts: 0,
    totalAccounts: 0,
    successRate: null,
    tasks: [],
    recentRuns: []
  },
  focus: { joinedRooms: [] },
  rewards: {
    pointsBalance: 0,
    membership: '普通用户',
    checkInPoints: 30,
    availableActivities: []
  }
};

export async function getAssistantContextServer(): Promise<AssistantContext> {
  const cookieHeader = (await cookies()).toString();
  const [booking, focus, rewards] = await Promise.all([
    platformServerRequest<BookingSnapshot>('/platform/dashboard', cookieHeader).catch(() => null),
    platformServerRequest<FocusRoomsSnapshot>('/platform/focus-rooms', cookieHeader).catch(
      () => null
    ),
    platformServerRequest<RewardsSnapshot>('/platform/rewards', cookieHeader).catch(() => null)
  ]);

  return {
    generatedAt: new Date().toISOString(),
    booking: booking ? toBookingContext(booking) : EMPTY_CONTEXT.booking,
    focus: focus ? toFocusContext(focus) : EMPTY_CONTEXT.focus,
    rewards: rewards ? toRewardsContext(rewards) : EMPTY_CONTEXT.rewards
  };
}

function toBookingContext(booking: BookingSnapshot): AssistantContext['booking'] {
  return {
    executionDate: booking.summary.executionDate,
    enabledTasks: booking.summary.enabledTasks,
    totalTasks: booking.summary.totalTasks,
    connectedAccounts: booking.summary.connectedAccounts,
    totalAccounts: booking.summary.totalAccounts,
    successRate: booking.summary.successRate,
    tasks: booking.tasks.slice(0, 8).map((task) => ({
      name: task.name,
      venue: task.venueType === 'library' ? '图书馆' : '自习室',
      location: [task.building, task.roomName].filter(Boolean).join(' · '),
      time: task.time,
      schedule: scheduleLabel(task.scheduleMode, task.scheduleWeekdays),
      status: task.status,
      nextRun: task.nextRun,
      lastMessage: task.lastMessage
    })),
    recentRuns: booking.runs.slice(0, 6).map((run) => ({
      account: run.account,
      targetDate: run.targetDate,
      status: run.statusLabel,
      result: run.result
    }))
  };
}

function toFocusContext(focus: FocusRoomsSnapshot): AssistantContext['focus'] {
  return {
    joinedRooms: focus.rooms
      .filter((room) => room.isMember)
      .slice(0, 6)
      .map((room) => ({
        name: room.name,
        phase: phaseLabel(room.phase),
        timerStatus: timerLabel(room.timerStatus),
        remainingSeconds: room.remainingSeconds,
        memberCount: room.memberCount,
        completedRounds: room.completedRounds
      }))
  };
}

function toRewardsContext(rewards: RewardsSnapshot): AssistantContext['rewards'] {
  return {
    pointsBalance: rewards.pointsBalance,
    membership: rewards.membership.planLabel,
    checkInPoints: rewards.dailyActivityPoints,
    availableActivities: rewards.activities
      .filter((activity) => activity.status === 'available')
      .slice(0, 6)
      .map((activity) => `${activity.title}（+${activity.points} 席定币）`)
  };
}

async function platformServerRequest<T>(path: string, cookieHeader: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store'
  });

  if (!response.ok) throw new Error(`平台数据加载失败（${response.status}）`);
  return response.json() as Promise<T>;
}

function scheduleLabel(mode: string, weekdays: number[]): string {
  if (mode === 'daily') return '每天';
  if (mode === 'weekdays') return '工作日';
  if (mode === 'weekly') return weekdays.length ? `每周${weekdays.join('、')}` : '每周';
  if (mode === 'dates') return '指定日期';
  return '单次';
}

function phaseLabel(phase: string): string {
  if (phase === 'short_break') return '短休息';
  if (phase === 'long_break') return '长休息';
  return '专注时间';
}

function timerLabel(status: string): string {
  if (status === 'running') return '进行中';
  if (status === 'paused') return '已暂停';
  return '等待开始';
}

export function emptyAssistantContext(): AssistantContext {
  return EMPTY_CONTEXT;
}
