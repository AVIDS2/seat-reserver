'use client';

import * as React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/icons';

export type LeaderboardPodiumRanking = {
  userId: string;
  userName: string | null;
  rank: number;
  value: number;
  avatarUrl?: string | null;
};

export function LeaderboardPodium({
  rankings,
  className,
}: {
  rankings: LeaderboardPodiumRanking[];
  className?: string;
}) {
  const top = rankings.slice(0, 3);
  const order = [2, 1, 3]
    .map((rank) => top.find((item) => item.rank === rank))
    .filter(Boolean) as LeaderboardPodiumRanking[];
  if (!order.length) return null;

  return (
    <div className={cn('flex items-end justify-center gap-3 sm:gap-6', className)} role='list' aria-label='前三名'>
      {order.map((item) => {
        const primary = item.rank === 1;
        return (
          <div key={item.userId} className='flex min-w-0 flex-col items-center' role='listitem'>
            <div className='relative mb-2'>
              {item.avatarUrl ? (
                <Image
                  src={item.avatarUrl}
                  alt=''
                  width={primary ? 64 : 48}
                  height={primary ? 64 : 48}
                  unoptimized
                  className={cn('rounded-full object-cover ring-2 ring-background', primary ? 'size-16' : 'size-12')}
                />
              ) : (
                <div className={cn('bg-muted text-muted-foreground flex items-center justify-center rounded-full font-semibold ring-2 ring-background', primary ? 'size-16 text-lg' : 'size-12')}>
                  {(item.userName || '同').slice(0, 1)}
                </div>
              )}
              <span className={cn('bg-background absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full border text-xs font-semibold', primary && 'border-primary text-primary')}>
                {primary ? <Icons.pro aria-hidden='true' /> : item.rank}
              </span>
            </div>
            <span className='max-w-20 truncate text-center text-xs font-medium sm:text-sm'>{item.userName || '匿名同学'}</span>
            <span className='text-muted-foreground text-xs tabular-nums'>{formatMinutes(item.value)}</span>
            <div className={cn('bg-primary/15 mt-2 flex w-20 items-start justify-center rounded-t-lg pt-2 text-sm font-semibold text-primary sm:w-24', primary ? 'h-24' : item.rank === 2 ? 'h-18' : 'h-14')}>
              #{item.rank}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatMinutes(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return hours ? `${hours}h${minutes ? ` ${minutes}m` : ''}` : `${minutes}m`;
}
