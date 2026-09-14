import { buttonVariants } from '@/components/ui/button';
import type { PlatformUser } from '@/features/booking/api/service';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { preload } from 'react-dom';

import { Icons } from '@/components/icons';

export function Hero({ user }: { user: PlatformUser | null }) {
  preload('/landing/campus-library-hero-960.avif', {
    as: 'image',
    type: 'image/avif',
    imageSrcSet:
      '/landing/campus-library-hero-960.avif 960w, /landing/campus-library-hero-1600.avif 1600w, /landing/campus-library-hero-2400.avif 2400w, /landing/campus-library-hero-3200.avif 3200w',
    imageSizes: '100vw',
    fetchPriority: 'high'
  });

  return (
    <section
      className='bg-muted relative isolate flex min-h-[76svh] w-full items-end overflow-hidden bg-cover bg-center'
      style={{ backgroundImage: "url('/landing/campus-library-hero-placeholder.jpg')" }}
    >
      <picture className='absolute inset-0'>
        <source
          type='image/avif'
          srcSet='/landing/campus-library-hero-960.avif 960w, /landing/campus-library-hero-1600.avif 1600w, /landing/campus-library-hero-2400.avif 2400w, /landing/campus-library-hero-3200.avif 3200w'
          sizes='100vw'
        />
        <source
          type='image/webp'
          srcSet='/landing/campus-library-hero-960.webp 960w, /landing/campus-library-hero-1600.webp 1600w, /landing/campus-library-hero-2400.webp 2400w, /landing/campus-library-hero-3200.webp 3200w'
          sizes='100vw'
        />
        <img
          src='/landing/campus-library-hero-3200.webp'
          alt='明亮开放的现代高校图书馆学习空间'
          width='2400'
          height='1350'
          fetchPriority='high'
          loading='eager'
          decoding='async'
          className='size-full object-cover object-center'
        />
      </picture>
      <div className='absolute inset-0 bg-black/50' />
      <div className='relative mx-auto w-full max-w-7xl px-6 py-16 sm:py-20 lg:px-8 lg:py-24'>
        <div className='max-w-3xl'>
          <h1 className='text-4xl leading-[1.04] font-extrabold text-white sm:text-6xl'>
            校园座位预约，
            <br />
            从选座到执行
            <br />
            <span className='font-black text-amber-300'>一步到位。</span>
          </h1>
          <p className='mt-6 max-w-2xl text-base leading-7 text-white/80 sm:text-lg sm:leading-8'>
            绑定学校账号，选好座位和时段。预约开放后自动提交，结果及时回到工作台。
          </p>
          <div className='mt-8 flex flex-wrap items-center gap-3 sm:mt-10'>
            <Link
              href={user ? '/dashboard/overview' : '/auth/sign-in'}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'lg' }),
                'border-white/40 bg-black/20 text-white hover:bg-white hover:text-black'
              )}
            >
              {user ? '打开控制台' : '登录控制台'}
              <Icons.arrowRight />
            </Link>
            <Link
              href={user ? '/dashboard/tasks' : '/auth/sign-up'}
              className={cn(
                buttonVariants({ size: 'lg' }),
                'bg-amber-300 text-black hover:bg-amber-200'
              )}
            >
              开始创建任务
              <Icons.arrowRight />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
