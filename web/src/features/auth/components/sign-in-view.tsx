import type { Metadata } from 'next';
import Link from 'next/link';

import { Icons } from '@/components/icons';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import AuthBrandPanel from './auth-brand-panel';
import UserAuthForm from './user-auth-form';

export const metadata: Metadata = {
  title: '登录',
  description: '登录一考即过预约控制台。'
};

export default function SignInViewPage() {
  return (
    <main className='bg-muted/20 grid min-h-[100dvh] lg:grid-cols-[0.9fr_1.1fr]'>
      <AuthBrandPanel
        eyebrow='AUTOMATION FOR DAILY SEATS'
        title='把每一次预约，交给更稳定的自动化。'
        description='统一管理学校账号、候选策略和每日运行结果，让明早的预约清晰可控。'
      />

      <section className='flex items-center justify-center px-6 py-12'>
        <div className='w-full max-w-sm'>
          <div className='mb-10 flex items-center justify-between'>
            <Link
              href='/'
              className='flex items-center gap-2 text-sm font-semibold lg:hidden'
              aria-label='返回一考即过首页'
            >
              <span className='bg-foreground text-background flex size-8 items-center justify-center rounded-lg'>
                <Icons.bolt className='size-4' />
              </span>
              一考即过
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
