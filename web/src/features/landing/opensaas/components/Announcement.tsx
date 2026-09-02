import { Icons } from '@/components/icons';

export function Announcement() {
  return (
    <div className='bg-secondary text-secondary-foreground relative flex w-full items-center justify-center gap-3 p-3 text-center text-sm font-semibold'>
      <span className='hidden sm:inline'>每天开放前自动预热，预约结果实时可追踪</span>
      <span className='rounded-full bg-background/20 px-2.5 py-1 text-xs tracking-wide'>
        北京时间 06:00 执行
      </span>
      <a
        href='#flow'
        className='hidden items-center gap-1 text-xs underline-offset-4 hover:underline sm:inline-flex'
      >
        查看工作方式
        <Icons.arrowRight className='size-3.5' />
      </a>
    </div>
  );
}
