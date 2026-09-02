import Link from 'next/link';
import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';

export const metadata = { title: '高级策略' };

export default function ExclusivePage() {
  return (
    <PageContainer pageTitle='高级策略' pageDescription='这里保留给后续的多场馆和更复杂预约策略。'>
      <Card className='mx-auto w-full max-w-[760px] shadow-none'><CardHeader className='border-b'><CardTitle className='flex items-center gap-2'><Icons.lock />功能准备中</CardTitle><CardDescription>当前版本已完整支持当前座位系统的账号、候选座位、候选时间和自动执行。</CardDescription></CardHeader><CardContent className='pt-5'><Link href='/dashboard/tasks' className={cn(buttonVariants())}><Icons.target data-icon='inline-start' />管理预约任务</Link></CardContent></Card>
    </PageContainer>
  );
}
