import { Icons } from '@/components/icons';

import { HighlightedFeature } from '../HighlightedFeature';

export function Runs() {
  return (
    <HighlightedFeature
      id='runs-feature'
      name='每一次运行，都有清楚的结果。'
      description='成功、失败和原因都会按时间记录。打开工作台，就能快速确认结果。'
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
            执行记录
          </p>
          <p className='mt-2 text-lg font-semibold'>今日运行记录</p>
        </div>
        <Icons.history className='text-secondary size-5' />
      </div>
      <div className='mt-6 space-y-4'>
        <RunRow
          icon={<Icons.check />}
          title='预约完成'
          detail='回执已写入 · 主座位已确认'
          time='刚刚'
          tone='success'
        />
        <RunRow
          icon={<Icons.shield />}
          title='连接检查'
          detail='学校账号已连接，预约准备完成'
          time='2 分钟前'
          tone='active'
        />
        <RunRow
          icon={<Icons.info />}
          title='座位候选'
          detail='已载入 3 个座位和时段'
          time='已记录'
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
