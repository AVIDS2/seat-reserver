'use client';

import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Icons } from '@/components/icons';

export function DatePicker({
  value,
  dates,
  onChange
}: {
  value: string;
  dates: string[];
  onChange: (value: string) => void;
}) {
  const selected = value ? new Date(`${value}T12:00:00`) : undefined;
  const allowed = new Set(dates);
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button type='button' variant='outline' className='w-full justify-start font-normal' />
        }
      >
        <Icons.calendar data-icon='inline-start' />
        {selected ? format(selected, 'yyyy年M月d日 EEEE', { locale: zhCN }) : '选择日期'}
      </PopoverTrigger>
      <PopoverContent align='start' className='w-auto p-0'>
        <Calendar
          mode='single'
          locale={zhCN}
          selected={selected}
          disabled={(date) => !allowed.has(format(date, 'yyyy-MM-dd'))}
          onSelect={(date) => date && onChange(format(date, 'yyyy-MM-dd'))}
        />
      </PopoverContent>
    </Popover>
  );
}
