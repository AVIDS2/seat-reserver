'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { useState } from 'react';
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
import { cn } from '@/lib/utils';

import type { BookingSnapshot, BookingTask } from '../types';
import { getClientSnapshot, isDemoMode, runBookingTask } from '../api/service';
import { MetricCard } from './metric-card';
import { RunStatusBadge, TaskStatusBadge } from './status-badge';

async function runTask(task: BookingTask) {
  try {
    await runBookingTask(task.id);
    toast.success(`${task.name} 已加入执行队列`, {
      description: isDemoMode() ? '演示模式不会向真实预约接口发送请求。' : 'Worker 将在后台执行预约。'
    });
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '运行任务失败');
  }
}

function TaskRow({ task }: { task: BookingTask }) {
  return (
    <div className='group flex flex-col gap-3 border-b py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between'>
      <div className='flex min-w-0 items-start gap-3'>
        <div className='bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg'>
          <Icons.target className='size-4' />
        </div>
        <div className='min-w-0'>
          <div className='flex flex-wrap items-center gap-2'>
            <p className='truncate text-sm font-medium'>{task.name}</p>
            <TaskStatusBadge status={task.status} />
          </div>
          <p className='text-muted-foreground mt-1 text-xs'>
            {task.account} · {task.seat} · {task.time}
          </p>
        </div>
      </div>
      <div className='flex items-center justify-between gap-3 pl-12 sm:justify-end sm:pl-0'>
        <div className='text-left sm:text-right'>
          <p className='text-xs font-medium'>{task.nextRun}</p>
          <p className='text-muted-foreground mt-1 text-[11px]'>{task.lastMessage}</p>
        </div>
        <Button
          variant='outline'
          size='icon-sm'
          aria-label={`立即运行${task.name}`}
          onClick={() => runTask(task)}
        >
          <Icons.play />
        </Button>
      </div>
    </div>
  );
}

export default function BookingDashboard({ initialData }: { initialData: BookingSnapshot }) {
  const [snapshot, setSnapshot] = useState(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshData = () => {
    setIsRefreshing(true);
    void getClientSnapshot()
      .then((nextSnapshot) => {
        setSnapshot(nextSnapshot);
        toast.success('状态已刷新', { description: '所有账号和任务都已完成检查。' });
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : '刷新状态失败'))
      .finally(() => setIsRefreshing(false));
  };

  return (
    <PageContainer>
      <div className='mx-auto w-full max-w-[1440px] space-y-6'>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className='flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between'
        >
          <div>
            <p className='text-muted-foreground mb-2 text-sm'>星期一，2026 年 8 月 31 日</p>
            <h1 className='text-2xl font-semibold tracking-tight sm:text-3xl'>
              早上好，准备好下一次预约了吗？
            </h1>
            <p className='text-muted-foreground mt-2 max-w-2xl text-sm leading-6'>
              你的两个任务都已排程。系统会在开放时间自动预热账号，并按候选策略完成预约。
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <Button variant='outline' onClick={refreshData} disabled={isRefreshing}>
              <Icons.refresh className={cn(isRefreshing && 'animate-spin')} />
              {isRefreshing ? '刷新中' : '刷新状态'}
            </Button>
            <Link href='/dashboard/tasks' className={buttonVariants()} aria-label='新建预约任务'>
              <Icons.add />
              新建任务
            </Link>
          </div>
        </motion.div>

        <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
          <MetricCard
            label='已启用任务'
            value='2'
            detail='全部将在明早自动执行'
            icon={Icons.target}
            accent='success'
          />
          <MetricCard label='下次执行' value='06:00' detail='明天 · 北京时间' icon={Icons.clock} />
          <MetricCard
            label='近 7 日成功率'
            value='86%'
            detail='较上周提升 12%'
            icon={Icons.trendingUp}
            accent='success'
          />
          <MetricCard
            label='账号状态'
            value='2 / 2'
            detail='Token 均已验证'
            icon={Icons.shield}
            accent='success'
          />
        </div>

        <div className='grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]'>
          <Card className='shadow-none'>
            <CardHeader className='border-b'>
              <CardDescription>下一次执行</CardDescription>
              <CardTitle className='text-xl'>明早的预约窗口</CardTitle>
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
                <div>
                  <div className='text-5xl font-semibold tracking-[-0.06em] tabular-nums'>
                    06:00
                  </div>
                  <p className='text-muted-foreground mt-2 text-sm'>北京时间 · 自动执行</p>
                </div>
                <div className='grid grid-cols-2 gap-x-8 gap-y-3 text-sm'>
                  <div>
                    <p className='text-muted-foreground text-xs'>预热时间</p>
                    <p className='mt-1 font-medium tabular-nums'>05:59:50</p>
                  </div>
                  <div>
                    <p className='text-muted-foreground text-xs'>执行窗口</p>
                    <p className='mt-1 font-medium tabular-nums'>20 秒</p>
                  </div>
                  <div>
                    <p className='text-muted-foreground text-xs'>执行任务</p>
                    <p className='mt-1 font-medium'>2 个</p>
                  </div>
                  <div>
                    <p className='text-muted-foreground text-xs'>候选策略</p>
                    <p className='mt-1 font-medium'>6 组</p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className='justify-between gap-4'>
              <p className='text-muted-foreground text-xs'>最后检查：今天 05:59:52</p>
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
                  className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
                  aria-label='查看全部运行记录'
                >
                  <Icons.arrowRight />
                </Link>
              </CardAction>
            </CardHeader>
            <CardContent className='divide-border divide-y pt-1'>
              {snapshot.runs.slice(0, 3).map((run) => (
                <div key={run.id} className='flex items-center justify-between gap-3 py-3.5'>
                  <div className='min-w-0'>
                    <p className='truncate text-sm font-medium'>{run.account}</p>
                    <p className='text-muted-foreground mt-1 truncate text-xs'>
                      {run.targetDate} · {run.attempts} 次尝试
                    </p>
                  </div>
                  <RunStatusBadge status={run.status} />
                </div>
              ))}
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
          <CardContent className='pt-1'>
            {snapshot.tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
