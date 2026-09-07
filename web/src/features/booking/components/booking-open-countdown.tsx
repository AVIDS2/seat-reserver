'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const DAY_MS = 24 * 60 * 60 * 1000;
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

export function BookingOpenCountdown() {
  const [now, setNow] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();
  const countdown = useMemo(() => getCountdown(now), [now]);

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section
      aria-label='预约开放警报倒计时'
      className='relative min-w-0 flex-1 overflow-hidden rounded-lg border border-destructive/35 bg-foreground p-5 text-background sm:p-7'
    >
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 opacity-15 [background-image:repeating-linear-gradient(0deg,transparent_0,transparent_3px,rgba(255,255,255,0.11)_4px),repeating-linear-gradient(90deg,transparent_0,transparent_18px,rgba(255,255,255,0.04)_19px)]'
      />
      <div className='pointer-events-none absolute top-0 right-0 left-0 h-px bg-destructive/70' aria-hidden='true' />
      <div className='relative flex flex-col gap-6'>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div className='flex items-start gap-3'>
            <motion.span
              aria-hidden='true'
              animate={reduceMotion ? undefined : { opacity: [0.45, 1, 0.45] }}
              transition={reduceMotion ? undefined : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              className='mt-1 flex size-3 rounded-full bg-destructive shadow-[0_0_18px] shadow-destructive'
            />
            <div>
              <p className='text-xs font-semibold uppercase tracking-[0.2em] text-destructive'>
                Reservation alert
              </p>
              <h2 className='mt-1 text-lg font-semibold tracking-tight sm:text-xl'>预约窗口锁定</h2>
              <p className='mt-1 text-xs text-background/60'>系统会在开放时自动预热账号并提交任务</p>
            </div>
          </div>
          <Badge className='border-destructive/45 bg-destructive/10 text-destructive'>
            每天 06:00 开放
          </Badge>
        </div>

        <div className='grid gap-6 lg:grid-cols-[0.7fr_1.3fr] lg:items-end'>
          <div className='border-l-2 border-destructive/70 pl-4'>
            <p className='text-[11px] font-medium uppercase tracking-[0.22em] text-background/45'>
              Open window
            </p>
            <p className='mt-2 font-mono text-4xl font-bold tracking-tight text-destructive'>06:00</p>
            <p className='mt-2 max-w-xs text-xs leading-5 text-background/60'>
              开放后进入任务执行阶段，所有候选策略按顺序尝试。
            </p>
          </div>

          <div
            className='flex min-w-0 items-end justify-start gap-1 sm:gap-2 lg:justify-end'
            role='timer'
            aria-live='polite'
            aria-label={`距离下一次预约开放还有 ${countdown.text}`}
          >
            <TimeBlock value={countdown.hours} label='时' reduceMotion={reduceMotion} />
            <Separator />
            <TimeBlock value={countdown.minutes} label='分' reduceMotion={reduceMotion} />
            <Separator />
            <TimeBlock value={countdown.seconds} label='秒' reduceMotion={reduceMotion} />
          </div>
        </div>

        <div className='flex flex-col gap-3'>
          <div className='flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] text-background/45'>
            <span>System standby</span>
            <span>{countdown.progress.toFixed(0)}%</span>
          </div>
          <Progress
            value={countdown.progress}
            aria-label='当天距离预约开放的时间进度'
            className='h-1 [&_[data-slot=progress-track]]:bg-background/15 [&_[data-slot=progress-indicator]]:bg-destructive'
          />
          <div className='flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-background/55'>
            <span className='flex items-center gap-1.5'><Icons.refresh /> Token 预热</span>
            <span className='flex items-center gap-1.5'><Icons.target /> 候选座位</span>
            <span className='flex items-center gap-1.5'><Icons.clock /> 自动提交</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function TimeBlock({
  value,
  label,
  reduceMotion
}: {
  value: string;
  label: string;
  reduceMotion: boolean | null;
}) {
  return (
    <div className='flex min-w-0 flex-col items-center gap-1'>
      <div className='relative min-w-[4.25rem] overflow-hidden rounded-md border border-background/15 bg-background/10 px-2 py-3 text-center sm:min-w-[6.2rem] sm:px-3 sm:py-4'>
        <span className='pointer-events-none absolute top-1/2 right-0 left-0 h-px bg-destructive/30' aria-hidden='true' />
        <motion.span
          key={value}
          initial={reduceMotion ? false : { opacity: 0.3, y: 6, filter: 'blur(3px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className='relative block font-mono text-5xl leading-none font-semibold tabular-nums text-destructive sm:text-7xl'
        >
          {value}
        </motion.span>
      </div>
      <span className='text-[10px] uppercase tracking-[0.18em] text-background/45'>{label}</span>
    </div>
  );
}

function Separator() {
  return <span className='pb-6 font-mono text-2xl text-destructive/70 sm:pb-8 sm:text-3xl'>:</span>;
}

type Countdown = {
  hours: string;
  minutes: string;
  seconds: string;
  text: string;
  progress: number;
};

function getCountdown(now: number | null): Countdown {
  if (now === null) {
    return { hours: '--', minutes: '--', seconds: '--', text: '--:--:--', progress: 0 };
  }

  const shanghai = new Date(now + SHANGHAI_OFFSET_MS);
  let target =
    Date.UTC(shanghai.getUTCFullYear(), shanghai.getUTCMonth(), shanghai.getUTCDate(), 6) -
    SHANGHAI_OFFSET_MS;
  if (target <= now) target += DAY_MS;

  const remaining = Math.max(0, target - now);
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  const values = [hours, minutes, seconds].map((value) => String(value).padStart(2, '0'));

  return {
    hours: values[0],
    minutes: values[1],
    seconds: values[2],
    text: values.join(':'),
    progress: ((DAY_MS - remaining) / DAY_MS) * 100
  };
}
