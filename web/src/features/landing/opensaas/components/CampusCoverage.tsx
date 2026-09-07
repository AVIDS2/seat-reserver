import Image from 'next/image';
import Link from 'next/link';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const campuses = [
  {
    name: '常州大学',
    detail: '当前覆盖 · 座位预约',
    status: '已接入',
    tone: 'success' as const
  },
  {
    name: '江苏海洋大学',
    detail: '下一站 · 适配中',
    status: '规划中',
    tone: 'secondary' as const
  },
  {
    name: '更多高校',
    detail: '持续扩展校园服务',
    status: '持续拓展',
    tone: 'outline' as const
  }
];

export function CampusCoverage() {
  return (
    <section id='campuses' className='mx-auto max-w-7xl scroll-mt-24 px-6 py-20 lg:px-8 lg:py-32'>
      <div className='grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:gap-20'>
        <figure className='min-w-0'>
          <div className='relative aspect-[3/2] overflow-hidden rounded-xl border bg-muted shadow-sm'>
            <picture>
              <source
                type='image/avif'
                srcSet='/landing/campus-seat-system-960.avif 960w, /landing/campus-seat-system-1600.avif 1600w'
                sizes='(max-width: 1024px) 100vw, 660px'
              />
              <source
                type='image/webp'
                srcSet='/landing/campus-seat-system-960.webp 960w, /landing/campus-seat-system-1600.webp 1600w'
                sizes='(max-width: 1024px) 100vw, 660px'
              />
              <Image
                src='/landing/campus-seat-system-1600.webp'
                alt='现代大学学习空间中的座位布局'
                fill
                sizes='(max-width: 1024px) 100vw, 660px'
                className='object-cover'
              />
            </picture>
          </div>
          <figcaption className='text-muted-foreground mt-3 text-xs'>
            空间、座位和状态，都可以被清晰地看见。
          </figcaption>
        </figure>

        <div className='min-w-0'>
          <p className='text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase'>
            Campus coverage
          </p>
          <h2 className='text-foreground mt-3 text-3xl leading-tight font-bold tracking-tight sm:text-4xl'>
            从一所校园开始，连接更多学习空间。
          </h2>
          <p className='text-muted-foreground mt-5 text-base leading-7'>
            每所高校都有自己的服务入口、空间结构和预约规则。平台按校园适配，让选择、执行和结果追踪保持同一种清晰体验。
          </p>

          <div className='mt-8 border-t'>
            {campuses.map((campus) => (
              <div
                key={campus.name}
                className='flex items-center justify-between gap-4 border-b py-4 last:border-b-0'
              >
                <div className='flex min-w-0 items-center gap-3'>
                  <span className='bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg'>
                    <Icons.building className='size-4' />
                  </span>
                  <div className='min-w-0'>
                    <p className='truncate text-sm font-semibold'>{campus.name}</p>
                    <p className='text-muted-foreground mt-1 truncate text-xs'>{campus.detail}</p>
                  </div>
                </div>
                <Badge
                  variant={campus.tone === 'success' ? 'outline' : campus.tone}
                  className={cn(
                    'shrink-0',
                    campus.tone === 'success' &&
                      'border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                  )}
                >
                  {campus.status}
                </Badge>
              </div>
            ))}
          </div>

          <Link
            href='/auth/sign-up'
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-7')}
          >
            开始配置你的校园空间
            <Icons.arrowRight />
          </Link>
        </div>
      </div>
    </section>
  );
}
