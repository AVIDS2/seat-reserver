'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

/*
 * Adapted from Collabodoro's TimerProgress component.
 * Source: https://github.com/InterwebAlchemy/collabodoro
 * License: MIT, Copyright (c) 2025 Interweb Alchemy.
 * The room state and timing source remain owned by 席定.
 */
export function FocusTimerRing({
  progress,
  waiting,
  paused,
  children,
  className,
  ariaLabel,
}: {
  progress: number;
  waiting: boolean;
  paused: boolean;
  children: React.ReactNode;
  className?: string;
  ariaLabel: string;
}) {
  const instanceId = useId().replace(/:/g, '');
  const gradientId = `focus-ring-gradient-${instanceId}`;
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const circumference = 2 * Math.PI * 46;
  const dashOffset = circumference - (clampedProgress / 100) * circumference;

  return (
    <div className={cn('relative mx-auto size-64 sm:size-80', className)}>
      <style>{`
        @keyframes focus-ring-waiting-${instanceId} {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .focus-ring-waiting-${instanceId} {
          transform-origin: 50% 50%;
          animation: focus-ring-waiting-${instanceId} 8s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .focus-ring-waiting-${instanceId} { animation: none; }
        }
      `}</style>
      <svg viewBox='0 0 100 100' className='absolute inset-0 size-full' role='img' aria-label={ariaLabel}>
        <defs>
          <linearGradient id={gradientId} x1='0%' y1='0%' x2='100%' y2='100%'>
            <stop offset='0%' stopColor='var(--primary)' stopOpacity='1' />
            <stop offset='55%' stopColor='var(--primary)' stopOpacity='0.72' />
            <stop offset='100%' stopColor='var(--primary)' stopOpacity='0.18' />
          </linearGradient>
        </defs>
        <circle
          cx='50'
          cy='50'
          r='46'
          fill='none'
          stroke='color-mix(in oklch, var(--background) 82%, var(--primary))'
          strokeWidth='4'
          opacity='0.4'
        />
        {waiting ? (
          <circle
            cx='50'
            cy='50'
            r='46'
            fill='none'
            stroke={`url(#${gradientId})`}
            strokeWidth='4'
            strokeLinecap='round'
            strokeDasharray={`${circumference * 0.16} ${circumference * 0.84}`}
            className={`focus-ring-waiting-${instanceId}`}
          />
        ) : (
          <circle
            cx='50'
            cy='50'
            r='46'
            fill='none'
            stroke={`url(#${gradientId})`}
            strokeWidth='4'
            strokeLinecap='round'
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform='rotate(-90 50 50)'
            style={{ transition: 'stroke-dashoffset 500ms ease-in-out' }}
          />
        )}
      </svg>
      <div className={cn('absolute inset-0 flex items-center justify-center', paused && 'opacity-75')}>
        {children}
      </div>
    </div>
  );
}
