'use client';

import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  getLeaderboardSnapshot,
  type LeaderboardPeriod,
  type LeaderboardSnapshot
} from '../api/service';
import { LeaderboardPodium } from '@/components/ui/leaderboard-podium';
import { LeaderboardRankings } from '@/components/ui/leaderboard-rankings';
import { StarryGradientRail } from '@/components/ui/starry-gradient-rail';
import PageContainer from '@/components/layout/page-container';
import { useCampusWorkspace } from '@/features/campus/campus-workspace';
import { cn } from '@/lib/utils';

export default function LeaderboardViewPage({ initialData }: { initialData: LeaderboardSnapshot }) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const { activeCampus } = useCampusWorkspace();

  const changePeriod = async (value: string) => {
    if (!value || value === data.period) return;
    setLoading(true);
    try {
      setData(
        await getLeaderboardSnapshot(
          value as LeaderboardPeriod,
          activeCampus === 'all' ? undefined : activeCampus
        )
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '排行榜加载失败');
    } finally {
      setLoading(false);
    }
  };

  const campusLabel =
    activeCampus === 'all' ? '全部高校' : activeCampus === 'jou' ? '江苏海洋大学' : '常州大学';
  const leaderValue = data.rankings[0]?.value ?? 0;
  const effortValue =
    data.currentUser && leaderValue > 0
      ? Math.round((data.currentUser.value / leaderValue) * 100)
      : 0;

  useEffect(() => {
    let active = true;
    setLoading(true);
    void getLeaderboardSnapshot(data.period, activeCampus === 'all' ? undefined : activeCampus)
      .then((next) => active && setData(next))
      .catch((error) => {
        if (active) toast.error(error instanceof Error ? error.message : '排行榜加载失败');
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // The active campus is the only external scope that should trigger a reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCampus]);

  return (
    <PageContainer
      pageTitle='学习排行'
      pageDescription='按成功预约的时段统计学习投入，重叠预约只计算一次。'
      pageHeaderAction={
        <ToggleGroup
          value={[data.period]}
          onValueChange={(values) => void changePeriod(values[0] || '')}
          variant='outline'
          spacing={0}
          aria-label='选择排行榜周期'
        >
          <ToggleGroupItem value='week'>本周</ToggleGroupItem>
          <ToggleGroupItem value='month'>本月</ToggleGroupItem>
          <ToggleGroupItem value='all'>累计</ToggleGroupItem>
        </ToggleGroup>
      }
    >
      <div className='mx-auto flex w-full max-w-[1080px] flex-col gap-4 sm:gap-5'>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          <Card className='relative isolate overflow-hidden border-white/10 bg-[linear-gradient(110deg,#08131f_0%,#17294a_38%,#39205b_69%,#541d49_100%)] text-white shadow-none'>
            <CardContent className='relative z-10 flex flex-col gap-5 p-5 sm:p-7'>
              <div className='flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between'>
                <div className='min-w-0'>
                  <Badge variant='outline' className='border-white/20 bg-white/10 text-white'>
                    <Icons.trophy className='text-amber-300' data-icon='inline-start' /> 席定学习榜
                  </Badge>
                  <h2 className='mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl'>
                    把每一次预约，变成看得见的进步
                  </h2>
                  <p className='mt-2 max-w-xl text-sm leading-6 text-white/65'>
                    {data.fromDate} 至 {data.toDate} · {campusLabel}公开昵称展示
                  </p>
                </div>
                <div className='flex shrink-0 items-center gap-4 self-start sm:self-auto'>
                  <motion.div
                    className='flex size-16 items-center justify-center rounded-2xl bg-white/10 text-amber-300 shadow-sm ring-1 ring-white/15'
                    animate={{ rotate: [0, 5, -5, 0], y: [0, -3, 0] }}
                    transition={{
                      duration: 3.2,
                      repeat: Infinity,
                      ease: 'easeInOut'
                    }}
                    aria-hidden='true'
                  >
                    <Icons.trophy className='size-8' />
                  </motion.div>
                  <div>
                    <p className='text-xs text-white/55'>当前榜单</p>
                    <p className='mt-1 text-3xl font-semibold tabular-nums text-white'>
                      {data.participantCount}
                    </p>
                    <p className='text-xs text-white/55'>位同学正在积累</p>
                  </div>
                </div>
              </div>
              <StarryGradientRail
                value={effortValue}
                label='我的学习势能'
                status={data.currentUser ? `榜首时长的 ${effortValue}%` : '完成一次预约后点亮'}
              />
            </CardContent>
          </Card>
        </motion.div>

        {data.currentUser ? (
          <div className='grid gap-3 sm:grid-cols-3'>
            <Metric
              label='我的排名'
              value={`第 ${data.currentUser.rank} 名`}
              icon={Icons.target}
              tone='primary'
            />
            <Metric
              label='预约时长'
              value={data.currentUser.valueLabel}
              icon={Icons.clock}
              tone='amber'
            />
            <Metric
              label='活跃天数'
              value={`${data.currentUser.activeDays} 天`}
              icon={Icons.flame}
              tone='rose'
            />
          </div>
        ) : (
          <Card className='shadow-none'>
            <CardContent className='flex items-center gap-3 p-4 text-sm'>
              <Icons.info className='text-muted-foreground' />
              <span className='text-muted-foreground'>
                本周期还没有你的成功预约记录，完成一次后会出现在排行榜中。
              </span>
            </CardContent>
          </Card>
        )}

        <Card className='shadow-none'>
          <CardHeader className='border-b'>
            <CardTitle className='flex items-center gap-2 text-xl'>
              <Icons.trendingUp className='text-primary' /> 榜单
            </CardTitle>
            <CardDescription>
              {loading
                ? '正在更新榜单…'
                : `累计记录 ${formatMinutes(data.trackedMinutes)}，每一次成功预约都会留下成长足迹。`}
            </CardDescription>
            <CardAction>
              <Badge variant={loading ? 'secondary' : 'outline'}>
                {loading ? (
                  <Icons.refresh className='animate-spin' data-icon='inline-start' />
                ) : (
                  <Icons.circleCheck data-icon='inline-start' />
                )}
                {loading ? '更新中' : '实时可见'}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className='flex flex-col gap-6 pt-6'>
            <motion.div
              key={`${data.period}-${data.fromDate}-${data.toDate}-${data.scopeLabel}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <LeaderboardPodium
                rankings={data.rankings.slice(0, 3)}
                showTrend={data.period !== 'all'}
              />
            </motion.div>
            {data.rankings.length ? (
              <LeaderboardRankings
                rankings={data.rankings}
                currentUserId={data.currentUser?.userId}
                showTrend={data.period !== 'all'}
              />
            ) : (
              <div className='flex flex-col items-center gap-2 rounded-xl border border-dashed bg-muted/20 px-4 py-12 text-center'>
                <Icons.sparkles className='text-primary size-8' />
                <p className='text-sm font-medium'>榜单正在等待第一份学习记录</p>
                <p className='text-muted-foreground text-xs'>
                  完成一次成功预约后，这里会出现你的真实昵称。
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <p className='text-muted-foreground text-center text-xs leading-5'>
          榜单展示平台昵称，不展示邮箱和学号。当前时长依据成功预约记录计算。
        </p>
      </div>
    </PageContainer>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  tone
}: {
  label: string;
  value: string;
  icon: typeof Icons.target;
  tone: 'primary' | 'amber' | 'rose';
}) {
  const toneClass = {
    primary: 'bg-primary/10 text-primary',
    amber: 'bg-amber-400/15 text-amber-700 dark:text-amber-300',
    rose: 'bg-rose-400/15 text-rose-700 dark:text-rose-300'
  }[tone];
  return (
    <Card className='shadow-none'>
      <CardContent className='p-4'>
        <div className='flex items-center justify-between gap-3'>
          <p className='text-muted-foreground text-xs'>{label}</p>
          <span className={cn('flex size-8 items-center justify-center rounded-lg', toneClass)}>
            <Icon />
          </span>
        </div>
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
