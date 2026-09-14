'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

import {
  createFocusRoom,
  getFocusRooms,
  joinFocusRoom,
} from '../api/service';
import type { CreateFocusRoomInput, FocusRoomSummary, FocusRoomsSnapshot } from '../types';

const DEFAULT_FORM: CreateFocusRoomInput = {
  name: '',
  isPublic: true,
  shareFocusData: true,
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  roundsBeforeLongBreak: 4,
};

export default function FocusRoomLobbyPage({ initialData }: { initialData: FocusRoomsSnapshot }) {
  const [data, setData] = useState(initialData);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [preset, setPreset] = useState('classic');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | 'refresh' | null>(null);

  const refresh = async () => {
    setBusy('refresh');
    try {
      setData(await getFocusRooms());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '房间暂时无法加载');
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      void getFocusRooms().then(setData).catch(() => undefined);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const myRooms = useMemo(
    () => data.rooms.filter((room) => room.isMember),
    [data.rooms],
  );
  const publicRooms = useMemo(
    () => data.rooms.filter((room) => !room.isMember && room.isPublic),
    [data.rooms],
  );

  const submitCreate = async () => {
    if (!form.name.trim()) {
      toast.error('给房间起个名字');
      return;
    }
    setBusy('create');
    try {
      const room = await createFocusRoom({ ...form, name: form.name.trim() });
      window.location.assign(`/dashboard/focus/${room.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '创建房间失败');
      setBusy(null);
    }
  };

  const submitJoin = async () => {
    if (!joinCode.trim()) {
      toast.error('输入房间码');
      return;
    }
    setBusy('join');
    try {
      const room = await joinFocusRoom(joinCode);
      window.location.assign(`/dashboard/focus/${room.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '加入房间失败');
      setBusy(null);
    }
  };

  return (
    <PageContainer
      pageTitle='席定自习室'
      pageDescription='和朋友一起开始一段专注时间。没有聊天，只有同屏进度。'
      pageHeaderAction={
        <div className='flex flex-wrap gap-2'>
          <Button variant='outline' onClick={() => setJoinOpen(true)}>
            <Icons.login data-icon='inline-start' />
            加入房间
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Icons.add data-icon='inline-start' />
            创建房间
          </Button>
        </div>
      }
    >
      <div className='mx-auto flex w-full max-w-[1180px] flex-col gap-5 sm:gap-6'>
        <section className='relative overflow-hidden rounded-xl bg-foreground text-background'>
          <div className='pointer-events-none absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_82%_18%,hsl(var(--primary)/.32),transparent_30%),radial-gradient(circle_at_18%_100%,hsl(var(--primary)/.18),transparent_35%)]' />
          <div className='relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-end'>
            <div className='max-w-2xl'>
              <Badge className='border-background/15 bg-background/10 text-background'>
                <Icons.clock data-icon='inline-start' />
                FOCUS ROOM
              </Badge>
              <h2 className='mt-4 text-2xl font-semibold tracking-tight sm:text-4xl'>
                一起坐下，专注刚刚好。
              </h2>
              <p className='mt-3 max-w-xl text-sm leading-6 text-background/65 sm:text-base'>
                创建一个安静的房间，和同学共享一段专注时间。看见有人在专注，也更容易把这一段时间用好。
              </p>
            </div>
            <div className='grid grid-cols-3 gap-3 sm:min-w-80'>
              <LobbyStat label='我的房间' value={myRooms.length} />
              <LobbyStat label='公开房间' value={publicRooms.length} />
              <LobbyStat label='房间上限' value={20} />
            </div>
          </div>
        </section>

        <RoomSection
          title='我的房间'
          description='继续上次的专注，或回到你创建的房间。'
          rooms={myRooms}
          emptyTitle='还没有加入房间'
          emptyDescription='创建一个房间，或者输入朋友发来的房间码。'
          onCreate={() => setCreateOpen(true)}
        />
        <RoomSection
          title='发现房间'
          description='公开房间会出现在这里，加入后即可开始专注。'
          rooms={publicRooms}
          emptyTitle='暂时没有公开房间'
          emptyDescription='创建第一个房间，邀请同学一起开始。'
          onCreate={() => setCreateOpen(true)}
        />

        <Alert>
          <Icons.info />
          <AlertTitle>房间保持安静</AlertTitle>
          <AlertDescription>房间只同步计时和专注状态，不提供聊天。专注数据是否共享，由房主创建时决定。</AlertDescription>
        </Alert>
        <Button variant='outline' className='self-start' onClick={() => void refresh()} disabled={busy !== null}>
          <Icons.refresh className={cn(busy === 'refresh' && 'animate-spin')} data-icon='inline-start' />
          {busy === 'refresh' ? '刷新中' : '刷新房间'}
        </Button>
      </div>

      <CreateRoomDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        form={form}
        setForm={setForm}
        preset={preset}
        setPreset={setPreset}
        busy={busy === 'create'}
        onSubmit={() => void submitCreate()}
      />
      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>加入专注房</DialogTitle>
            <DialogDescription>输入 6 位房间码，和朋友进入同一间席定自习室。</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor='focus-room-code'>房间码</FieldLabel>
            <Input
              id='focus-room-code'
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              placeholder='例如：A7K2P9'
              maxLength={8}
              className='font-mono tracking-[0.18em] uppercase'
              autoComplete='off'
            />
          </Field>
          <DialogFooter>
            <Button variant='outline' onClick={() => setJoinOpen(false)}>取消</Button>
            <Button onClick={() => void submitJoin()} disabled={busy === 'join'}>
              <Icons.login data-icon='inline-start' />
              {busy === 'join' ? '加入中' : '加入房间'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

function LobbyStat({ label, value }: { label: string; value: number }) {
  return (
    <div className='rounded-lg border border-background/10 bg-background/10 p-3'>
      <p className='text-xs text-background/55'>{label}</p>
      <p className='mt-2 text-2xl font-semibold tabular-nums'>{value}</p>
    </div>
  );
}

function RoomSection({
  title,
  description,
  rooms,
  emptyTitle,
  emptyDescription,
  onCreate,
}: {
  title: string;
  description: string;
  rooms: FocusRoomSummary[];
  emptyTitle: string;
  emptyDescription: string;
  onCreate: () => void;
}) {
  return (
    <section className='flex flex-col gap-4'>
      <div className='flex items-end justify-between gap-3'>
        <div>
          <h2 className='text-xl font-semibold tracking-tight'>{title}</h2>
          <p className='text-muted-foreground mt-1 text-sm'>{description}</p>
        </div>
        <Badge variant='secondary'>{rooms.length} 个</Badge>
      </div>
      {rooms.length ? (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {rooms.map((room) => <RoomCard key={room.id} room={room} />)}
        </div>
      ) : (
        <Empty className='min-h-48 bg-muted/15'>
          <EmptyHeader>
            <EmptyMedia variant='icon'><Icons.teams /></EmptyMedia>
            <EmptyTitle>{emptyTitle}</EmptyTitle>
            <EmptyDescription>{emptyDescription}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant='outline' size='sm' onClick={onCreate}>
              <Icons.add data-icon='inline-start' /> 创建房间
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </section>
  );
}

function RoomCard({ room }: { room: FocusRoomSummary }) {
  return (
    <Card className='group flex h-full flex-col shadow-none transition-transform hover:-translate-y-0.5'>
      <CardHeader>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <CardTitle className='truncate text-lg'>{room.name}</CardTitle>
            <CardDescription className='mt-1 truncate'>房主：{room.hostName}</CardDescription>
          </div>
          <Badge variant={room.isMember ? 'default' : 'outline'}>
            {room.isMember ? '已加入' : room.isPublic ? '公开' : '私密'}
          </Badge>
        </div>
        <CardAction>
          <span className='font-mono text-xs tracking-[0.16em] text-muted-foreground'>{room.joinCode}</span>
        </CardAction>
      </CardHeader>
      <CardContent className='flex flex-1 flex-col gap-4'>
        <div className='flex items-end justify-between gap-3 rounded-lg bg-muted/40 p-3'>
          <div>
            <p className='text-muted-foreground text-xs'>{phaseLabel(room.phase)}</p>
            <p className='mt-1 text-2xl font-semibold tabular-nums'>{formatDuration(room.remainingSeconds)}</p>
          </div>
          <Badge variant='secondary'>{timerLabel(room.timerStatus)}</Badge>
        </div>
        <div className='mt-auto flex items-center justify-between gap-3 text-sm'>
          <span className='text-muted-foreground flex items-center gap-1.5'>
            <Icons.teams /> {room.memberCount}/{room.maxMembers}
          </span>
          <Link href={`/dashboard/focus/${room.id}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            {room.isMember ? '继续专注' : '查看房间'}
            <Icons.arrowRight data-icon='inline-end' />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateRoomDialog({
  open,
  onOpenChange,
  form,
  setForm,
  preset,
  setPreset,
  busy,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: CreateFocusRoomInput;
  setForm: (form: CreateFocusRoomInput) => void;
  preset: string;
  setPreset: (value: string) => void;
  busy: boolean;
  onSubmit: () => void;
}) {
  const applyPreset = (value: string) => {
    const presets: Record<string, Pick<CreateFocusRoomInput, 'workMinutes' | 'shortBreakMinutes' | 'longBreakMinutes'>> = {
      classic: { workMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15 },
      deep: { workMinutes: 50, shortBreakMinutes: 10, longBreakMinutes: 20 },
      custom: { workMinutes: form.workMinutes, shortBreakMinutes: form.shortBreakMinutes, longBreakMinutes: form.longBreakMinutes },
    };
    setPreset(value);
    setForm({ ...form, ...(presets[value] ?? presets.classic) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>创建专注房</DialogTitle>
          <DialogDescription>设置专注节奏，房间码生成后可以发给同学。</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor='focus-room-name'>房间名称</FieldLabel>
            <Input id='focus-room-name' value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder='例如：周三晚自习' maxLength={80} />
          </Field>
          <Field>
            <FieldLabel>房间可见性</FieldLabel>
            <ToggleGroup value={[form.isPublic ? 'public' : 'private']} onValueChange={(value) => value[0] && setForm({ ...form, isPublic: value[0] === 'public' })} variant='outline' spacing={0} className='grid w-full grid-cols-2'>
              <ToggleGroupItem value='public' className='w-full'><Icons.globe data-icon='inline-start' />公开房间</ToggleGroupItem>
              <ToggleGroupItem value='private' className='w-full'><Icons.lock data-icon='inline-start' />私密房间</ToggleGroupItem>
            </ToggleGroup>
            <FieldDescription>{form.isPublic ? '会出现在发现房间中，知道房间码也可以加入。' : '不出现在公开列表，只能通过房间码加入。'}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel>专注节奏</FieldLabel>
            <ToggleGroup value={[preset]} onValueChange={(values) => values[0] && applyPreset(values[0])} variant='outline' spacing={0} className='grid w-full grid-cols-3'>
              <ToggleGroupItem value='classic' className='w-full'>25 / 5</ToggleGroupItem>
              <ToggleGroupItem value='deep' className='w-full'>50 / 10</ToggleGroupItem>
              <ToggleGroupItem value='custom' className='w-full'>自定义</ToggleGroupItem>
            </ToggleGroup>
          </Field>
          <FieldGroup className='grid gap-3 sm:grid-cols-3'>
            <NumberField id='focus-work-minutes' label='专注（分钟）' value={form.workMinutes} onChange={(value) => setForm({ ...form, workMinutes: value })} />
            <NumberField id='focus-short-break' label='短休息' value={form.shortBreakMinutes} onChange={(value) => setForm({ ...form, shortBreakMinutes: value })} />
            <NumberField id='focus-long-break' label='长休息' value={form.longBreakMinutes} onChange={(value) => setForm({ ...form, longBreakMinutes: value })} />
          </FieldGroup>
          <Field>
            <FieldLabel htmlFor='focus-rounds'>几轮后长休息</FieldLabel>
            <Input id='focus-rounds' type='number' min={2} max={8} value={form.roundsBeforeLongBreak} onChange={(event) => setForm({ ...form, roundsBeforeLongBreak: Number(event.target.value) || 4 })} />
          </Field>
          <div className='flex items-center justify-between gap-4 rounded-lg border p-3'>
            <div><p className='text-sm font-medium'>共享专注数据</p><p className='text-muted-foreground mt-1 text-xs'>成员可以看到彼此的专注时长和状态。</p></div>
            <Switch checked={form.shareFocusData} onCheckedChange={(checked) => setForm({ ...form, shareFocusData: checked })} aria-label='共享专注数据' />
          </div>
        </FieldGroup>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={onSubmit} disabled={busy}>{busy ? '创建中' : '创建并进入'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NumberField({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (value: number) => void }) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} type='number' min={1} max={90} value={value} onChange={(event) => onChange(Number(event.target.value) || 1)} />
    </Field>
  );
}

export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
  const seconds = Math.max(0, totalSeconds) % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function phaseLabel(phase: FocusRoomSummary['phase']): string {
  return phase === 'focus' ? '专注时间' : phase === 'short_break' ? '短休息' : '长休息';
}

export function timerLabel(status: FocusRoomSummary['timerStatus']): string {
  return status === 'running' ? '进行中' : status === 'paused' ? '已暂停' : '等待开始';
}
