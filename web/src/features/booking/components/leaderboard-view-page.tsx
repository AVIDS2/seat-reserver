'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { getLeaderboardSnapshot, type LeaderboardPeriod, type LeaderboardSnapshot } from '../api/service';
import { LeaderboardPodium } from '@/components/ui/leaderboard-podium';
import { LeaderboardRankings } from '@/components/ui/leaderboard-rankings';
import PageContainer from '@/components/layout/page-container';

export default function LeaderboardViewPage({ initialData }: { initialData: LeaderboardSnapshot }) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  const changePeriod = async (value: string) => {
    if (!value || value === data.period) return;
    setLoading(true);
    try {
      setData(await getLeaderboardSnapshot(value as LeaderboardPeriod));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '排行榜加载失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer
      pageTitle='学习排行'
      pageDescription='按成功预约的时段统计学习投入，重叠预约只计算一次。当前不是学校真实签退时长。'
      pageHeaderAction={
        <ToggleGroup value={[data.period]} onValueChange={(values) => void changePeriod(values[0] || '')} variant='outline' spacing={0} aria-label='选择排行榜周期'>
          <ToggleGroupItem value='week'>本周</ToggleGroupItem>
          <ToggleGroupItem value='month'>本月</ToggleGroupItem>
          <ToggleGroupItem value='all'>累计</ToggleGroupItem>
        </ToggleGroup>
      }
    >
      <div className='mx-auto flex w-full max-w-[1080px] flex-col gap-4 sm:gap-5'>
        <Card className='border-primary/20 bg-primary/[0.03] shadow-none'>
          <CardContent className='flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5'>
            <div className='flex items-start gap-3'>
              <div className='bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg'>
                <Icons.trendingUp />
              </div>
              <div>
                <p className='font-medium'>预约学习时长榜</p>
                <p className='text-muted-foreground mt-1 text-sm leading-5'>
                  {data.fromDate} 至 {data.toDate} · 同校用户匿名展示
                </p>
              </div>
            </div>
            <Badge variant='secondary'>{data.participantCount} 位同学上榜</Badge>
          </CardContent>
        </Card>

        {data.currentUser ? (
          <div className='grid gap-3 sm:grid-cols-3'>
            <Metric label='我的排名' value={`第 ${data.currentUser.rank} 名`} />
            <Metric label='预约时长' value={data.currentUser.valueLabel} />
            <Metric label='活跃天数' value={`${data.currentUser.activeDays} 天`} />
          </div>
        ) : (
          <Card className='shadow-none'>
            <CardContent className='flex items-center gap-3 p-4 text-sm'>
              <Icons.info className='text-muted-foreground' />
              <span className='text-muted-foreground'>本周期还没有你的成功预约记录，完成一次后会出现在排行榜中。</span>
            </CardContent>
          </Card>
        )}

        <Card className='shadow-none'>
          <CardHeader className='border-b'>
            <CardTitle className='flex items-center gap-2 text-xl'><Icons.pro /> 榜单</CardTitle>
            <CardDescription>{loading ? '正在更新榜单…' : `累计记录 ${formatMinutes(data.trackedMinutes)}，席定币奖励按预约成功时长发放。`}</CardDescription>
          </CardHeader>
          <CardContent className='flex flex-col gap-6 pt-6'>
            <LeaderboardPodium rankings={data.rankings.slice(0, 3)} />
            {data.rankings.length ? (
              <LeaderboardRankings rankings={data.rankings} currentUserId={data.currentUser?.userId} />
            ) : (
              <div className='text-muted-foreground rounded-lg border border-dashed px-4 py-12 text-center text-sm'>
                还没有成功预约记录，先去创建一个自动预约任务。
              </div>
            )}
          </CardContent>
        </Card>

        <p className='text-muted-foreground text-center text-xs leading-5'>
          榜单只展示脱敏昵称，不展示学号。学校返回真实签到/签退时间后，平台会再区分“预约时长”和“有效学习时长”。
        </p>
      </div>
    </PageContainer>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className='shadow-none'>
      <CardContent className='p-4'>
        <p className='text-muted-foreground text-xs'>{label}</p>
        <p className='mt-1 text-lg font-semibold tabular-nums'>{value}</p>
      </CardContent>
    </Card>
  );
}

function formatMinutes(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return hours ? `${hours} 小时${minutes ? ` ${minutes} 分钟` : ''}` : `${minutes} 分钟`;
}
