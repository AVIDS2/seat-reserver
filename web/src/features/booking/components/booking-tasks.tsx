'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

import {
  createBookingTask,
  deleteBookingTask,
  dryRunBookingTask,
  isDemoMode,
  prewarmBookingTask,
  runBookingTask,
  setBookingTaskEnabled,
  updateBookingTask,
  type DryRunResult,
  type TaskPayload
} from '../api/service';
import type { BookingAccount, BookingTask } from '../types';
import { TaskStatusBadge } from './status-badge';

type EditorPayload = Omit<TaskPayload, 'enabled'>;

async function runTask(task: BookingTask) {
  try {
    await runBookingTask(task.id);
    toast.success(`${task.name} 已加入执行队列`, {
      description: isDemoMode() ? '演示模式不会向真实预约接口发送请求。' : '后台 worker 将按策略执行。'
    });
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '运行任务失败');
  }
}

async function prewarmTask(task: BookingTask) {
  try {
    await prewarmBookingTask(task.id);
    toast.success(`${task.name} 已加入 Token 预热队列`);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '预热任务失败');
  }
}

function TaskEditorDialog({
  open,
  onOpenChange,
  accounts,
  task,
  onSave
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: BookingAccount[];
  task?: BookingTask;
  onSave: (payload: EditorPayload, taskId?: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [accountId, setAccountId] = useState('');
  const [seat, setSeat] = useState('');
  const [backupSeats, setBackupSeats] = useState('');
  const [time, setTime] = useState('14:00 - 22:00');
  const [maxAttempts, setMaxAttempts] = useState('12');
  const [delay, setDelay] = useState('1.2');
  const [windowSeconds, setWindowSeconds] = useState('20');
  const [prewarmOffset, setPrewarmOffset] = useState('0');
  const [runOffset, setRunOffset] = useState('1');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(task?.name || '');
    setAccountId(task?.accountId || accounts[0]?.id || '');
    setSeat(task?.seatId || '');
    setBackupSeats(task?.backupSeatIds.join(', ') || '');
    setTime(task ? task.timeCandidates.map((item) => `${formatTime(item.start)} - ${formatTime(item.end)}`).join(', ') : '14:00 - 22:00');
    setMaxAttempts(String(task?.maxAttempts || 12));
    setDelay(String(task?.attemptDelaySeconds ?? 1.2));
    setWindowSeconds(String(task?.bookingWindowSeconds || 20));
    setPrewarmOffset(String(task?.prewarmOffsetSeconds || 0));
    setRunOffset(String(task?.runOffsetSeconds ?? 1));
  }, [accounts, open, task]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const timeCandidates = parseTimeCandidates(time);
    if (!name.trim() || !seat.trim() || !accountId) {
      toast.error('请填写任务名称、账号和主座位');
      return;
    }
    if (!timeCandidates.length) {
      toast.error('时间格式应为 14:00 - 22:00，可用逗号填写多个候选时段');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        accountId,
        name: name.trim(),
        primarySeatId: seat.trim(),
        backupSeatIds: parseSeatIds(backupSeats),
        timeCandidates,
        maxAttempts: clampNumber(maxAttempts, 1, 100, 12),
        attemptDelaySeconds: clampNumber(delay, 0, 30, 1.2),
        bookingWindowSeconds: clampNumber(windowSeconds, 1, 120, 20),
        prewarmOffsetSeconds: clampNumber(prewarmOffset, 0, 300, 0),
        runOffsetSeconds: clampNumber(runOffset, 0, 300, 1)
      }, task?.id);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存任务失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90dvh] overflow-y-auto sm:max-w-[620px]'>
        <DialogHeader>
          <DialogTitle>{task ? '编辑预约任务' : '新建预约任务'}</DialogTitle>
          <DialogDescription>任务只会使用学校正常接口，并在北京时间开放窗口执行。</DialogDescription>
        </DialogHeader>
        <form id='booking-task-editor' onSubmit={handleSubmit} className='flex flex-col gap-4'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='flex flex-col gap-2 sm:col-span-2'>
              <Label htmlFor='task-name'>任务名称</Label>
              <Input id='task-name' value={name} onChange={(event) => setName(event.target.value)} placeholder='例如：周三靠窗位' required />
            </div>
            <div className='flex flex-col gap-2'>
              <Label htmlFor='task-account'>使用账号</Label>
              <select id='task-account' value={accountId} onChange={(event) => setAccountId(event.target.value)} className='border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3' disabled={accounts.length === 0}>
                {accounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}
              </select>
            </div>
            <div className='flex flex-col gap-2'>
              <Label htmlFor='task-seat'>主座位 ID</Label>
              <Input id='task-seat' value={seat} onChange={(event) => setSeat(event.target.value)} placeholder='例如：197' inputMode='numeric' required />
            </div>
            <div className='flex flex-col gap-2 sm:col-span-2'>
              <Label htmlFor='task-backup-seats'>备选座位 ID</Label>
              <Input id='task-backup-seats' value={backupSeats} onChange={(event) => setBackupSeats(event.target.value)} placeholder='例如：211, 212（可留空）' />
            </div>
            <div className='flex flex-col gap-2 sm:col-span-2'>
              <Label htmlFor='task-time'>候选时间段</Label>
              <Input id='task-time' value={time} onChange={(event) => setTime(event.target.value)} placeholder='14:00 - 22:00, 13:00 - 21:00' required />
              <p className='text-muted-foreground text-xs'>按座位优先级、再按时间顺序尝试。</p>
            </div>
          </div>
          <div className='border-border grid gap-4 rounded-lg border p-4 sm:grid-cols-3'>
            <p className='text-muted-foreground text-xs sm:col-span-3'>执行参数</p>
            <NumberField id='task-attempts' label='最大尝试次数' value={maxAttempts} onChange={setMaxAttempts} min='1' max='100' step='1' />
            <NumberField id='task-delay' label='尝试间隔（秒）' value={delay} onChange={setDelay} min='0' max='30' step='0.1' />
            <NumberField id='task-window' label='执行窗口（秒）' value={windowSeconds} onChange={setWindowSeconds} min='1' max='120' step='1' />
            <NumberField id='task-prewarm-offset' label='预热错峰（秒）' value={prewarmOffset} onChange={setPrewarmOffset} min='0' max='300' step='1' />
            <NumberField id='task-run-offset' label='预约错峰（秒）' value={runOffset} onChange={setRunOffset} min='0' max='300' step='1' />
          </div>
        </form>
        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>取消</Button>
          <Button type='submit' form='booking-task-editor' disabled={saving || accounts.length === 0}>{saving ? '保存中' : task ? '保存修改' : '创建任务'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NumberField({ id, label, value, onChange, min, max, step }: { id: string; label: string; value: string; onChange: (value: string) => void; min: string; max: string; step: string }) {
  return (
    <div className='flex flex-col gap-2'>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type='number' value={value} onChange={(event) => onChange(event.target.value)} min={min} max={max} step={step} required />
    </div>
  );
}

export default function BookingTasksPage({ initialTasks, initialAccounts }: { initialTasks: BookingTask[]; initialAccounts: BookingAccount[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [accounts] = useState(initialAccounts);
  const [search, setSearch] = useState('');
  const [editorTask, setEditorTask] = useState<BookingTask | undefined>();
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BookingTask | null>(null);
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);

  const filteredTasks = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return tasks;
    return tasks.filter((task) => `${task.name} ${task.account} ${task.seat}`.toLowerCase().includes(value));
  }, [search, tasks]);

  const saveTask = async (payload: EditorPayload, taskId?: string) => {
    const updated = taskId ? await updateBookingTask(taskId, payload) : await createBookingTask(payload);
    setTasks((current) => taskId ? current.map((task) => task.id === taskId ? updated : task) : [updated, ...current]);
    toast.success(taskId ? '任务已更新' : '任务创建成功');
  };

  const toggleTask = async (id: string, enabled: boolean) => {
    const previousTasks = tasks;
    setTasks((current) => current.map((task) => task.id === id ? { ...task, enabled, status: enabled ? 'enabled' : 'paused', nextRun: enabled ? '等待明早 06:00' : '已暂停' } : task));
    try {
      const updated = await setBookingTaskEnabled(id, enabled);
      setTasks((current) => current.map((task) => task.id === id ? updated : task));
      toast.success(enabled ? '任务已启用' : '任务已暂停');
    } catch (error) {
      setTasks(previousTasks);
      toast.error(error instanceof Error ? error.message : '更新任务失败');
    }
  };

  const removeTask = async () => {
    if (!deleteTarget) return;
    try {
      await deleteBookingTask(deleteTarget.id);
      setTasks((current) => current.filter((task) => task.id !== deleteTarget.id));
      toast.success('任务已删除');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除任务失败');
    } finally {
      setDeleteTarget(null);
    }
  };

  const inspectTask = async (task: BookingTask) => {
    try {
      setDryRun(await dryRunBookingTask(task.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'dry-run 失败');
    }
  };

  return (
    <PageContainer>
      <div className='mx-auto w-full max-w-[1440px] space-y-6'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
          <div>
            <p className='text-muted-foreground mb-2 text-sm'>自动化规则</p>
            <h1 className='text-2xl font-semibold tracking-tight sm:text-3xl'>预约任务</h1>
            <p className='text-muted-foreground mt-2 text-sm leading-6'>管理座位优先级、时间候选和每日自动执行状态。</p>
          </div>
          <Button onClick={() => { setEditorTask(undefined); setEditorOpen(true); }} disabled={accounts.length === 0}>
            <Icons.add data-icon='inline-start' />
            新建任务
          </Button>
        </div>

        {accounts.length === 0 && <Alert><Icons.warning /><AlertTitle>先接入学校账号</AlertTitle><AlertDescription>完成一次正常登录验证后，才能创建预约任务。</AlertDescription></Alert>}

        <Card className='shadow-none'>
          <CardHeader className='border-b'>
            <div><CardDescription>{tasks.length} 个任务</CardDescription><CardTitle className='text-xl'>全部任务</CardTitle></div>
            <CardAction><div className='relative w-full sm:w-64'><Icons.search className='text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2' /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder='搜索任务或座位' className='pl-8' aria-label='搜索任务或座位' /></div></CardAction>
          </CardHeader>
          <CardContent className='pt-0'>
            <div className='hidden grid-cols-[minmax(220px,1.5fr)_minmax(120px,0.8fr)_minmax(150px,1fr)_130px_100px] gap-4 border-b py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase lg:grid'><span>任务</span><span>账号</span><span>策略</span><span>下次执行</span><span className='text-right'>状态</span></div>
            {filteredTasks.length === 0 ? <div className='flex flex-col items-center justify-center gap-2 py-16 text-center'><Icons.search className='text-muted-foreground/50 size-8' /><p className='text-sm font-medium'>没有匹配的任务</p><p className='text-muted-foreground text-xs'>换个关键词试试。</p></div> : filteredTasks.map((task) => (
              <div key={task.id} className='grid gap-3 border-b py-4 last:border-b-0 lg:grid-cols-[minmax(220px,1.5fr)_minmax(120px,0.8fr)_minmax(150px,1fr)_130px_100px] lg:items-center lg:gap-4'>
                <div className='flex items-start gap-3'><div className='bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg'><Icons.target className='size-4' /></div><div className='min-w-0'><p className='truncate text-sm font-medium'>{task.name}</p><p className='text-muted-foreground mt-1 text-xs'>主座位 {task.seat} · {task.backupSeatIds.length ? `备选 ${task.backupSeatIds.join(', ')}` : '无备选'}</p></div></div>
                <div className='text-muted-foreground pl-12 text-sm lg:pl-0'>{task.account}</div>
                <div className='text-muted-foreground flex items-start gap-2 pl-12 text-sm lg:pl-0'><Icons.clock className='mt-0.5 size-4 shrink-0' /><span>{task.time}<span className='mt-1 block text-xs'>共 {task.maxAttempts} 次 · {task.bookingWindowSeconds} 秒</span></span></div>
                <div className='pl-12 text-sm lg:pl-0'>{task.nextRun}</div>
                <div className='flex items-center justify-between gap-3 pl-12 lg:justify-end lg:pl-0'><TaskStatusBadge status={task.status} /><Switch checked={task.enabled} onCheckedChange={(checked) => void toggleTask(task.id, checked)} aria-label={`${task.name}自动执行`} /></div>
                <div className='flex flex-wrap items-center gap-1 pl-12 lg:col-span-full lg:pl-0'><span className='text-muted-foreground mr-auto text-xs'>{task.lastMessage}</span><Button variant='ghost' size='sm' onClick={() => void inspectTask(task)}><Icons.shield data-icon='inline-start' />检查</Button><Button variant='ghost' size='sm' onClick={() => void prewarmTask(task)}><Icons.refresh data-icon='inline-start' />预热</Button><Button variant='ghost' size='sm' onClick={() => { setEditorTask(task); setEditorOpen(true); }}><Icons.edit data-icon='inline-start' />编辑</Button><Button variant='ghost' size='sm' onClick={() => void runTask(task)}><Icons.play data-icon='inline-start' />立即运行</Button><Button variant='ghost' size='sm' className='text-destructive' onClick={() => setDeleteTarget(task)}><Icons.trash data-icon='inline-start' />删除</Button></div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <TaskEditorDialog open={editorOpen} onOpenChange={setEditorOpen} accounts={accounts} task={editorTask} onSave={saveTask} />

      <Dialog open={!!dryRun} onOpenChange={(open) => !open && setDryRun(null)}>
        <DialogContent className='sm:max-w-[560px]'>
          <DialogHeader><DialogTitle>任务检查</DialogTitle><DialogDescription>只验证 Token 和生成候选列表，不会调用预约提交接口。</DialogDescription></DialogHeader>
          {dryRun && <div className='flex flex-col gap-4'><Alert variant={dryRun.tokenStatus === 'valid' ? 'default' : 'destructive'}><Icons.shield /><AlertTitle>{tokenStatusLabel(dryRun.tokenStatus)}</AlertTitle><AlertDescription>{dryRun.message}</AlertDescription></Alert><div className='flex flex-col gap-2'><p className='text-muted-foreground text-xs'>候选顺序</p>{dryRun.candidates.map((candidate) => <div key={`${candidate.order}-${candidate.seatId}-${candidate.startTime}`} className='bg-muted flex items-center justify-between rounded-lg px-3 py-2 text-sm'><span>#{candidate.order} · 座位 {candidate.seatId}</span><span className='text-muted-foreground'>{formatTime(candidate.startTime)} - {formatTime(candidate.endTime)}</span></div>)}</div></div>}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>删除这个预约任务？</AlertDialogTitle><AlertDialogDescription>删除后不会再参与自动执行，历史运行记录会保留。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={() => void removeTask()}>确认删除</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </PageContainer>
  );
}

function parseSeatIds(value: string): string[] {
  return Array.from(new Set(value.split(/[\s,，]+/).map((item) => item.trim()).filter(Boolean)));
}

function parseTimeCandidates(value: string): Array<{ start: number; end: number }> {
  return value.split(/[,，]/).flatMap((candidate) => {
    const match = candidate.trim().match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
    if (!match) return [];
    const start = Number(match[1]) * 60 + Number(match[2]);
    const end = Number(match[3]) * 60 + Number(match[4]);
    return start >= 0 && end > start && end <= 1440 ? [{ start, end }] : [];
  });
}

function clampNumber(value: string, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function formatTime(minutes: number): string {
  return `${Math.floor(minutes / 60).toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`;
}

function tokenStatusLabel(status: DryRunResult['tokenStatus']): string {
  return { valid: 'Token 有效', missing: '尚未缓存 Token', invalid: 'Token 已失效', unavailable: 'Token 检查暂不可用' }[status];
}
