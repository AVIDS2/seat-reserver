import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function RankTrend({
  previousRank,
  rankChange,
  className
}: {
  previousRank: number | null;
  rankChange: number | null;
  className?: string;
}) {
  if (previousRank === null) {
    return (
      <Badge
        variant='outline'
        className={cn('border-sky-400/35 bg-sky-400/10 text-sky-700 dark:text-sky-300', className)}
      >
        新上榜
      </Badge>
    );
  }
  if (rankChange === null || rankChange === 0) {
    return (
      <Badge variant='outline' className={cn('text-muted-foreground', className)}>
        持平
      </Badge>
    );
  }
  if (rankChange > 0) {
    return (
      <Badge
        variant='outline'
        className={cn(
          'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
          className
        )}
      >
        <Icons.trendingUp data-icon='inline-start' /> +{rankChange}
      </Badge>
    );
  }
  return (
    <Badge
      variant='outline'
      className={cn(
        'border-rose-500/35 bg-rose-500/10 text-rose-700 dark:text-rose-300',
        className
      )}
    >
      <Icons.trendingDown data-icon='inline-start' /> {rankChange}
    </Badge>
  );
}
