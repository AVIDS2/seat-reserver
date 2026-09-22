'use client';

import type { ComponentProps, ReactNode } from 'react';

import { ShineBorder } from '@/components/ui/shine-border';
import { ShootingStars } from '@/components/ui/shooting-stars';
import { StarsBackground } from '@/components/ui/stars-background';
import { cn } from '@/lib/utils';

export function StarryPanel({
  children,
  className,
  contentClassName,
  ...props
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
} & ComponentProps<'section'>) {
  return (
    <section
      className={cn(
        'relative isolate overflow-hidden rounded-xl border border-white/15 bg-[linear-gradient(120deg,#07111f_0%,#17294a_38%,#39205b_70%,#541d49_100%)] text-white shadow-none',
        className
      )}
      {...props}
    >
      <StarsBackground
        starDensity={0.0002}
        minTwinkleSpeed={0.7}
        maxTwinkleSpeed={1.4}
        className='opacity-80'
      />
      <ShootingStars
        minSpeed={3}
        maxSpeed={8}
        minDelay={2400}
        maxDelay={5600}
        starColor='#f0abfc'
        trailColor='#38bdf8'
        starWidth={18}
        starHeight={1.5}
        className='opacity-80 motion-reduce:hidden'
      />
      <ShineBorder
        duration={14}
        shineColor={['#22d3ee', '#818cf8', '#f472b6', '#fbbf24']}
        className='opacity-75'
      />
      <div className={cn('relative z-10', contentClassName)}>{children}</div>
    </section>
  );
}
