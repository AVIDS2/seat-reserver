import Link from 'next/link';

import { BrandMark } from '@/components/brand-mark';
import { InteractiveGridPattern } from './interactive-grid';

export default function AuthBrandPanel({
  eyebrow,
  title,
  description
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className='relative hidden min-h-[100dvh] overflow-hidden bg-[#191a18] p-8 text-white lg:flex lg:flex-col'>
      <InteractiveGridPattern
        width={58}
        height={58}
        squares={[18, 18]}
        aria-hidden='true'
        className='pointer-events-auto -top-[14%] -left-[10%] h-[128%] w-[128%] -rotate-[14deg] scale-110 border-white/[0.06] opacity-80'
        squaresClassName='stroke-white/[0.10] hover:fill-white/[0.20]'
      />
      <div className='pointer-events-none absolute inset-0 bg-black/10' />

      <Link
        href='/'
        className='relative z-10 inline-flex w-fit items-center gap-2 text-sm font-semibold tracking-tight transition-opacity hover:opacity-75'
        aria-label='返回席定首页'
      >
        <BrandMark size={36} priority />
        席定
      </Link>

      <div className='relative z-10 mt-auto max-w-xl'>
        <div className='mb-5 inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.22em] text-white/50 uppercase'>
          <span className='size-1.5 rounded-full bg-[#f2ad4c]' aria-hidden='true' />
          {eyebrow}
        </div>
        <h1 className='max-w-lg text-4xl leading-[1.08] font-semibold tracking-tight text-balance xl:text-5xl'>
          {title}
        </h1>
        <p className='mt-5 max-w-md text-sm leading-7 text-white/60'>{description}</p>

        <div className='mt-9 grid max-w-md grid-cols-3 border-t border-white/10 pt-5'>
          <div>
            <p className='font-mono text-lg text-white'>自动</p>
            <p className='mt-1 text-[11px] text-white/40'>连接检查</p>
          </div>
          <div className='border-l border-white/10 pl-4'>
            <p className='font-mono text-lg text-white'>准时</p>
            <p className='mt-1 text-[11px] text-white/40'>开放提交</p>
          </div>
          <div className='border-l border-white/10 pl-4'>
            <p className='font-mono text-lg text-[#f2ad4c]'>自定义</p>
            <p className='mt-1 text-[11px] text-white/40'>备选座位</p>
          </div>
        </div>
      </div>
    </section>
  );
}
