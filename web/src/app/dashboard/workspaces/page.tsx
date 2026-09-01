import Link from 'next/link';
import PageContainer from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';

export const metadata = { title: '工作区' };

export default function WorkspacesPage() {
  return (
    <PageContainer pageTitle='工作区' pageDescription='当前平台按用户隔离学校账号、预约任务和运行记录.'>
      <Card className='mx-auto w-full max-w-[760px] shadow-none'>
        <CardHeader className='border-b'><CardTitle className='flex items-center gap-2'><Icons.workspace />个人预约工作区</CardTitle><CardDescription>你可以在这里管理自己的预约资源；管理员可以在管理员工作台管理平台成员。</CardDescription></CardHeader>
        <CardContent className='flex flex-wrap gap-2 pt-5'><Link href='/dashboard/accounts' className={cn(buttonVariants({ variant: 'outline' }))}><Icons.shield data-icon='inline-start' />账号与授权</Link><Link href='/dashboard/admin' className={cn(buttonVariants())}><Icons.teams data-icon='inline-start' />管理员工作台</Link></CardContent>
      </Card>
    </PageContainer>
  );
}
