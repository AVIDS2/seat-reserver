'use client';

import * as React from 'react';
import Image from 'next/image';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type LeaderboardRankingItem = {
  userId: string;
  userName: string | null;
  rank: number;
  value: number;
  valueLabel?: string;
  byline?: string | null;
  avatarUrl?: string | null;
};

export function LeaderboardRankings({
  rankings,
  currentUserId,
  className,
}: {
  rankings: LeaderboardRankingItem[];
  currentUserId?: string;
  className?: string;
}) {
  const [page, setPage] = React.useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(rankings.length / pageSize));
  const rows = rankings.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className={cn('bg-card w-full rounded-lg border', className)}>
      <div className='divide-y'>
        {rows.map((item) => {
          const current = item.userId === currentUserId;
          return (
            <div key={item.userId} className={cn('flex items-center gap-3 px-3 py-3 sm:px-4', current && 'bg-primary/5')}>
              <span className='w-8 shrink-0 text-center text-sm font-semibold tabular-nums'>{item.rank}</span>
              {item.avatarUrl ? (
                <Image src={item.avatarUrl} alt='' width={36} height={36} unoptimized className='size-9 rounded-full object-cover' />
              ) : (
                <div className='bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-medium'>
                  {(item.userName || '同').slice(0, 1)}
                </div>
              )}
              <div className='min-w-0 flex-1'>
                <p className='truncate text-sm font-medium'>{item.userName || '匿名同学'}{current ? ' · 你' : ''}</p>
                <p className='text-muted-foreground truncate text-xs'>{item.byline}</p>
              </div>
              <p className='shrink-0 text-right text-sm font-semibold tabular-nums'>{item.valueLabel || formatMinutes(item.value)}</p>
            </div>
          );
        })}
      </div>
      {rankings.length > pageSize && (
        <div className='flex items-center justify-between gap-3 border-t px-3 py-2 sm:px-4'>
          <span className='text-muted-foreground text-xs'>第 {page} / {totalPages} 页</span>
          <div className='flex gap-1'>
            <Button variant='ghost' size='icon-sm' onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1} aria-label='上一页'><Icons.chevronLeft /></Button>
            <Button variant='ghost' size='icon-sm' onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page === totalPages} aria-label='下一页'><Icons.chevronRight /></Button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatMinutes(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return hours ? `${hours} 小时${minutes ? ` ${minutes} 分钟` : ''}` : `${minutes} 分钟`;
}
