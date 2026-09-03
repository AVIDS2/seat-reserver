'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { SeatLayout, SeatNode } from '../types';

type Props = {
  layout: SeatLayout | null;
  loading: boolean;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  onRefresh: () => void;
};

const statusLabels: Record<SeatNode['status'], string> = {
  available: '可选',
  reserved: '已预约',
  away: '暂离',
  unavailable: '不可用',
  mine: '我的预约',
  unknown: '未知'
};

export function SeatMapPicker({
  layout,
  loading,
  selectedIds,
  onSelectedIdsChange,
  onRefresh
}: Props) {
  const [zoom, setZoom] = useState(30);
  const seats = useMemo(
    () => layout?.nodes.filter((node) => node.kind === 'seat' && node.id) ?? [],
    [layout]
  );
  const selectedSeats = selectedIds
    .map((id) => seats.find((seat) => seat.id === id))
    .filter((seat): seat is SeatNode => Boolean(seat));

  const toggleSeat = (seat: SeatNode) => {
    if (!seat.id || !['available', 'mine'].includes(seat.status)) return;
    onSelectedIdsChange(
      selectedIds.includes(seat.id)
        ? selectedIds.filter((id) => id !== seat.id)
        : [...selectedIds, seat.id].slice(0, 8)
    );
  };

  return (
    <section className='overflow-hidden rounded-lg border bg-card'>
      <div className='flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center sm:justify-between'>
        <div className='min-w-0'>
          <p className='text-sm font-medium'>{layout?.room.name || '选择房间后加载座位图'}</p>
          <p className='text-muted-foreground mt-1 text-xs'>
            首个选中座位为主座位，其余按顺序作为备选。
          </p>
        </div>
        <div className='flex items-center gap-1'>
          <Button
            type='button'
            variant='ghost'
            size='icon-sm'
            aria-label='缩小座位图'
            onClick={() => setZoom((value) => Math.max(22, value - 2))}
          >
            <Icons.minus />
          </Button>
          <span className='text-muted-foreground w-10 text-center text-xs'>
            {Math.round((zoom / 30) * 100)}%
          </span>
          <Button
            type='button'
            variant='ghost'
            size='icon-sm'
            aria-label='放大座位图'
            onClick={() => setZoom((value) => Math.min(42, value + 2))}
          >
            <Icons.add />
          </Button>
          <Button
            type='button'
            variant='ghost'
            size='icon-sm'
            aria-label='刷新座位状态'
            onClick={onRefresh}
            disabled={!layout || loading}
          >
            <Icons.refresh className={cn(loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className='grid min-h-64 grid-cols-8 gap-2 p-6'>
          {Array.from({ length: 40 }).map((_, index) => (
            <Skeleton key={index} className='aspect-square' />
          ))}
        </div>
      ) : layout ? (
        <ScrollArea className='h-[min(48dvh,520px)] w-full'>
          <div
            className='relative m-5'
            style={{ width: layout.cols * zoom, height: layout.rows * zoom }}
          >
            {layout.nodes
              .filter((node) => node.kind !== 'empty')
              .map((node) => {
                const selectedIndex = node.id ? selectedIds.indexOf(node.id) : -1;
                const selected = selectedIndex >= 0;
                if (node.kind !== 'seat') {
                  return (
                    <div
                      key={node.key}
                      className='absolute flex items-center justify-center rounded-sm bg-muted/70 text-[9px] text-muted-foreground'
                      style={{
                        left: node.col * zoom,
                        top: node.row * zoom,
                        width: zoom - 3,
                        height: zoom - 3
                      }}
                      title={node.kind}
                    >
                      {node.kind === 'door' ? '门' : ''}
                    </div>
                  );
                }
                const selectable = ['available', 'mine'].includes(node.status);
                return (
                  <button
                    key={node.key}
                    type='button'
                    disabled={!selectable}
                    aria-label={`${node.label || '座位'}，${statusLabels[node.status]}`}
                    aria-pressed={selected}
                    title={`${node.label || '座位'} · ${statusLabels[node.status]}${node.power ? ' · 电源' : ''}`}
                    onClick={() => toggleSeat(node)}
                    className={cn(
                      'absolute flex items-center justify-center rounded-sm border text-[10px] font-medium transition-[transform,background-color,border-color] duration-150 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      selectable && 'hover:z-10 hover:scale-110',
                      node.status === 'available' &&
                        'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
                      node.status === 'reserved' &&
                        'border-transparent bg-muted text-muted-foreground opacity-55',
                      node.status === 'away' &&
                        'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300',
                      node.status === 'mine' &&
                        'border-sky-500/40 bg-sky-500/15 text-sky-800 dark:text-sky-300',
                      ['unavailable', 'unknown'].includes(node.status) &&
                        'border-transparent bg-muted/60 text-muted-foreground opacity-35',
                      selected &&
                        'z-20 scale-110 border-foreground bg-foreground text-background shadow-sm'
                    )}
                    style={{
                      left: node.col * zoom,
                      top: node.row * zoom,
                      width: zoom - 3,
                      height: zoom - 3
                    }}
                  >
                    {selected ? selectedIndex + 1 : node.label}
                  </button>
                );
              })}
          </div>
          <ScrollBar orientation='horizontal' />
        </ScrollArea>
      ) : (
        <div className='flex min-h-64 flex-col items-center justify-center gap-2 p-6 text-center'>
          <Icons.mapPin className='size-8 text-muted-foreground/40' />
          <p className='text-sm font-medium'>尚未加载座位图</p>
          <p className='text-muted-foreground text-xs'>选择账号、预约系统、场馆和日期。</p>
        </div>
      )}

      <div className='flex flex-wrap items-center gap-2 border-t p-3'>
        {(['available', 'reserved', 'away', 'mine'] as const).map((status) => (
          <span key={status} className='flex items-center gap-1.5 text-xs text-muted-foreground'>
            <span
              className={cn(
                'size-2.5 rounded-sm',
                status === 'available' && 'bg-emerald-500/60',
                status === 'reserved' && 'bg-muted-foreground/35',
                status === 'away' && 'bg-amber-500/60',
                status === 'mine' && 'bg-sky-500/60'
              )}
            />
            {statusLabels[status]}
          </span>
        ))}
        <span className='ml-auto text-xs text-muted-foreground'>{seats.length} 个座位</span>
      </div>

      {selectedSeats.length > 0 && (
        <div className='flex flex-wrap gap-2 border-t bg-muted/30 p-3'>
          {selectedSeats.map((seat, index) => (
            <Badge key={seat.id} variant={index === 0 ? 'default' : 'outline'}>
              {index === 0 ? '主座位' : `备选 ${index}`} · {seat.label} 号
            </Badge>
          ))}
        </div>
      )}
    </section>
  );
}
