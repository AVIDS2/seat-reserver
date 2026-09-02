'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import PageContainer from '@/components/layout/page-container';

import type { BookingRun } from '../types';
import { RunStatusBadge } from './status-badge';
import { getClientSnapshot } from '../api/service';

export default function BookingRunsPage({ initialRuns }: { initialRuns: BookingRun[] }) {
  const [liveRuns, setLiveRuns] = useState(initialRuns);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<BookingRun | null>(null);

  const filteredRuns = useMemo(
    () =>
      liveRuns.filter((run) => {
        const matchesFilter = filter === 'all' || run.status === filter;
        const value = search.trim().toLowerCase();
        return (
          matchesFilter &&
          (!value || `${run.account} ${run.task} ${run.targetDate}`.toLowerCase().includes(value))
        );
      }),
    [filter, liveRuns, search]
  );

  const refreshRuns = async () => {
    setRefreshing(true);
    try {
      const snapshot = await getClientSnapshot();
      setLiveRuns(snapshot.runs);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '刷新运行记录失败');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <PageContainer>
      <div className='mx-auto w-full max-w-[1440px] space-y-6'>
        <div>
          <p className='text-muted-foreground mb-2 text-sm'>可追溯的执行历史</p>
          <h1 className='text-2xl font-semibold tracking-tight sm:text-3xl'>运行记录</h1>
          <p className='text-muted-foreground mt-2 text-sm leading-6'>
            每一次预热和预约请求都会留下结果，方便确认系统是否按计划工作。
          </p>
          <Button variant='outline' size='sm' className='mt-4' onClick={() => void refreshRuns()} disabled={refreshing}>
            <Icons.refresh className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? '刷新中' : '刷新记录'}
          </Button>
        </div>

        <Card className='shadow-none'>
          <CardHeader className='border-b'>
            <div>
              <CardDescription>{liveRuns.length} 条记录</CardDescription>
              <CardTitle className='text-xl'>执行历史</CardTitle>
            </div>
            <div className='flex flex-col gap-2 sm:flex-row'>
              <div className='relative'>
                <Icons.search className='text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2' />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder='搜索账号或任务'
                  className='pl-8 sm:w-52'
                  aria-label='搜索运行记录'
                />
              </div>
              <div
                className='bg-muted flex h-8 items-center rounded-lg p-0.5'
                role='group'
                aria-label='运行状态筛选'
              >
                {(['all', 'success', 'failed'] as const).map((item) => (
                  <Button
                    key={item}
                    variant={filter === item ? 'default' : 'ghost'}
                    size='sm'
                    className='h-7 px-2.5 text-xs'
                    onClick={() => setFilter(item)}
                  >
                    {item === 'all' ? '全部' : item === 'success' ? '成功' : '未抢到'}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className='pt-0'>
            <div className='hidden grid-cols-[150px_minmax(180px,1fr)_130px_160px_100px_100px] gap-4 border-b py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase lg:grid'>
              <span>开始时间</span>
              <span>任务</span>
              <span>目标日期</span>
              <span>结果</span>
              <span>尝试</span>
              <span className='text-right'>状态</span>
            </div>
            {filteredRuns.length === 0 ? (
              <div className='py-16 text-center'>
                <p className='text-sm font-medium'>没有运行记录</p>
                <p className='text-muted-foreground mt-1 text-xs'>换个筛选条件试试。</p>
              </div>
            ) : (
              filteredRuns.map((run) => (
                <button
                  key={run.id}
                  type='button'
                  onClick={() => setSelected(run)}
                  className='grid w-full gap-3 border-b py-4 text-left transition-colors last:border-b-0 hover:bg-muted/40 lg:grid-cols-[150px_minmax(180px,1fr)_130px_160px_100px_100px] lg:items-center lg:gap-4'
                >
                  <span className='text-muted-foreground text-sm'>{run.startedAt}</span>
                  <span>
                    <span className='block text-sm font-medium'>{run.task}</span>
                    <span className='text-muted-foreground mt-1 block text-xs'>{run.account}</span>
                  </span>
                  <span className='text-sm'>{run.targetDate}</span>
                  <span className='text-sm'>{run.result}</span>
                  <span className='text-sm tabular-nums'>{run.attempts} 次</span>
                  <span className='flex justify-start lg:justify-end'>
                    <RunStatusBadge status={run.status} />
                  </span>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className='sm:max-w-[460px]'>
          <DialogHeader>
            <DialogTitle>运行详情</DialogTitle>
            <DialogDescription>
              {selected?.startedAt} · {selected?.account}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <span className='text-muted-foreground text-sm'>结果</span>
                <RunStatusBadge status={selected.status} />
              </div>
              <div className='grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-4'>
                <div>
                  <p className='text-muted-foreground text-xs'>任务</p>
                  <p className='mt-1 text-sm font-medium'>{selected.task}</p>
                </div>
                <div>
                  <p className='text-muted-foreground text-xs'>目标日期</p>
                  <p className='mt-1 text-sm font-medium'>{selected.targetDate}</p>
                </div>
                <div>
                  <p className='text-muted-foreground text-xs'>请求次数</p>
                  <p className='mt-1 text-sm font-medium'>{selected.attempts} 次</p>
                </div>
                <div>
                  <p className='text-muted-foreground text-xs'>最终结果</p>
                  <p className='mt-1 text-sm font-medium'>{selected.result}</p>
                </div>
              </div>
              <div>
                <p className='text-muted-foreground mb-1 text-xs'>说明</p>
                <p className='text-sm leading-6'>{selected.detail}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
