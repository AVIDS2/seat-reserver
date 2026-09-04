import { Icons } from '@/components/icons';

import { HighlightedFeature } from '../HighlightedFeature';

export function Automation() {
  return (
    <HighlightedFeature
      id='flow'
      name='开放之前，系统已经准备好。'
      description='平台在场馆开放前完成连接检查和任务准备，开放后按你的座位偏好准时执行，并把最终结果送回工作台。'
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
          <p className='mt-2 text-lg font-semibold'>自动执行流程</p>
        </div>
        <span className='bg-secondary/15 text-secondary inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium'>
          <span className='size-1.5 rounded-full bg-current' />
          已排程
        </span>
      </div>
      <div className='mt-6 space-y-3'>
        <TimelineRow
          icon={<Icons.shield />}
          time='已完成'
          title='授权预热'
          detail='检查账号连接与预约偏好'
          tone='success'
        />
        <TimelineRow
          icon={<Icons.clock />}
          time='进行中'
          title='预约执行'
          detail='按候选顺序提交策略'
          tone='active'
        />
        <TimelineRow
          icon={<Icons.history />}
          time='待同步'
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
