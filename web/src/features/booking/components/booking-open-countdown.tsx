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

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const countdown = useMemo(() => getCountdown(now), [now]);

  return (
    <section
      aria-label='预约开放倒计时'
      className='bg-foreground text-background relative min-w-0 flex-1 overflow-hidden rounded-lg p-5 sm:p-7'
    >
      <div className='relative flex flex-col gap-6'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='flex items-center gap-2 text-sm font-medium'>
            <span className='bg-primary-foreground/15 flex size-7 items-center justify-center rounded-md'>
              <Icons.clock />
            </span>
            <span>下一次自动预约开放</span>
          </div>
          <Badge className='border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground'>
            每天 06:00 开放
          </Badge>
        </div>

        <div className='flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between'>
          <div>
            <p className='text-primary-foreground/65 text-xs font-medium tracking-[0.16em] uppercase'>
              Open window
            </p>
            <p className='mt-2 text-3xl font-semibold tracking-tight'>06:00</p>
            <p className='text-primary-foreground/65 mt-1 text-xs'>
              系统会在开放窗口按任务自动执行
            </p>
          </div>

          <div
            className='flex items-end gap-1.5 sm:gap-2'
            role='timer'
            aria-live='polite'
            aria-label={`距离下一次预约开放还有 ${countdown.text}`}
          >
            <TimeBlock value={countdown.hours} label='时' reduceMotion={reduceMotion} />
            <span className='pb-5 text-2xl font-semibold text-primary-foreground/50'>:</span>
            <TimeBlock value={countdown.minutes} label='分' reduceMotion={reduceMotion} />
            <span className='pb-5 text-2xl font-semibold text-primary-foreground/50'>:</span>
            <TimeBlock value={countdown.seconds} label='秒' reduceMotion={reduceMotion} />
          </div>
        </div>

        <Progress
          value={countdown.progress}
          aria-label='当天距离预约开放的时间进度'
          className='[&_[data-slot=progress-track]]:bg-primary-foreground/15 [&_[data-slot=progress-indicator]]:bg-primary-foreground'
        />
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
    <div className='flex flex-col items-center gap-1'>
      <div className='bg-primary-foreground/10 min-w-[3.25rem] rounded-md px-2 py-2 text-center sm:min-w-[4.25rem] sm:px-3 sm:py-3'>
        <motion.span
          key={value}
          initial={reduceMotion ? false : { opacity: 0.35, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className='block font-mono text-4xl leading-none font-semibold tabular-nums sm:text-6xl'
        >
          {value}
        </motion.span>
      </div>
      <span className='text-primary-foreground/60 text-[11px]'>{label}</span>
    </div>
  );
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
