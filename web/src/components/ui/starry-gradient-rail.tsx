'use client';

import { motion, useReducedMotion } from 'motion/react';

import { ShineBorder } from '@/components/ui/shine-border';
import { ShootingStars } from '@/components/ui/shooting-stars';
import { StarsBackground } from '@/components/ui/stars-background';
import { cn } from '@/lib/utils';

type StarryGradientRailProps = {
  value: number;
  label: string;
  status: string;
  className?: string;
};

export function StarryGradientRail({ value, label, status, className }: StarryGradientRailProps) {
  const prefersReducedMotion = useReducedMotion();
  const progress = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div
      className={cn(
        'relative isolate overflow-hidden rounded-xl border border-white/15 bg-black/20 px-3.5 py-3 text-white backdrop-blur-sm sm:px-4',
        className
      )}
    >
      <StarsBackground
        starDensity={0.00022}
        minTwinkleSpeed={0.7}
        maxTwinkleSpeed={1.4}
        className='opacity-75'
      />
      <ShootingStars
        minSpeed={3}
        maxSpeed={8}
        minDelay={2200}
        maxDelay={5200}
        starColor='#f0abfc'
        trailColor='#38bdf8'
        starWidth={18}
        starHeight={1.5}
        className='opacity-80 motion-reduce:hidden'
      />
      <ShineBorder
        duration={12}
        shineColor={['#22d3ee', '#a78bfa', '#f472b6', '#fbbf24']}
        className='opacity-75'
      />
      <div className='relative z-10'>
        <div className='flex items-center justify-between gap-3 text-xs'>
          <span className='font-medium text-white/70'>{label}</span>
          <span className='font-semibold text-white/90'>{status}</span>
        </div>
        <div
          className='mt-2.5 h-2.5 overflow-hidden rounded-full bg-white/10 ring-1 ring-inset ring-white/10'
          role='progressbar'
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <motion.div
            className='relative h-full rounded-full bg-[linear-gradient(90deg,#2dd4bf_0%,#38bdf8_26%,#818cf8_50%,#e879f9_75%,#fbbf24_100%)] shadow-[0_0_18px_rgba(129,140,248,0.7)]'
            initial={prefersReducedMotion ? false : { width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            {!prefersReducedMotion && (
              <motion.span
                className='absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-white/70 to-transparent blur-sm'
                animate={{ x: ['-140%', '460%'] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'linear' }}
                aria-hidden='true'
              />
            )}
          </motion.div>
        </div>
        <div className='mt-2 flex items-center justify-between text-[11px] text-white/45'>
          <span>起步</span>
          <span>持续</span>
          <span>高峰</span>
        </div>
      </div>
    </div>
  );
}
