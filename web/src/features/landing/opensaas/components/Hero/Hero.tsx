import { buttonVariants } from '@/components/ui/button';
import type { PlatformUser } from '@/features/booking/api/service';
import { cn } from '@/lib/utils';
import Link from 'next/link';

import { Icons } from '@/components/icons';
import { Orbit } from './Orbit';

export function Hero({ user }: { user: PlatformUser | null }) {
  return (
    <div className='relative w-full overflow-x-clip pt-0'>
      <div className='mx-auto flex max-w-7xl flex-col pt-0 lg:flex-row lg:pt-20'>
        <div className='pt-10 pb-14 sm:pt-14 sm:pb-20 lg:py-32'>
          <div className='max-w-8xl px-6 lg:px-8'>
            <div className='mx-auto max-w-3xl text-center md:text-left'>
              <h1 className='text-foreground text-5xl leading-[1.02] font-extrabold sm:text-6xl'>
                校园座位预约，
                <br />
                从选座到执行
                <br />
                <span className='font-black text-amber-600 dark:text-amber-400'>一步到位。</span>
              </h1>
              <p className='text-muted-foreground mt-6 max-w-2xl text-lg leading-8'>
                一个面向校园场景的座位预约自动化平台。连接校园账号，在实时座位图中选好位置与时间，剩下的准备、执行和结果追踪交给平台。
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
