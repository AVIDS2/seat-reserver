'use client';

import { motion } from 'motion/react';

import { Icons } from '@/components/icons';
import { ProfileAvatar } from '@/components/profile/profile-avatar';
import { Badge } from '@/components/ui/badge';
import { RankTrend } from '@/components/ui/rank-trend';
import { cn } from '@/lib/utils';

export type LeaderboardPodiumRanking = {
  userId: string;
  userName: string | null;
  rank: number;
  value: number;
  valueLabel?: string;
  avatarUrl?: string | null;
  avatarFrameId?: string;
  badgeId?: string;
  badgeLabel?: string;
  titleId?: string;
  titleLabel?: string;
  previousRank?: number | null;
  rankChange?: number | null;
};

const rankTheme = {
  1: {
    card: 'border-amber-400/60 bg-amber-400/10',
    icon: 'bg-amber-400 text-amber-950',
    text: 'text-amber-700 dark:text-amber-300',
    block: 'bg-amber-400 text-amber-950',
    height: 'h-24',
    Icon: Icons.trophy
  },
  2: {
    card: 'border-sky-300/60 bg-sky-400/10',
    icon: 'bg-sky-300 text-sky-950',
    text: 'text-sky-700 dark:text-sky-300',
    block: 'bg-sky-300 text-sky-950',
    height: 'h-20',
    Icon: Icons.medal
  },
  3: {
    card: 'border-rose-300/60 bg-rose-400/10',
    icon: 'bg-rose-300 text-rose-950',
    text: 'text-rose-700 dark:text-rose-300',
    block: 'bg-rose-300 text-rose-950',
    height: 'h-16',
    Icon: Icons.award
  }
} as const;

export function LeaderboardPodium({
  rankings,
  showTrend = false,
  className
}: {
  rankings: LeaderboardPodiumRanking[];
  showTrend?: boolean;
  className?: string;
}) {
  const order = [2, 1, 3]
    .map((rank) => rankings.find((item) => item.rank === rank))
    .filter((item): item is LeaderboardPodiumRanking => Boolean(item));

  if (!order.length) return null;

  return (
    <div
      className={cn('grid grid-cols-3 items-end gap-2 sm:gap-4', className)}
      role='list'
      aria-label='学习排行前三名'
    >
      {order.map((item, index) => {
        const theme = rankTheme[item.rank as 1 | 2 | 3] ?? rankTheme[3];
        const RankIcon = theme.Icon;
        const name = item.userName || '未命名用户';
        return (
          <motion.article
            key={item.userId}
            role='listitem'
            className={cn(
              'relative flex min-w-0 flex-col items-center overflow-hidden rounded-xl border px-2 pt-4 sm:px-4 sm:pt-5',
              theme.card,
              item.rank === 1 ? 'min-h-60' : 'min-h-52'
            )}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            whileHover={{ y: -6 }}
            transition={{ duration: 0.45, delay: index * 0.1, ease: 'easeOut' }}
          >
            {item.rank === 1 && (
              <motion.div
                className='text-amber-600 dark:text-amber-300 absolute top-2 right-3'
                animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.08, 1] }}
                transition={{
                  duration: 2.8,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
                aria-hidden='true'
              >
                <Icons.sparkles />
              </motion.div>
            )}
            <div className='flex min-w-0 flex-wrap items-center justify-center gap-1.5'>
              <Badge variant='outline' className={cn('border-current/30', theme.text)}>
                <RankIcon data-icon='inline-start' />第 {item.rank} 名
              </Badge>
              {showTrend && (
                <RankTrend
                  previousRank={item.previousRank ?? null}
                  rankChange={item.rankChange ?? null}
                />
              )}
            </div>
            <ProfileAvatar
              avatarUrl={item.avatarUrl}
              name={name}
              frameId={item.avatarFrameId}
              size={item.rank === 1 ? 'lg' : 'default'}
              className='mt-4 ring-2 ring-background'
            />
            <p className='mt-2 max-w-full truncate text-center text-sm font-semibold'>{name}</p>
            <Badge
              variant='outline'
              className={cn('mt-1 max-w-full truncate border-current/25 text-[11px]', theme.text)}
            >
              {item.titleLabel ?? '初来乍到'}
            </Badge>
            <span className='text-muted-foreground mt-1 max-w-full truncate text-[11px]'>
              {item.badgeLabel ?? '席定新星'}
            </span>
            <p className={cn('mt-1 text-xs font-medium tabular-nums', theme.text)}>
              {item.valueLabel || formatMinutes(item.value)}
            </p>
            <div
              className={cn(
                'mt-auto flex w-full items-center justify-center rounded-t-lg pt-2 text-lg font-bold',
                theme.block,
                theme.height
              )}
            >
              #{item.rank}
            </div>
          </motion.article>
        );
      })}
    </div>
  );
}

function formatMinutes(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return hours ? `${hours} 小时${minutes ? ` ${minutes} 分钟` : ''}` : `${minutes} 分钟`;
}
