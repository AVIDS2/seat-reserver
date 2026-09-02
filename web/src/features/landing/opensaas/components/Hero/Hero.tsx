import { buttonVariants } from '@/components/ui/button';
import type { PlatformUser } from '@/features/booking/api/service';
import { cn } from '@/lib/utils';
import Link from 'next/link';

import { Icons } from '@/components/icons';
import { Orbit } from './Orbit';

export function Hero({ user }: { user: PlatformUser | null }) {
  return (
    <div className='relative w-full overflow-x-clip pt-12'>
      <TopGradient />
      <BottomGradient />
      <div className='mx-auto flex max-w-7xl flex-col pt-20 lg:flex-row'>
        <div className='py-24 sm:py-32'>
          <div className='max-w-8xl px-6 lg:px-8'>
            <div className='mx-auto max-w-3xl text-center md:text-left'>
              <h1 className='text-foreground text-5xl leading-none font-extrabold sm:text-6xl'>
                让每一次座位预约，
                <br />
                都在开放前
                <span className='font-black text-amber-600 dark:text-amber-400'>准备就绪。</span>
              </h1>
              <p className='text-muted-foreground mt-6 max-w-2xl text-lg leading-8'>
                一考即过把学校账号授权、候选座位、时间策略和每日执行结果放进同一个清晰的工作台。只配置一次，之后按你的策略自动运行。
              </p>
              <div className='mt-10 flex flex-wrap items-center justify-center gap-4 md:justify-start'>
                <Link
                  href={user ? '/dashboard/overview' : '/auth/sign-in'}
                  className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}
                >
                  {user ? '打开控制台' : '登录控制台'}
                  <Icons.arrowRight />
                </Link>
                <Link
                  href={user ? '/dashboard/tasks' : '/auth/sign-up'}
                  className={cn(buttonVariants({ size: 'lg' }))}
                >
                  开始配置
                  <Icons.arrowRight />
                </Link>
              </div>
            </div>
          </div>
        </div>
        <div className='hidden lg:block'>
          <Orbit />
        </div>
      </div>
    </div>
  );
}

function TopGradient() {
  return (
    <div
      className='absolute top-0 right-0 -z-10 w-full transform-gpu overflow-hidden blur-3xl'
      aria-hidden='true'
    >
      <div
        className='bg-linear-to-tr aspect-1020/880 w-[70rem] flex-none from-amber-400 to-purple-300 opacity-10'
        style={{ clipPath: 'polygon(80% 20%, 90% 55%, 50% 100%, 70% 30%, 20% 50%, 50% 0)' }}
      />
    </div>
  );
}

function BottomGradient() {
  return (
    <div
      className='absolute inset-x-0 top-[calc(100%-40rem)] -z-10 transform-gpu overflow-hidden blur-3xl'
      aria-hidden='true'
    >
      <div
        className='bg-linear-to-br relative w-[90rem] from-amber-400 to-purple-300 opacity-10'
        style={{ clipPath: 'ellipse(80% 30% at 80% 50%)' }}
      />
    </div>
  );
}
