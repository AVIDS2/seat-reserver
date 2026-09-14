import type { Metadata } from 'next';
import Link from 'next/link';

import { BrandMark } from '@/components/brand-mark';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import AuthBrandPanel from './auth-brand-panel';
import UserAuthForm from './user-auth-form';

export const metadata: Metadata = {
  title: '注册',
  description: '创建席定高校座位预约平台账号。'
};

export default function SignUpViewPage() {
  return (
    <main className='bg-muted/20 grid min-h-[100dvh] lg:grid-cols-[0.9fr_1.1fr]'>
      <AuthBrandPanel
        eyebrow='A CLEARER WAY TO BOOK'
        title='把常坐的位置，交给席定。'
        description='绑定学校账号，设置座位和时段，开放后自动提交。'
      />

      <section className='flex items-center justify-center px-6 py-12'>
        <div className='w-full max-w-sm'>
          <div className='mb-10 flex items-center justify-between'>
            <Link
              href='/'
              className='flex items-center gap-2 text-sm font-semibold lg:hidden'
              aria-label='返回席定首页'
            >
              <BrandMark size={32} />
              席定
            </Link>
            <Link
              href='/auth/sign-in'
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'ml-auto')}
            >
              已有账号
            </Link>
          </div>
          <div className='mb-8'>
            <p className='text-muted-foreground mb-3 text-sm'>开始使用</p>
            <h2 className='text-3xl font-semibold tracking-tight'>创建你的工作台</h2>
            <p className='text-muted-foreground mt-2 text-sm leading-6'>
              注册后绑定学校账号，设置座位与时间，剩下的交给自动预约。
            </p>
          </div>
          <UserAuthForm mode='sign-up' />
        </div>
      </section>
    </main>
  );
}
