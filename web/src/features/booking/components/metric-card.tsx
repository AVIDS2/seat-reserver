import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Icon } from '@/components/icons';

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  accent = 'default'
}: {
  label: string;
  value: string;
  detail: string;
  icon: Icon;
  accent?: 'default' | 'success' | 'warning';
}) {
  const accentClass = {
    default: 'bg-muted text-muted-foreground',
    success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
  }[accent];

  return (
    <Card className='gap-3 py-4 shadow-none'>
      <CardHeader className='px-4'>
        <div className='flex items-start justify-between gap-3'>
          <CardTitle className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
            {label}
          </CardTitle>
          <div className={`flex size-8 items-center justify-center rounded-lg ${accentClass}`}>
            <Icon className='size-4' />
          </div>
        </div>
      </CardHeader>
      <CardContent className='px-4'>
        <div className='text-2xl font-semibold tracking-tight tabular-nums'>{value}</div>
        <p className='text-muted-foreground mt-1 text-xs'>{detail}</p>
      </CardContent>
    </Card>
  );
}
