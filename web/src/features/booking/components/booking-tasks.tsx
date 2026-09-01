'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import PageContainer from '@/components/layout/page-container';

import { createBookingTask, isDemoMode, runBookingTask, setBookingTaskEnabled } from '../api/service';
import type { BookingAccount, BookingTask } from '../types';
import { TaskStatusBadge } from './status-badge';

async function runTask(task: BookingTask) {
  try {
    await runBookingTask(task.id);
    toast.success(`${task.name} 已加入执行队列`, {
      description: isDemoMode() ? '演示模式不会向真实预约接口发送请求。' : 'Worker 将在后台执行预约。'
    });
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '运行任务失败');
  }
}

function NewTaskDialog({
  open,
  onOpenChange,
  accounts,
  onCreate
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: BookingAccount[];
  onCreate: (payload: {
    accountId: string;
    name: string;
    primarySeatId: string;
    backupSeatIds: string[];
    timeCandidates: Array<{ start: number; end: number }>;
  }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [seat, setSeat] = useState('');
  const [time, setTime] = useState('14:00 - 22:00');
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !seat.trim() || !accountId) return;
    const timeCandidates = parseTimeCandidates(time);
    if (!timeCandidates.length) {
      toast.error('时间格式应为 14:00 - 22:00');
      return;
    }
    setSaving(true);
    try {
      await onCreate({
        accountId,
        name: name.trim(),
        primarySeatId: seat.trim(),
        backupSeatIds: [],
        timeCandidates
      });
      setName('');
      setSeat('');
      setTime('14:00 - 22:00');
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '创建任务失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[480px]'>
        <DialogHeader>
          <DialogTitle>新建预约任务</DialogTitle>
          <DialogDescription>配置一个座位和时间段，系统会在开放时间自动执行。</DialogDescription>
        </DialogHeader>
        <form id='new-booking-task' onSubmit={handleSubmit} className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='task-name'>任务名称</Label>
            <Input
              id='task-name'
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder='例如：周三靠窗位'
              required
            />
          </div>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='task-account'>使用账号</Label>
              <select
                id='task-account'
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                className='border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3'
                disabled={accounts.length === 0}
              >
                {accounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}
              </select>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='task-seat'>目标座位</Label>
              <Input
                id='task-seat'
                value={seat}
                onChange={(event) => setSeat(event.target.value)}
                placeholder='例如：197'
                inputMode='numeric'
                required
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='task-time'>预约时段</Label>
              <Input
                id='task-time'
                value={time}
                onChange={(event) => setTime(event.target.value)}
                placeholder='14:00 - 22:00'
                required
              />
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type='submit' form='new-booking-task' disabled={saving || accounts.length === 0}>
            创建任务
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BookingTasksPage({
  initialTasks,
  initialAccounts
}: {
  initialTasks: BookingTask[];
  initialAccounts: BookingAccount[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [accounts] = useState(initialAccounts);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const filteredTasks = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return tasks;
    return tasks.filter((task) =>
      `${task.name} ${task.account} ${task.seat}`.toLowerCase().includes(value)
    );
  }, [search, tasks]);

  const toggleTask = async (id: string, enabled: boolean) => {
    const previousTasks = tasks;
    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? {
              ...task,
              enabled,
              status: enabled ? 'enabled' : 'paused',
              nextRun: enabled ? '明天 06:00:03' : '已暂停',
              lastMessage: enabled ? '已重新加入自动执行' : '任务已暂停，不会参与明日执行'
            }
          : task
      )
    );
    try {
      const updated = await setBookingTaskEnabled(id, enabled);
      setTasks((current) => current.map((task) => task.id === id ? updated : task));
      toast.success(enabled ? '任务已启用' : '任务已暂停');
    } catch (error) {
      setTasks(previousTasks);
      toast.error(error instanceof Error ? error.message : '更新任务失败');
    }
  };

  const createTask = async (payload: Parameters<typeof createBookingTask>[0]) => {
    const created = await createBookingTask(payload);
    setTasks((current) => [created, ...current]);
    toast.success('任务创建成功');
  };

  return (
    <PageContainer>
      <div className='mx-auto w-full max-w-[1440px] space-y-6'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
          <div>
            <p className='text-muted-foreground mb-2 text-sm'>自动化规则</p>
            <h1 className='text-2xl font-semibold tracking-tight sm:text-3xl'>预约任务</h1>
            <p className='text-muted-foreground mt-2 text-sm leading-6'>
              管理座位优先级、时间候选和每日自动执行状态。
            </p>
          </div>
        <Button onClick={() => setCreateOpen(true)} disabled={accounts.length === 0}>
            <Icons.add />
            新建任务
          </Button>
        </div>

        <Card className='shadow-none'>
          <CardHeader className='border-b'>
            <div>
              <CardDescription>{tasks.length} 个任务</CardDescription>
              <CardTitle className='text-xl'>全部任务</CardTitle>
            </div>
            <CardAction>
              <div className='relative w-full sm:w-64'>
                <Icons.search className='text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2' />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder='搜索任务或座位'
                  className='pl-8'
                  aria-label='搜索任务或座位'
                />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className='pt-0'>
            <div className='hidden grid-cols-[minmax(220px,1.5fr)_minmax(120px,0.8fr)_minmax(150px,1fr)_130px_100px] gap-4 border-b py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase lg:grid'>
              <span>任务</span>
              <span>账号</span>
              <span>策略</span>
              <span>下次执行</span>
              <span className='text-right'>状态</span>
            </div>
            {filteredTasks.length === 0 ? (
              <div className='flex flex-col items-center justify-center gap-2 py-16 text-center'>
                <Icons.search className='text-muted-foreground/50 size-8' />
                <p className='text-sm font-medium'>没有匹配的任务</p>
                <p className='text-muted-foreground text-xs'>换个关键词试试。</p>
              </div>
            ) : (
              filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className='grid gap-3 border-b py-4 last:border-b-0 lg:grid-cols-[minmax(220px,1.5fr)_minmax(120px,0.8fr)_minmax(150px,1fr)_130px_100px] lg:items-center lg:gap-4'
                >
                  <div className='flex items-start gap-3'>
                    <div className='bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg'>
                      <Icons.target className='size-4' />
                    </div>
                    <div className='min-w-0'>
                      <p className='truncate text-sm font-medium'>{task.name}</p>
                      <p className='text-muted-foreground mt-1 text-xs'>
                        座位 {task.seat} · ID {task.seatId}
                      </p>
                    </div>
                  </div>
                  <div className='text-muted-foreground pl-12 text-sm lg:pl-0'>{task.account}</div>
                  <div className='text-muted-foreground flex items-center gap-2 pl-12 text-sm lg:pl-0'>
                    <Icons.clock className='size-4' />
                    {task.time}
                  </div>
                  <div className='pl-12 text-sm lg:pl-0'>{task.nextRun}</div>
                  <div className='flex items-center justify-between gap-3 pl-12 lg:justify-end lg:pl-0'>
                    <TaskStatusBadge status={task.status} />
                    <Switch
                      checked={task.enabled}
                      onCheckedChange={(checked) => toggleTask(task.id, checked)}
                      aria-label={`${task.name}自动执行`}
                    />
                  </div>
                  <div className='flex items-center gap-2 pl-12 lg:col-span-full lg:pl-0'>
                    <span className='text-muted-foreground text-xs'>{task.lastMessage}</span>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='ml-auto'
                      onClick={() => runTask(task)}
                    >
                      <Icons.play />
                      立即运行
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
      <NewTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        accounts={accounts}
        onCreate={createTask}
      />
    </PageContainer>
  );
}

function parseTimeCandidates(value: string): Array<{ start: number; end: number }> {
  return value.split(',').flatMap((candidate) => {
    const match = candidate.trim().match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
    if (!match) return [];
    const start = Number(match[1]) * 60 + Number(match[2]);
    const end = Number(match[3]) * 60 + Number(match[4]);
    return end > start && end <= 1440 ? [{ start, end }] : [];
  });
}
