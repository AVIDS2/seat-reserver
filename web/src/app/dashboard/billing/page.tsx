import Link from 'next/link';
import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';

export const metadata = { title: '平台设置' };

export default function BillingPage() {
  return (
    <PageContainer pageTitle='平台设置' pageDescription='当前版本采用邀请制，不接入订阅或支付。'>
      <Card className='mx-auto w-full max-w-[760px] shadow-none'><CardHeader className='border-b'><CardTitle className='flex items-center gap-2'><Icons.shield />邀请制平台</CardTitle><CardDescription>每个成员通过邀请码加入，学校账号和预约任务按用户独立隔离。</CardDescription></CardHeader><CardContent className='flex flex-wrap gap-2 pt-5'><Link href='/dashboard/admin' className={cn(buttonVariants())}><Icons.teams data-icon='inline-start' />管理成员和邀请码</Link><Link href='/dashboard/profile' className={cn(buttonVariants({ variant: 'outline' }))}><Icons.user data-icon='inline-start' />个人资料</Link></CardContent></Card>
    </PageContainer>
  );
}
