'use client';

import Link from 'next/link';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const packages = [
  { id: 'starter', title: '轻量补给', points: 600, price: 60, description: '适合兑换一份好友邀请码。' },
  { id: 'steady', title: '稳定补给', points: 1200, price: 120, description: '给长期使用者的两份标准额度。', popular: true },
  { id: 'reserve', title: '长期储备', points: 3000, price: 300, description: '为多校区和后续权益留出余量。' }
];

export default function RechargeViewPage({ initialBalance }: { initialBalance: number }) {
  return (
    <PageContainer
      pageTitle='充值席定币'
      pageDescription='席定币可用于兑换杂货铺中的平台权益。'
      pageHeaderAction={
        <Link href='/dashboard/store' className={buttonVariants({ variant: 'outline' })}>
          <Icons.product data-icon='inline-start' /> 回到杂货铺
        </Link>
      }
    >
      <div className='mx-auto flex w-full max-w-[1080px] flex-col gap-5'>
        <Alert>
          <Icons.info />
          <AlertTitle>充值暂未开放</AlertTitle>
          <AlertDescription>
            当前不会扣款。你的余额为 <strong>{initialBalance} 席定币</strong>，也可以通过签到和活动获得。
          </AlertDescription>
        </Alert>

        <section className='grid gap-4 md:grid-cols-3'>
          {packages.map((item) => (
            <Card key={item.id} className={cn('relative flex h-full flex-col shadow-none', item.popular && 'border-primary')}>
              {item.popular && <Badge className='absolute right-4 top-4'>推荐</Badge>}
              <CardHeader>
                <CardDescription>{item.title}</CardDescription>
                <CardTitle className='text-3xl tabular-nums'>{item.points.toLocaleString()} <span className='text-base font-normal text-muted-foreground'>席定币</span></CardTitle>
              </CardHeader>
              <CardContent className='flex-1'>
                <p className='text-muted-foreground text-sm leading-6'>{item.description}</p>
                <Separator className='my-4' />
                <p className='text-xl font-semibold tabular-nums'>¥{item.price}</p>
                <p className='text-muted-foreground mt-1 text-xs'>参考价格</p>
              </CardContent>
              <CardFooter>
                <Button className='w-full' variant='outline' onClick={() => toast.info('充值通道还未上架，当前可以通过每日活跃和邀请获得席定币。')}>
                  <Icons.lock data-icon='inline-start' /> 敬请期待
                </Button>
              </CardFooter>
            </Card>
          ))}
        </section>

        <Card className='shadow-none'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'><Icons.history /> 获取席定币</CardTitle>
            <CardDescription>充值开放前，可以通过签到和邀请获得。</CardDescription>
          </CardHeader>
          <CardContent className='grid gap-3 sm:grid-cols-2'>
            <EarnRow icon={<Icons.check />} title='每日签到' description='每天进入活动中心完成一次签到，领取每日席定币。' />
            <EarnRow icon={<Icons.teams />} title='邀请真实同学' description='好友完成首次验证后，邀请双方按规则获得奖励。' />
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

function EarnRow({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className='flex gap-3 rounded-lg border bg-muted/20 p-4'>
      <div className='text-primary mt-0.5'>{icon}</div>
      <div>
        <p className='font-medium'>{title}</p>
        <p className='text-muted-foreground mt-1 text-sm leading-5'>{description}</p>
      </div>
    </div>
  );
}
