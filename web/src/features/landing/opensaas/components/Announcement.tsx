import { Icons } from '@/components/icons';

export function Announcement() {
  return (
    <div className='bg-secondary text-secondary-foreground relative flex w-full items-center justify-center gap-2 p-2.5 text-center text-xs font-semibold sm:gap-3 sm:p-3 sm:text-sm'>
      <span className='sm:hidden'>座位图已上线</span>
      <span className='hidden sm:inline'>在座位图上选座，直接加入抢座任务</span>
      <span className='rounded-full bg-background/20 px-2.5 py-1 text-xs tracking-wide'>
        多场馆
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
