import { Icons } from '@/components/icons';

import { HighlightedFeature } from '../HighlightedFeature';

export function Runs() {
  return (
    <HighlightedFeature
      id='runs-feature'
      name='每一次运行，都有清楚的结果。'
      description='连接准备、预约尝试、成功回执和失败原因都会写进运行记录。打开工作台，就能知道每一步发生了什么。'
      highlightedComponent={<RunsExample />}
      direction='row-reverse'
    />
  );
}

function RunsExample() {
  return (
    <div className='bg-card w-full max-w-xl rounded-xl border p-5 shadow-xl sm:p-7'>
      <div className='flex items-start justify-between border-b pb-5'>
        <div>
          <p className='text-muted-foreground text-xs font-medium tracking-[0.16em] uppercase'>
            Run history
          </p>
          <p className='mt-2 text-lg font-semibold'>今日运行记录</p>
        </div>
        <Icons.history className='text-secondary size-5' />
      </div>
      <div className='mt-6 space-y-4'>
        <RunRow
          icon={<Icons.check />}
          title='预约完成'
          detail='回执 0131-600-1 · 座位 044 · 18:00 — 22:00'
          time='06:00:03'
          tone='success'
        />
        <RunRow
          icon={<Icons.shield />}
          title='授权预热'
          detail='校园账号连接正常，预约准备完成'
          time='05:59:50'
          tone='active'
        />
        <RunRow
          icon={<Icons.info />}
          title='候选检查'
          detail='已载入 3 个座位和时间候选'
          time='05:59:45'
          tone='muted'
        />
      </div>
    </div>
  );
}

function RunRow({
  icon,
  title,
  detail,
  time,
  tone
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  time: string;
  tone: 'success' | 'active' | 'muted';
}) {
  return (
    <div className='flex items-start gap-3'>
      <span
        className={
          tone === 'success'
            ? 'text-emerald-600'
            : tone === 'active'
              ? 'text-secondary'
              : 'text-muted-foreground'
        }
      >
        {icon}
      </span>
      <div className='min-w-0 flex-1'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <p className='text-sm font-medium'>{title}</p>
          <span className='text-muted-foreground font-mono text-xs'>{time}</span>
        </div>
        <p className='text-muted-foreground mt-1 text-xs leading-5'>{detail}</p>
      </div>
    </div>
  );
}
