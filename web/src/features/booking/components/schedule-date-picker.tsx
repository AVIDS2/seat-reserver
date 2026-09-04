'use client';

import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';

const MAX_DATES = 31;

export function ScheduleDatePicker({
  value,
  onChange
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const selected = value.map(parseDate);
  const today = startOfDay(new Date());

  return (
    <div className='flex min-w-0 flex-col gap-3'>
      <div className='flex items-center justify-between gap-3'>
        <p className='text-muted-foreground text-xs'>
          已选择 {value.length} 天，最多 {MAX_DATES} 天
        </p>
        {value.length > 0 && (
          <Button type='button' variant='ghost' size='xs' onClick={() => onChange([])}>
            清空
          </Button>
        )}
      </div>
      <div className='overflow-x-auto rounded-lg border p-1'>
        <Calendar
          mode='multiple'
          locale={zhCN}
          selected={selected}
          max={MAX_DATES}
          disabled={{ before: today }}
          onSelect={(dates) => onChange((dates ?? []).map(formatDate).toSorted())}
          className='mx-auto [--cell-size:--spacing(8)] sm:[--cell-size:--spacing(9)]'
        />
      </div>
      {value.length > 0 && (
        <p className='text-muted-foreground text-xs leading-5'>
          {value.map((date) => format(parseDate(date), 'M月d日', { locale: zhCN })).join('、')}
        </p>
      )}
    </div>
  );
}

function parseDate(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

function formatDate(value: Date): string {
  return format(value, 'yyyy-MM-dd');
}

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}
