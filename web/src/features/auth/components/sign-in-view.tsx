import type { Metadata } from 'next';
import Link from 'next/link';

import { BrandMark } from '@/components/brand-mark';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import AuthBrandPanel from './auth-brand-panel';
import UserAuthForm from './user-auth-form';

export const metadata: Metadata = {
  title: '登录',
  description: '登录席定高校座位预约平台。'
};

export default function SignInViewPage() {
  return (
    <main className='bg-muted/20 grid min-h-[100dvh] lg:grid-cols-[0.9fr_1.1fr]'>
      <AuthBrandPanel
        eyebrow='AUTOMATION FOR DAILY SEATS'
        title='明早的座位，交给自动抢座。'
        description='选好座位和时段，开放后自动提交，结果回到工作台。'
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
              href='/auth/sign-up'
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'ml-auto')}
            >
              注册账号
            </Link>
          </div>
          <div className='mb-8'>
            <p className='text-muted-foreground mb-3 text-sm'>欢迎回来</p>
            <h2 className='text-3xl font-semibold tracking-tight'>进入预约控制台</h2>
            <p className='text-muted-foreground mt-2 text-sm leading-6'>
              使用你的邮箱登录，继续管理预约。
            </p>
          </div>
          <UserAuthForm />
          <p className='text-muted-foreground mt-8 text-center text-xs leading-5'>
            继续即表示你同意只使用本人账号进行正常预约。
          </p>
        </div>
      </section>
    </main>
  );
}
