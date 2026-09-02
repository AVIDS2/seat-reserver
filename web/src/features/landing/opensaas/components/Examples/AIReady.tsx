import { Icons } from '@/components/icons';

import { HighlightedFeature } from '../HighlightedFeature';

export function Automation() {
  return (
    <HighlightedFeature
      id='flow'
      name='开放之前，系统已经准备好。'
      description='固定的北京时间调度、独立的任务队列和有限的预约窗口，让自动化动作更接近真实使用节奏。授权先预热，开放后按候选顺序执行，最后把回执写入运行记录。'
      highlightedComponent={<AutomationExample />}
      direction='row-reverse'
    />
  );
}

function AutomationExample() {
  return (
    <div className='bg-card w-full max-w-xl rounded-xl border p-5 shadow-xl sm:p-7'>
      <div className='flex items-center justify-between border-b pb-5'>
        <div>
          <p className='text-muted-foreground text-xs font-medium tracking-[0.16em] uppercase'>
            Daily execution
          </p>
          <p className='mt-2 text-lg font-semibold'>明早的预约窗口</p>
        </div>
        <span className='bg-secondary/15 text-secondary inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium'>
          <span className='size-1.5 rounded-full bg-current' />
          已排程
        </span>
      </div>
      <div className='mt-6 space-y-3'>
        <TimelineRow
          icon={<Icons.shield />}
          time='05:59:50'
          title='授权预热'
          detail='验证缓存 Token，必要时自动刷新'
          tone='success'
        />
        <TimelineRow
          icon={<Icons.clock />}
          time='06:00:00'
          title='预约窗口开始'
          detail='按候选顺序提交策略'
          tone='active'
        />
        <TimelineRow
          icon={<Icons.history />}
          time='06:00:20'
          title='结果写入'
          detail='保存回执、状态和运行记录'
          tone='muted'
        />
      </div>
    </div>
  );
}

function TimelineRow({
  icon,
  time,
  title,
  detail,
  tone
}: {
  icon: React.ReactNode;
  time: string;
  title: string;
  detail: string;
  tone: 'success' | 'active' | 'muted';
}) {
  return (
    <div className='bg-muted/35 flex items-start gap-3 rounded-lg p-3.5'>
      <span
        className={
          tone === 'active'
            ? 'text-secondary'
            : tone === 'success'
              ? 'text-emerald-600'
              : 'text-muted-foreground'
        }
      >
        {icon}
      </span>
      <div className='min-w-0 flex-1'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <p className='text-sm font-medium'>{title}</p>
          <p className='text-muted-foreground font-mono text-xs'>{time}</p>
        </div>
        <p className='text-muted-foreground mt-1 text-xs'>{detail}</p>
      </div>
    </div>
  );
}
