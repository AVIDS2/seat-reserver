import { Icons } from '@/components/icons';

import { HighlightedFeature } from '../HighlightedFeature';

export function Admin() {
  return (
    <HighlightedFeature
      id='admin-feature'
      name='所有预约状态，一眼掌握。'
      description='今日任务、连接状态、执行进度和最终结果集中呈现。无论管理一个安排还是多个学习计划，重要信息都不会被埋在层层页面里。'
      highlightedComponent={<AdminExample />}
    />
  );
}

function AdminExample() {
  return (
    <div className='bg-card w-full max-w-xl rounded-xl border p-5 shadow-xl sm:p-7'>
      <div className='flex items-start justify-between border-b pb-5'>
        <div>
          <p className='text-muted-foreground text-xs font-medium tracking-[0.16em] uppercase'>
            Control center
          </p>
          <p className='mt-2 text-lg font-semibold'>我的预约概览</p>
        </div>
        <span className='bg-emerald-500/10 text-emerald-700 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium'>
          <span className='size-1.5 rounded-full bg-current' />
          健康
        </span>
      </div>
      <div className='mt-6 grid grid-cols-3 gap-3'>
        <Metric label='已连接' value='02' />
        <Metric label='待执行' value='03' />
        <Metric label='本周成功' value='06' accent />
      </div>
      <div className='mt-5 rounded-lg bg-[#171815] p-4 text-white'>
        <div className='flex items-center justify-between'>
          <span className='text-xs text-white/50'>最近运行</span>
          <Icons.history className='size-4 text-[#f2ad4c]' />
        </div>
        <div className='mt-4 space-y-3'>
          <StatusRow label='授权预热' value='已完成' />
          <StatusRow label='预约任务' value='运行中' active />
          <StatusRow label='运行记录' value='已写入' />
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  accent = false
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className='bg-muted/40 rounded-lg p-3'>
      <p className='text-muted-foreground text-xs'>{label}</p>
      <p
        className={
          accent
            ? 'text-secondary mt-2 font-mono text-2xl font-bold'
            : 'mt-2 font-mono text-2xl font-bold'
        }
      >
        {value}
      </p>
    </div>
  );
}

function StatusRow({
  label,
  value,
  active = false
}: {
  label: string;
  value: string;
  active?: boolean;
}) {
  return (
    <div className='flex items-center justify-between border-b border-white/10 pb-2 text-xs last:border-0 last:pb-0'>
      <span className='text-white/65'>{label}</span>
      <span className={active ? 'text-[#f2ad4c]' : 'text-emerald-300'}>{value}</span>
    </div>
  );
}
