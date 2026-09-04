'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import PageContainer from '@/components/layout/page-container';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle
} from '@/components/ui/item';
import { cn } from '@/lib/utils';

import type { BookingSnapshot, BookingTask } from '../types';
import { getClientSnapshot, runBookingTask } from '../api/service';
import { MetricCard } from './metric-card';
import { BookingOpenCountdown } from './booking-open-countdown';
import { RunStatusBadge, TaskStatusBadge } from './status-badge';

async function runTask(task: BookingTask) {
  try {
    await runBookingTask(task.id);
    toast.success(`${task.name} 已开始执行`, {
      description: '系统正在按你设置的座位和时间尝试预约，结果会显示在运行记录中。'
    });
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '运行任务失败');
  }
}

function TaskRow({ task }: { task: BookingTask }) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <Item variant='outline' className='items-start sm:items-center'>
        <ItemMedia variant='icon' className='bg-muted size-9 rounded-lg'>
          <Icons.target className='size-4' />
        </ItemMedia>
        <ItemContent className='min-w-0'>
          <ItemTitle className='max-w-full'>
            <span className='truncate'>{task.name}</span>
            <TaskStatusBadge status={task.status} />
          </ItemTitle>
          <ItemDescription>
            {task.account} · {task.seat} · {task.time}
          </ItemDescription>
          <ItemDescription>
            {formatLocation(task.building, task.venueType, task.roomName)}
          </ItemDescription>
        </ItemContent>
        <ItemActions className='ml-auto min-w-0 items-center'>
          <div className='min-w-0 text-right'>
            <p className='text-xs font-medium'>{task.nextRun}</p>
            <p className='text-muted-foreground mt-1 line-clamp-1 text-[11px]'>
              {task.lastMessage}
            </p>
          </div>
          <Button
            variant='outline'
            size='icon-sm'
            aria-label={`立即运行${task.name}`}
            onClick={() => runTask(task)}
          >
            <Icons.play />
          </Button>
        </ItemActions>
      </Item>
    </motion.div>
  );
}

