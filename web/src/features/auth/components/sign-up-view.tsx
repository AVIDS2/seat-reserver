import type { Metadata } from 'next';
import Link from 'next/link';

import { Icons } from '@/components/icons';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import UserAuthForm from './user-auth-form';

export const metadata: Metadata = {
  title: '注册',
  description: '创建一考即过预约控制台账号。'
};

export default function SignUpViewPage() {
  return (
    <main className='bg-muted/20 grid min-h-[100dvh] lg:grid-cols-[0.9fr_1.1fr]'>
      <section className='bg-foreground text-background relative hidden overflow-hidden p-10 lg:flex lg:flex-col'>
        <div className='relative z-10 flex items-center gap-2 text-sm font-semibold'>
          <span className='bg-background text-foreground flex size-8 items-center justify-center rounded-lg'>
            <Icons.bolt className='size-4' />
          </span>
          一考即过
        </div>
        <div className='relative z-10 mt-auto max-w-md'>
          <p className='text-background/60 mb-4 text-xs font-medium tracking-[0.18em] uppercase'>
            A calmer way to book
          </p>
          <h1 className='text-4xl leading-tight font-semibold tracking-tight'>
            你的座位策略，值得一套清晰的工作台。
          </h1>
          <p className='text-background/65 mt-5 text-sm leading-6'>
            从账号授权到每一次运行，所有状态都在一个地方被看见。
          </p>
        </div>
        <div className='absolute -right-20 -bottom-24 size-72 rounded-full border border-background/10' />
        <div className='absolute right-16 -bottom-10 size-44 rounded-full border border-background/10' />
      </section>

      <section className='flex items-center justify-center px-6 py-12'>
        <div className='w-full max-w-sm'>
          <div className='mb-10 flex items-center justify-between'>
            <Link
              href='/dashboard/overview'
              className='flex items-center gap-2 text-sm font-semibold lg:hidden'
            >
              <span className='bg-foreground text-background flex size-8 items-center justify-center rounded-lg'>
                <Icons.bolt className='size-4' />
              </span>
              一考即过
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
              先创建本平台账号。登录后再绑定学校学号和密码，系统会自动获取学校 Token；首个账号自动获得管理员权限，后续账号使用邀请码加入。
            </p>
          </div>
          <UserAuthForm mode='sign-up' />
        </div>
      </section>
    </main>
  );
}
