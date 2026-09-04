import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <main
      className='flex flex-1 flex-col gap-6 p-4 md:p-6'
      aria-busy='true'
      aria-label='正在加载席定工作台'
    >
      <div className='flex flex-col gap-3'>
        <Skeleton className='h-4 w-24' />
        <Skeleton className='h-9 w-72 max-w-full' />
        <Skeleton className='h-4 w-[min(32rem,90%)]' />
      </div>
      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className='h-28 rounded-xl' />
        ))}
      </div>
      <Skeleton className='min-h-72 w-full rounded-xl' />
    </main>
  );
}
