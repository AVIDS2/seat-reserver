'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';

import { Icons } from '@/components/icons';
import { Progress } from '@/components/ui/progress';

const DAY_MS = 24 * 60 * 60 * 1000;
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

export function BookingOpenCountdown() {
  const [now, setNow] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const countdown = useMemo(
    () => (now === null ? { text: '-- : -- : --', progress: 0 } : getCountdown(now)),
    [now]
  );

  return (
    <div className='flex min-w-0 flex-col gap-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4'>
      <div className='flex items-center justify-between gap-3'>
        <div className='flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-200'>
          <Icons.clock />
          距下一次自动预约开放
        </div>
        <span className='text-xs text-emerald-700 dark:text-emerald-300'>每天 06:00</span>
      </div>
      <motion.p
        key={countdown.text}
        initial={reduceMotion ? false : { opacity: 0.7, y: 2 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className='text-4xl font-semibold tracking-normal text-emerald-950 tabular-nums sm:text-5xl dark:text-emerald-50'
        aria-live='polite'
      >
        {countdown.text}
      </motion.p>
      <Progress
        value={countdown.progress}
        aria-label='距离下一次自动预约开放的时间进度'
        className='[&_[data-slot=progress-track]]:bg-emerald-950/10 [&_[data-slot=progress-indicator]]:bg-emerald-600 dark:[&_[data-slot=progress-track]]:bg-emerald-50/15 dark:[&_[data-slot=progress-indicator]]:bg-emerald-300'
      />
    </div>
  );
}

function getCountdown(now: number): { text: string; progress: number } {
  const shanghai = new Date(now + SHANGHAI_OFFSET_MS);
  let target =
    Date.UTC(shanghai.getUTCFullYear(), shanghai.getUTCMonth(), shanghai.getUTCDate(), 6) -
    SHANGHAI_OFFSET_MS;
  if (target <= now) target += DAY_MS;
  const remaining = Math.max(0, target - now);
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return {
    text: [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(' : '),
    progress: ((DAY_MS - remaining) / DAY_MS) * 100
  };
}
