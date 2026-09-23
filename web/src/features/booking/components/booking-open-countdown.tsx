'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { StarryPanel } from '@/components/ui/starry-panel';
import { getCampusDefinition } from '@/config/campus-config';
import { useCampusWorkspace } from '@/features/campus/campus-workspace';

const DAY_MS = 24 * 60 * 60 * 1000;
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

export function BookingOpenCountdown() {
  const [now, setNow] = useState<number | null>(null);
  const { activeCampus } = useCampusWorkspace();
  const reduceMotion = useReducedMotion();
  const campus = activeCampus === 'all' ? getCampusDefinition('cczu') : getCampusDefinition(activeCampus);
  const countdown = useMemo(() => getCountdown(now, campus.bookingOpenTime), [campus.bookingOpenTime, now]);

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <StarryPanel
      aria-label='预约开放警报倒计时'
      className='min-w-0 flex-1 border-primary/35'
      contentClassName='p-5 sm:p-7'
    >
      <div
        className='pointer-events-none absolute top-0 right-0 left-0 h-px bg-primary/70'
        aria-hidden='true'
      />
      <div className='relative flex flex-col gap-6'>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div className='flex items-start gap-3'>
            <motion.span
              aria-hidden='true'
              animate={reduceMotion ? undefined : { opacity: [0.45, 1, 0.45] }}
              transition={
                reduceMotion ? undefined : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
              }
              className='mt-1 flex size-3 rounded-full bg-primary shadow-[0_0_18px] shadow-primary'
            />
            <div>
              <p className='text-primary text-xs font-semibold uppercase tracking-[0.2em]'>
                开放倒计时
              </p>
              <h2 className='mt-1 text-lg font-semibold tracking-tight sm:text-xl'>
                下一次抢座开放
              </h2>
              <p className='mt-1 text-xs text-background/60'>开放后按你的座位和时段自动提交</p>
            </div>
          </div>
          <Badge className='border-primary/45 bg-primary/10 text-primary'>
            每天 {campus.bookingOpenTime} 开放
          </Badge>
        </div>

        <div className='grid gap-6 lg:grid-cols-[0.7fr_1.3fr] lg:items-end'>
          <div className='border-primary/70 border-l-2 pl-4'>
            <p className='text-[11px] font-medium uppercase tracking-[0.22em] text-background/45'>
              开放时刻
            </p>
            <p className='text-primary mt-2 font-mono text-4xl font-bold tracking-tight'>
              {campus.bookingOpenTime}
            </p>
            <p className='mt-2 max-w-xs text-xs leading-5 text-background/60'>
              到点开始尝试，主座位没空时继续尝试备选。
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
            <span>等待开放</span>
            <span>{countdown.progress.toFixed(0)}%</span>
          </div>
          <Progress
            value={countdown.progress}
            aria-label='当天距离预约开放的时间进度'
            className='h-1 [&_[data-slot=progress-track]]:bg-background/15 [&_[data-slot=progress-indicator]]:bg-primary'
          />
          <div className='flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-background/55'>
            <span className='flex items-center gap-1.5'>
              <Icons.refresh /> 检查账号
            </span>
            <span className='flex items-center gap-1.5'>
              <Icons.target /> 尝试座位
            </span>
            <span className='flex items-center gap-1.5'>
              <Icons.clock /> 提交预约
            </span>
          </div>
        </div>
      </div>
    </StarryPanel>
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
      <div className='relative flex min-w-[4.25rem] items-center justify-center overflow-hidden rounded-md border border-background/15 bg-background/10 px-2 py-3 text-center sm:min-w-[6.2rem] sm:px-3 sm:py-4'>
        <span
          className='pointer-events-none absolute top-1/2 right-0 left-0 h-px bg-primary/30'
          aria-hidden='true'
        />
        <div className='relative flex h-[3.75rem] items-center font-mono text-5xl font-semibold tabular-nums text-primary sm:h-[5.25rem] sm:text-7xl'>
          {value.split('').map((digit, index) => (
            <RollingDigit key={index} value={digit} reduceMotion={reduceMotion} />
          ))}
        </div>
      </div>
      <span className='text-[10px] uppercase tracking-[0.18em] text-background/45'>{label}</span>
    </div>
  );
}

function Separator() {
  return <span className='text-primary/70 pb-6 font-mono text-2xl sm:pb-8 sm:text-3xl'>:</span>;
}

function RollingDigit({ value, reduceMotion }: { value: string; reduceMotion: boolean | null }) {
  return (
    <span className='relative inline-block h-[1em] w-[0.62em] overflow-hidden'>
      <AnimatePresence initial={false} mode='popLayout'>
        <motion.span
          key={value}
          initial={reduceMotion ? false : { opacity: 0, y: '100%', filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: '0%', filter: 'blur(0px)' }}
          exit={reduceMotion ? undefined : { opacity: 0, y: '-100%', filter: 'blur(4px)' }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: 'spring', stiffness: 420, damping: 32, mass: 0.55 }
          }
          className='absolute inset-0 flex items-center justify-center'
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

type Countdown = {
  hours: string;
  minutes: string;
  seconds: string;
  text: string;
  progress: number;
};

function getCountdown(now: number | null, openingTime: string): Countdown {
  if (now === null) {
    return { hours: '--', minutes: '--', seconds: '--', text: '--:--:--', progress: 0 };
  }

  const shanghai = new Date(now + SHANGHAI_OFFSET_MS);
  const [openingHour, openingMinute] = openingTime.split(':').map(Number);
  let target =
    Date.UTC(
      shanghai.getUTCFullYear(),
      shanghai.getUTCMonth(),
      shanghai.getUTCDate(),
      openingHour,
      openingMinute,
    ) - SHANGHAI_OFFSET_MS;
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
