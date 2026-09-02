import Link from 'next/link';
import PageContainer from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';

export const metadata = { title: '成员协作' };

export default function TeamPage() {
  return (
    <PageContainer pageTitle='成员协作' pageDescription='平台成员和权限统一由管理员工作台管理.'>
      <Card className='mx-auto w-full max-w-[760px] shadow-none'><CardHeader className='border-b'><CardTitle className='flex items-center gap-2'><Icons.teams />平台成员</CardTitle><CardDescription>这是单一预约平台，不使用第三方组织或工作区服务。</CardDescription></CardHeader><CardContent className='pt-5'><Link href='/dashboard/admin' className={cn(buttonVariants())}><Icons.teams data-icon='inline-start' />打开管理员工作台</Link></CardContent></Card>
    </PageContainer>
  );
}
