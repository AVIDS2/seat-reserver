'use client';

import Link from 'next/link';
import { motion } from 'motion/react';

import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { AssistantChatPanel } from '@/features/ai-chat/components/assistant-chat-panel';
import { StarryPanel } from '@/components/ui/starry-panel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import type { AssistantContext } from '../api/server-context';

export default function AiNavigatorPage({
  initialContext,
  aiConfigured
}: {
  initialContext: AssistantContext;
  aiConfigured: boolean;
}) {
  return (
    <PageContainer pageTitle='席定领航' pageDescription='预约、专注、复盘，一页完成。'>
      <div className='mx-auto flex w-full max-w-[1280px] flex-col gap-5 overscroll-auto sm:gap-6'>
        <StarryPanel contentClassName='p-5 sm:p-7'>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className='grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end'
          >
            <div className='max-w-2xl'>
              <Badge className='border-white/15 bg-white/10 text-white'>
                <Icons.sparkles data-icon='inline-start' />
                SEAT NAVIGATOR
              </Badge>
              <h1 className='mt-4 text-2xl font-semibold tracking-tight sm:text-4xl'>
                今天，先专注一段。
              </h1>
              <p className='mt-3 max-w-xl text-sm leading-6 text-white/65 sm:text-base'>
                把目标、预约和专注记录放在一起，随时继续。
              </p>
            </div>
            <div className='grid grid-cols-3 gap-2 sm:min-w-[320px] sm:gap-3'>
              <NavigatorStat label='启用任务' value={initialContext.booking.enabledTasks} />
              <NavigatorStat label='专注房间' value={initialContext.focus.joinedRooms.length} />
              <NavigatorStat label='席定币' value={initialContext.rewards.pointsBalance} />
            </div>
          </motion.div>
        </StarryPanel>

        {!aiConfigured && (
          <Alert>
            <Icons.info />
            <AlertTitle>AI 暂不可用</AlertTitle>
            <AlertDescription>请联系管理员。</AlertDescription>
          </Alert>
        )}

        <div className='grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)]'>
          <AssistantChatPanel />
          <NavigatorContext context={initialContext} />
        </div>
      </div>
    </PageContainer>
  );
}

function NavigatorStat({ label, value }: { label: string; value: number }) {
  return (
    <div className='rounded-lg border border-white/10 bg-white/10 p-3'>
      <p className='text-xs text-white/55'>{label}</p>
      <p className='mt-2 text-2xl font-semibold tabular-nums'>{value}</p>
    </div>
  );
}

function NavigatorContext({ context }: { context: AssistantContext }) {
  const nextTask = context.booking.tasks.find((task) => task.status === 'enabled');
  const activeRoom = context.focus.joinedRooms.find((room) => room.timerStatus === '进行中');

  return (
    <div className='flex min-w-0 flex-col gap-5'>
      <Card className='shadow-none'>
        <CardHeader className='border-b'>
          <CardDescription>今日节奏</CardDescription>
          <CardTitle>接下来做什么</CardTitle>
          <CardAction>
            <Badge variant='outline'>{context.booking.executionDate || '未同步日期'}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className='grid gap-3 pt-5 sm:grid-cols-2 xl:grid-cols-1'>
          <ContextMetric
            icon={Icons.target}
            label='下一条预约任务'
            value={nextTask?.name || '还没有启用任务'}
            detail={nextTask ? `${nextTask.venue} · ${nextTask.time}` : '去预约任务里创建一条'}
          />
          <ContextMetric
            icon={Icons.clock}
            label='正在专注的房间'
            value={activeRoom?.name || '当前没有进行中的房间'}
            detail={
              activeRoom
                ? `${activeRoom.phase} · ${formatSeconds(activeRoom.remainingSeconds)} 后更新`
                : '去席定自习室找个房间'
            }
          />
          <ContextMetric
            icon={Icons.flame}
            label='席定币'
            value={`${context.rewards.pointsBalance}`}
            detail={`${context.rewards.membership} · 每日签到 +${context.rewards.checkInPoints}`}
          />
        </CardContent>
        <CardFooter className='gap-2'>
          <Link
            href='/dashboard/focus'
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            去自习室 <Icons.arrowRight data-icon='inline-end' />
          </Link>
          <Link
            href='/dashboard/tasks'
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          >
            管理任务
          </Link>
        </CardFooter>
      </Card>

      <Card className='shadow-none'>
        <CardHeader>
          <CardDescription>席定领航</CardDescription>
          <CardTitle>常用入口</CardTitle>
        </CardHeader>
        <CardContent className='flex flex-col gap-3'>
          <NavigatorFeature icon={Icons.target} title='专注主持' body='定目标，开始专注。' />
          <NavigatorFeature icon={Icons.calendar} title='学习计划' body='拆分目标，安排时段。' />
          <NavigatorFeature icon={Icons.mapPin} title='空间建议' body='按时间和偏好选空间。' />
          <NavigatorFeature icon={Icons.trendingUp} title='节奏洞察' body='查看预约和专注变化。' />
        </CardContent>
      </Card>
    </div>
  );
}

function ContextMetric({
  icon: Icon,
  label,
  value,
  detail
}: {
  icon: typeof Icons.sparkles;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className='flex min-w-0 gap-3 rounded-lg border p-3'>
      <div className='bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg'>
        <Icon />
      </div>
      <div className='min-w-0'>
        <p className='text-muted-foreground text-xs'>{label}</p>
        <p className='mt-1 truncate text-sm font-medium'>{value}</p>
        <p className='text-muted-foreground mt-1 truncate text-xs'>{detail}</p>
      </div>
    </div>
  );
}

function NavigatorFeature({
  icon: Icon,
  title,
  body
}: {
  icon: typeof Icons.sparkles;
  title: string;
  body: string;
}) {
  return (
    <div className='flex gap-3'>
      <div className='bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg'>
        <Icon />
      </div>
      <div className='min-w-0'>
        <p className='text-sm font-medium'>{title}</p>
        <p className='text-muted-foreground mt-1 text-sm leading-5'>{body}</p>
      </div>
    </div>
  );
}

function formatSeconds(seconds: number): string {
  const minutes = Math.max(0, Math.floor(seconds / 60));
  const rest = Math.max(0, seconds) % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}
