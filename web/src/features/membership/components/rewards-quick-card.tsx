'use client';

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import CountUp from '@/components/react-bits/count-up';
import { ShinyText } from '@/components/react-bits/shiny-text';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { checkInForPoints, type RewardsSnapshot } from '@/features/booking/api/service';
import { cn } from '@/lib/utils';

export function RewardsQuickCard({ initialData }: { initialData: RewardsSnapshot }) {
  const [data, setData] = useState(initialData);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const dailyActivity = data.activities.find((activity) => activity.id === 'daily_check_in');
  const availableActivities = data.activities.filter(
    (activity) => activity.status === 'available' && activity.id !== 'daily_check_in'
  ).length;
  const progress = Math.min(100, (data.pointsBalance / data.invitePointsCost) * 100);

  const checkIn = async () => {
    if (!dailyActivity || dailyActivity.status !== 'available' || isCheckingIn) return;
    setIsCheckingIn(true);
    try {
      const result = await checkInForPoints();
      setData((current) => ({
        ...current,
        pointsBalance: result.pointsBalance,
        activities: current.activities.map((activity) =>
          activity.id === result.activity.id ? result.activity : activity
        )
      }));
      toast.success('签到成功', { description: `获得 ${result.activity.points} 席定币` });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '签到失败，请稍后再试');
    } finally {
      setIsCheckingIn(false);
    }
  };

  return (
    <Card className='overflow-hidden border-primary/20 bg-primary/[0.03] shadow-none'>
      <CardHeader className='border-b'>
        <div className='flex items-start justify-between gap-3'>
          <div>
            <CardDescription>席定币钱包</CardDescription>
            <CardTitle className='mt-1 flex items-center gap-2 text-xl'>
              <Icons.creditCard className='text-primary' aria-hidden='true' />
              每日签到
            </CardTitle>
          </div>
          <ShinyText text='DAILY REWARDS' className='text-xs font-semibold tracking-[0.14em]' />
        </div>
      </CardHeader>
      <CardContent className='grid gap-5 pt-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center'>
        <div className='min-w-0'>
          <div className='flex flex-wrap items-end gap-x-3 gap-y-1'>
            <span className='text-muted-foreground text-sm'>当前余额</span>
            <span className='text-3xl font-semibold tabular-nums'>
              <CountUp to={data.pointsBalance} duration={0.7} />
            </span>
            <span className='text-muted-foreground text-sm'>席定币</span>
          </div>
          <div className='mt-4 space-y-2'>
            <div className='flex items-center justify-between gap-3 text-xs'>
              <span className='text-muted-foreground'>距好友邀请码</span>
              <span className='font-medium tabular-nums'>
                {data.pointsBalance} / {data.invitePointsCost}
              </span>
            </div>
            <Progress value={progress} aria-label='席定币兑换进度' />
          </div>
          <div className='mt-3 flex flex-wrap items-center gap-2'>
            <Badge variant='secondary'>{availableActivities} 个活动可领取</Badge>
            <span className='text-muted-foreground text-xs'>每日签到 +30 席定币</span>
          </div>
        </div>
        <div className='flex flex-col gap-2 sm:min-w-40'>
          <Button
            className='w-full'
            onClick={() => void checkIn()}
            disabled={!dailyActivity || dailyActivity.status !== 'available' || isCheckingIn}
          >
            <Icons.check data-icon='inline-start' />
            {isCheckingIn ? '签到中' : dailyActivity?.status === 'claimed' ? '今日已签到' : '签到 +30'}
          </Button>
          <Link
            href='/dashboard/membership'
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full')}
          >
            查看活动
            <Icons.arrowRight data-icon='inline-end' />
          </Link>
          <Link
            href='/dashboard/store'
            className='text-muted-foreground hover:text-foreground text-center text-xs underline-offset-4 hover:underline'
          >
            去杂货铺兑换
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
