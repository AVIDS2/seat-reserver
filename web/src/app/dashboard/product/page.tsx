import PageContainer from '@/components/layout/page-container';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export const metadata = {
  title: '预约策略'
};
export default function Page() {
  return (
    <PageContainer pageTitle='预约策略' pageDescription='通过预约任务管理座位、时间段和执行参数.'>
      <Card className='mx-auto w-full max-w-[760px] shadow-none'><CardHeader className='border-b'><CardTitle className='flex items-center gap-2'><Icons.adjustments />策略管理</CardTitle><CardDescription>当前版本的完整策略入口是预约任务页面，支持主座位、备选座位、多时间段和执行窗口。</CardDescription></CardHeader><CardContent className='pt-5'><Link href='/dashboard/tasks' className={cn(buttonVariants())}><Icons.target data-icon='inline-start' />打开预约任务</Link></CardContent></Card>
    </PageContainer>
  );
}
