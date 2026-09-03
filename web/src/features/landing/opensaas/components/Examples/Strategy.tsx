import { Icons } from '@/components/icons';

import { HighlightedFeature } from '../HighlightedFeature';

export function Strategy() {
  return (
    <HighlightedFeature
      id='strategy-feature'
      name='你选位置，平台记住偏好。'
      description='从实时座位图中选定首选与备选，再安排日期和时间。位置变化、可用状态和执行顺序都以直观的方式呈现。'
      highlightedComponent={<StrategyExample />}
    />
  );
}

function StrategyExample() {
  return (
    <div className='bg-card w-full max-w-xl rounded-xl border p-5 shadow-xl sm:p-7'>
      <div className='flex items-start justify-between border-b pb-5'>
        <div>
          <p className='text-muted-foreground text-xs font-medium tracking-[0.16em] uppercase'>
            Booking plan
          </p>
          <p className='mt-2 text-lg font-semibold'>今日学习计划</p>
        </div>
        <span className='bg-emerald-500/10 text-emerald-700 rounded-full px-3 py-1.5 text-xs font-medium'>
          已启用
        </span>
      </div>
      <div className='mt-6 space-y-3'>
        <CandidateRow order='01' title='靠窗座位' detail='18:00 — 22:00 / 首选位置' active />
        <CandidateRow order='02' title='安静区域' detail='18:00 — 22:00 / 备选位置' />
        <CandidateRow order='03' title='同层可用座位' detail='14:00 — 22:00 / 弹性时间' />
      </div>
      <div className='text-muted-foreground mt-5 flex items-center gap-2 border-t pt-4 text-xs'>
        <Icons.clock className='size-4' />
        尝试窗口 · 20 秒 · 按顺序执行
      </div>
    </div>
  );
}

function CandidateRow({
  order,
  title,
  detail,
  active = false
}: {
  order: string;
  title: string;
  detail: string;
  active?: boolean;
}) {
  return (
    <div
      className={
        active
          ? 'border-secondary/40 bg-secondary/10 flex items-center gap-3 rounded-lg border p-3'
          : 'bg-muted/35 flex items-center gap-3 rounded-lg p-3'
      }
    >
      <span
        className={
          active
            ? 'bg-secondary text-secondary-foreground flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-xs'
            : 'bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-xs'
        }
      >
        {order}
      </span>
      <div className='min-w-0 flex-1'>
        <p className='text-sm font-medium'>{title}</p>
        <p className='text-muted-foreground mt-1 text-xs'>{detail}</p>
      </div>
      {active && <Icons.target className='text-secondary size-4 shrink-0' />}
    </div>
  );
}
