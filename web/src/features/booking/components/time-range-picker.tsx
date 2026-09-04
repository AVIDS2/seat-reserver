'use client';

import { useMemo, useState } from 'react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import type { TimeCandidate } from '../types';

export const BOOKABLE_START_MINUTES = 8 * 60;
export const BOOKABLE_END_MINUTES = 22 * 60;

const TIME_OPTIONS = Array.from(
  {
    length: (BOOKABLE_END_MINUTES - BOOKABLE_START_MINUTES) / 30 + 1
  },
  (_, index) => BOOKABLE_START_MINUTES + index * 30
);
const QUICK_RANGES: TimeCandidate[] = [
  { start: 480, end: 720 },
  { start: 540, end: 900 },
  { start: 780, end: 1320 },
  { start: 840, end: 1320 }
];

export function TimeRangePicker({
  value,
  onChange,
  availableStartTimes
}: {
  value: TimeCandidate[];
  onChange: (value: TimeCandidate[]) => void;
  availableStartTimes?: number[];
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const liveStartTimes = useMemo(
    () =>
      new Set(
        (availableStartTimes ?? []).filter(
          (time) => time >= BOOKABLE_START_MINUTES && time <= BOOKABLE_END_MINUTES
        )
      ),
    [availableStartTimes]
  );

  const addRange = () => {
    const existing = new Set(value.map((range) => `${range.start}-${range.end}`));
    const suggested =
      QUICK_RANGES.find((range) => !existing.has(`${range.start}-${range.end}`)) ?? QUICK_RANGES[0];
    onChange([...value, suggested]);
    setOpenIndex(value.length);
  };

  const updateRange = (index: number, next: TimeCandidate) => {
    onChange(value.map((range, rangeIndex) => (rangeIndex === index ? next : range)));
  };

  const removeRange = (index: number) => {
    if (value.length <= 1) return;
    onChange(value.filter((_, rangeIndex) => rangeIndex !== index));
    setOpenIndex(null);
  };

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex items-center justify-between gap-3'>
        <div>
          <p className='text-sm font-medium'>候选时间段</p>
          <p className='text-muted-foreground mt-1 text-xs'>按座位优先级，再按时间顺序尝试。</p>
          <p className='text-muted-foreground mt-1 text-xs'>
            自动任务在开放窗口提交；这里设置的是目标使用时段（08:00–22:00）。
            {liveStartTimes.size ? '学校当前时段仅作为实时参考。' : ''}
          </p>
        </div>
        <span className='text-muted-foreground shrink-0 text-xs'>{value.length} 个时段</span>
      </div>

      <div className='flex flex-col gap-2'>
        {value.map((range, index) => (
          <Popover
            key={index}
            open={openIndex === index}
            onOpenChange={(open) => setOpenIndex(open ? index : null)}
          >
            <div className='flex min-w-0 items-center gap-2'>
              <span className='text-muted-foreground w-12 shrink-0 text-xs tabular-nums'>
                时段 {index + 1}
              </span>
              <PopoverTrigger
                render={
                  <Button
                    type='button'
                    variant='outline'
                    className='min-w-0 flex-1 justify-between font-normal'
                    aria-label={`编辑时段 ${index + 1}`}
                  />
                }
              >
                <span className='flex min-w-0 items-center gap-2 truncate'>
                  <Icons.clock data-icon='inline-start' />
                  <span className='truncate'>
                    {formatTime(range.start)} - {formatTime(range.end)}
                  </span>
                </span>
                <Icons.chevronDown aria-hidden='true' />
              </PopoverTrigger>
              <Button
                type='button'
                variant='ghost'
                size='icon-sm'
                className='shrink-0'
                disabled={value.length <= 1}
                onClick={() => removeRange(index)}
                aria-label={`删除时段 ${index + 1}`}
              >
                <Icons.close />
              </Button>
            </div>
            <PopoverContent align='start' className='w-[min(360px,calc(100vw-2rem))] gap-4'>
              <PopoverHeader>
                <PopoverTitle>选择时间段</PopoverTitle>
                <PopoverDescription>使用半小时刻度，不需要手动输入。</PopoverDescription>
              </PopoverHeader>
              <div className='grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2'>
                <TimeSelect
                  label='开始'
                  value={range.start}
                  options={TIME_OPTIONS.filter((option) => option < range.end)}
                  onChange={(start) =>
                    updateRange(index, {
                      start,
                      end: Math.max(range.end, start + 30)
                    })
                  }
                />
                <span className='text-muted-foreground pb-2 text-sm'>至</span>
                <TimeSelect
                  label='结束'
                  value={range.end}
                  options={TIME_OPTIONS.filter((option) => option > range.start)}
                  onChange={(end) =>
                    updateRange(index, {
                      start: Math.min(range.start, end - 30),
                      end
                    })
                  }
                />
              </div>
              <div className='flex flex-col gap-2'>
                <p className='text-muted-foreground text-xs'>常用时段</p>
                <div className='grid grid-cols-2 gap-2'>
                  {QUICK_RANGES.map((quickRange) => (
                    <Button
                      key={`${quickRange.start}-${quickRange.end}`}
                      type='button'
                      variant='outline'
                      size='sm'
                      className='justify-center font-normal'
                      onClick={() => {
                        updateRange(index, quickRange);
                        setOpenIndex(null);
                      }}
                    >
                      {formatTime(quickRange.start)} - {formatTime(quickRange.end)}
                    </Button>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        ))}
      </div>

      <Button type='button' variant='ghost' size='sm' className='w-fit' onClick={addRange}>
        <Icons.add data-icon='inline-start' />
        添加候选时段
      </Button>
    </div>
  );
}

function TimeSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: number;
  options: number[];
  onChange: (value: number) => void;
}) {
  const safeOptions = useMemo(
    () => Array.from(new Set([...options, value])).toSorted((a, b) => a - b),
    [options, value]
  );

  return (
    <label className='flex min-w-0 flex-col gap-1.5'>
      <span className='text-muted-foreground text-xs'>{label}</span>
      <Select
        value={String(value)}
        items={safeOptions.map((option) => ({
          value: String(option),
          label: formatTime(option)
        }))}
        onValueChange={(next) => next && onChange(Number(next))}
      >
        <SelectTrigger className='w-full'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>{label}时间</SelectLabel>
            {safeOptions.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {formatTime(option)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </label>
  );
}

function formatTime(minutes: number): string {
  return `${Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`;
}