export default function BookingDashboard({ initialData }: { initialData: BookingSnapshot }) {
  const [snapshot, setSnapshot] = useState(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const summary = snapshot.summary;

  useEffect(() => {
    let active = true;
    const poll = () => {
      void getClientSnapshot()
        .then((nextSnapshot) => {
          if (active) setSnapshot(nextSnapshot);
        })
        .catch(() => undefined);
    };
    const interval = window.setInterval(poll, 30_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const refreshData = () => {
    setIsRefreshing(true);
    void getClientSnapshot()
      .then((nextSnapshot) => {
        setSnapshot(nextSnapshot);
        toast.success('状态已刷新', {
          description: '所有账号和任务都已完成检查。'
        });
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : '刷新状态失败'))
      .finally(() => setIsRefreshing(false));
  };

  return (
    <PageContainer>
      <div className='mx-auto flex w-full max-w-[1440px] flex-col gap-5 sm:gap-6'>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className='flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between'
        >
          <div>
            <p className='text-muted-foreground mb-2 text-sm'>
              {formatDateLabel(summary.executionDate)}
            </p>
            <h1 className='text-2xl font-semibold tracking-tight sm:text-3xl'>
              早上好，准备好下一次预约了吗？
            </h1>
            <p className='text-muted-foreground mt-2 max-w-2xl text-sm leading-6'>
              {summary.enabledTasks > 0
                ? `你的 ${summary.enabledTasks} 个启用任务已排程。系统会在开放时间自动预热账号，并按候选策略完成预约。`
                : '还没有启用任务，先去配置一条自动预约策略。'}
            </p>
          </div>
          <div className='grid grid-cols-2 gap-2 sm:flex'>
            <Button
              className='w-full sm:w-auto'
              variant='outline'
              onClick={refreshData}
              disabled={isRefreshing}
            >
              <Icons.refresh className={cn(isRefreshing && 'animate-spin')} />
              {isRefreshing ? '刷新中' : '刷新状态'}
            </Button>
            <Link
              href='/dashboard/tasks'
              className={cn(buttonVariants(), 'w-full sm:w-auto')}
              aria-label='新建预约任务'
            >
              <Icons.add />
              新建任务
            </Link>
          </div>
        </motion.div>

        <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
          <MetricCard
            label='已启用任务'
            value={String(summary.enabledTasks)}
            detail={summary.enabledTasks ? '将在下一次开放窗口自动执行' : '暂无启用任务'}
            icon={Icons.target}
            accent='success'
          />
          <MetricCard
            label='下次执行'
            value={summary.executionTime}
            detail='学校开放后自动提交'
            icon={Icons.clock}
          />
          <MetricCard
            label='近 7 日成功率'
            value={summary.successRate === null ? '暂无' : `${summary.successRate}%`}
            detail='近 7 日预约完成率'
            icon={Icons.trendingUp}
            accent='success'
          />
          <MetricCard
            label='账号状态'
            value={`${summary.connectedAccounts} / ${summary.totalAccounts}`}
            detail={summary.totalAccounts ? '连接正常 / 总账号' : '尚未接入学校账号'}
            icon={Icons.shield}
            accent='success'
          />
        </div>

        <div className='grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]'>
          <Card className='shadow-none'>
            <CardHeader className='border-b'>
              <CardDescription>下一次执行</CardDescription>
              <CardTitle className='text-xl'>下一次预约窗口</CardTitle>
              <CardAction>
                <Badge
                  variant='outline'
                  className='border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400'
                >
                  <Icons.clock />
                  已排程
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className='pt-5'>
              <div className='flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between'>
                <BookingOpenCountdown />
                <div className='grid grid-cols-2 gap-x-8 gap-y-3 text-sm'>
                  <div>
                    <p className='text-muted-foreground text-xs'>准备阶段</p>
                    <p className='mt-1 font-medium'>{summary.prewarmTime}</p>
                  </div>
                  <div>
                    <p className='text-muted-foreground text-xs'>执行窗口</p>
                    <p className='mt-1 font-medium tabular-nums'>
                      {summary.bookingWindowSeconds || '-'} 秒
                    </p>
                  </div>
                  <div>
                    <p className='text-muted-foreground text-xs'>执行任务</p>
                    <p className='mt-1 font-medium'>{summary.enabledTasks} 个</p>
                  </div>
                  <div>
                    <p className='text-muted-foreground text-xs'>候选策略</p>
                    <p className='mt-1 font-medium'>{summary.candidateGroups} 组</p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className='justify-between gap-4'>
              <p className='text-muted-foreground text-xs'>
                最后检查：{formatDateTime(summary.lastCheckedAt)}
              </p>
              <Link
                href='/dashboard/tasks'
                className={buttonVariants({ variant: 'ghost', size: 'sm' })}
              >
                管理任务
                <Icons.arrowRight />
              </Link>
            </CardFooter>
          </Card>

          <Card className='shadow-none'>
            <CardHeader className='border-b'>
              <CardDescription>最近一次运行</CardDescription>
              <CardTitle className='text-xl'>运行状态</CardTitle>
              <CardAction>
                <Link
                  href='/dashboard/runs'
                  className={buttonVariants({
                    variant: 'ghost',
                    size: 'icon-sm'
                  })}
                  aria-label='查看全部运行记录'
                >
                  <Icons.arrowRight />
                </Link>
              </CardAction>
            </CardHeader>
            <CardContent>
              <ItemGroup className='gap-2'>
                {snapshot.runs.slice(0, 3).map((run) => (
                  <Item key={run.id} variant='outline' size='sm'>
                    <ItemContent className='min-w-0'>
                      <ItemTitle>{run.account}</ItemTitle>
                      <ItemDescription>
                        {run.targetDate} · 已尝试 {run.attempts} 次
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <RunStatusBadge status={run.status} />
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            </CardContent>
          </Card>
        </div>

        <Card className='shadow-none'>
          <CardHeader className='border-b'>
            <CardDescription>自动化任务</CardDescription>
            <CardTitle className='text-xl'>预约任务</CardTitle>
            <CardAction>
              <Link
                href='/dashboard/tasks'
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
                aria-label='查看全部预约任务'
              >
                查看全部
                <Icons.arrowRight />
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ItemGroup className='gap-2'>
              {snapshot.tasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </ItemGroup>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

function formatDateLabel(value: string): string {
  return new Date(`${value}T00:00:00+08:00`).toLocaleDateString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    weekday: 'long',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

function formatLocation(
  building: string,
  venueType: BookingTask['venueType'],
  roomName: string
): string {
  const venue = { library: '图书馆', study_room: '自习室', other: '其他' }[venueType];
  return (
    [building, venue, roomName].filter((value) => value && value !== '未指定').join(' · ') ||
    '位置未设置'
  );
}
