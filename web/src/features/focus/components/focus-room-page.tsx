'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { ProfileAvatar, ProfileTitlePill } from '@/components/profile/profile-avatar';
import PageContainer from '@/components/layout/page-container';
import { StarryPanel } from '@/components/ui/starry-panel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

import {
  closeFocusRoom,
  focusRoomTimerAction,
  getFocusRoom,
  heartbeatFocusRoom,
  joinFocusRoom,
  leaveFocusRoom,
  setFocusPresence
} from '../api/service';
import type { FocusRoom, FocusRoomMember } from '../types';
import { FocusTimerRing } from './focus-timer-ring';
import { formatDuration, phaseLabel, timerLabel } from './focus-room-lobby';

type ConfirmAction = 'leave' | 'close' | null;

export default function FocusRoomPage({ initialRoom }: { initialRoom: FocusRoom }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [room, setRoom] = useState(initialRoom);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const serverOffset = new Date(room.serverTime).getTime() - Date.now();
  const remaining = useMemo(
    () => getRemainingSeconds(room, now + serverOffset),
    [now, room, serverOffset]
  );
  const duration = phaseDuration(room);
  const progress = Math.min(100, Math.max(0, ((duration - remaining) / duration) * 100));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void getFocusRoom(room.id)
        .then((next) => active && setRoom(next))
        .catch(() => undefined);
    };
    const timer = window.setInterval(refresh, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [room.id]);

  useEffect(() => {
    if (!room.isMember) return;
    let active = true;
    const heartbeat = () => {
      void heartbeatFocusRoom(room.id)
        .then((next) => active && setRoom(next))
        .catch(() => undefined);
    };
    const timer = window.setInterval(heartbeat, 15_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [room.id, room.isMember]);

  const runTimerAction = async (action: 'start' | 'pause' | 'reset') => {
    setBusy(`timer:${action}`);
    try {
      setRoom(await focusRoomTimerAction(room.id, action));
      toast.success(
        action === 'start' ? '专注开始' : action === 'pause' ? '计时已暂停' : '计时已重置'
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '计时操作失败');
    } finally {
      setBusy(null);
    }
  };

  const toggleFocus = async (focused: boolean) => {
    setBusy('presence');
    try {
      setRoom(await setFocusPresence(room.id, focused));
      toast.success(focused ? '已加入专注' : '已暂停个人专注');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新专注状态失败');
    } finally {
      setBusy(null);
    }
  };

  const join = async () => {
    setBusy('join');
    try {
      setRoom(await joinFocusRoom(room.joinCode));
      toast.success('已加入房间');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '加入房间失败');
    } finally {
      setBusy(null);
    }
  };

  const confirmActionAndLeave = async () => {
    if (!confirmAction) return;
    const action = confirmAction;
    setBusy(action);
    try {
      if (action === 'leave') {
        await leaveFocusRoom(room.id);
        toast.success('已离开房间');
      } else {
        await closeFocusRoom(room.id);
        toast.success('房间已结束');
      }
      router.push('/dashboard/focus');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '操作失败');
    } finally {
      setBusy(null);
      setConfirmAction(null);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.joinCode);
      toast.success('房间码已复制');
    } catch {
      toast.error(`房间码：${room.joinCode}`);
    }
  };

  return (
    <PageContainer
      pageHeaderAction={
        <Link
          href='/dashboard/focus'
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <Icons.chevronLeft data-icon='inline-start' /> 返回房间
        </Link>
      }
    >
      <div className='mx-auto flex w-full max-w-[1180px] flex-col gap-5 sm:gap-6'>
        <StarryPanel contentClassName='flex flex-col gap-5 p-5 sm:p-7'>
          <motion.div
            aria-hidden='true'
            className='pointer-events-none absolute inset-x-0 top-0 h-px bg-primary/70'
            animate={reduceMotion ? undefined : { opacity: [0.45, 1, 0.45] }}
            transition={
              reduceMotion ? undefined : { duration: 2.8, repeat: Infinity, ease: 'easeInOut' }
            }
          />
          <div className='relative flex flex-col gap-5'>
            <div className='flex flex-wrap items-start justify-between gap-4'>
              <div className='min-w-0'>
                <div className='flex flex-wrap items-center gap-2'>
                  <Badge className='border-background/15 bg-background/10 text-background'>
                    <Icons.clock data-icon='inline-start' /> {phaseLabel(room.timer.phase)}
                  </Badge>
                  <Badge className='border-background/15 bg-background/10 text-background'>
                    {room.isPublic ? '公开房间' : '私密房间'}
                  </Badge>
                </div>
                <h1 className='mt-4 truncate text-2xl font-semibold tracking-tight sm:text-4xl'>
                  {room.name}
                </h1>
                <p className='mt-2 text-sm text-background/60'>
                  房主：{room.hostName} · {room.memberCount}/{room.maxMembers} 人
                </p>
              </div>
              <button
                type='button'
                onClick={() => void copyCode()}
                className='flex shrink-0 items-center gap-2 rounded-lg border border-background/15 bg-background/10 px-3 py-2 font-mono text-sm tracking-[0.18em] text-background transition-colors hover:bg-background/15'
                aria-label={`复制房间码 ${room.joinCode}`}
              >
                {room.joinCode}
                <Icons.copy />
              </button>
            </div>
            <div className='grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end'>
              <div>
                <p className='text-xs uppercase tracking-[0.18em] text-background/50'>当前状态</p>
                <p className='mt-2 text-sm text-background/75'>
                  {timerLabel(room.timer.status)} · 已完成 {room.timer.completedRounds} 轮
                </p>
                <p className='text-muted-foreground mt-4 text-xs'>
                  房主控制房间节奏，你可以单独标记自己的专注状态。
                </p>
              </div>
              <FocusTimerRing
                progress={progress}
                waiting={room.timer.status === 'idle'}
                paused={room.timer.status === 'paused'}
                ariaLabel={`剩余 ${formatDuration(remaining)}`}
              >
                <div className='flex items-end gap-2' role='timer' aria-live='polite'>
                  <TimerDigit
                    value={formatDuration(remaining).slice(0, 2)}
                    label='分钟'
                    reduceMotion={reduceMotion}
                  />
                  <span className='pb-7 font-mono text-3xl text-primary/75'>:</span>
                  <TimerDigit
                    value={formatDuration(remaining).slice(3)}
                    label='秒'
                    reduceMotion={reduceMotion}
                  />
                </div>
              </FocusTimerRing>
            </div>
            {room.isHost && (
              <div className='flex flex-wrap gap-2'>
                <Button
                  onClick={() => void runTimerAction('start')}
                  disabled={busy !== null || room.timer.status === 'running'}
                >
                  <Icons.play data-icon='inline-start' /> 开始
                </Button>
                <Button
                  variant='secondary'
                  onClick={() => void runTimerAction('pause')}
                  disabled={busy !== null || room.timer.status !== 'running'}
                >
                  <Icons.pause data-icon='inline-start' /> 暂停
                </Button>
                <Button
                  variant='ghost'
                  className='text-background hover:bg-background/10 hover:text-background'
                  onClick={() => void runTimerAction('reset')}
                  disabled={busy !== null}
                >
                  <Icons.refresh data-icon='inline-start' /> 重置
                </Button>
              </div>
            )}
          </div>
        </StarryPanel>

        {!room.isMember && (
          <Alert>
            <Icons.teams />
            <AlertTitle>这是一个公开房间</AlertTitle>
            <AlertDescription className='flex flex-wrap items-center justify-between gap-3'>
              <span>加入后可以显示你的专注状态，并参与房间排行。</span>
              <Button size='sm' onClick={() => void join()} disabled={busy !== null}>
                <Icons.login data-icon='inline-start' /> {busy === 'join' ? '加入中' : '加入房间'}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className='grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.72fr)]'>
          <Card className='shadow-none'>
            <CardHeader className='border-b'>
              <div className='flex items-start justify-between gap-3'>
                <div>
                  <CardDescription>安静陪伴</CardDescription>
                  <CardTitle className='mt-1 flex items-center gap-2 text-xl'>
                    <Icons.teams /> 房间成员
                  </CardTitle>
                </div>
                <Badge variant='secondary'>{room.members.length} 人</Badge>
              </div>
            </CardHeader>
            <CardContent className='flex flex-col gap-2 pt-4'>
              {room.members.map((member, index) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  rank={index + 1}
                  currentUserId={room.currentUser?.userId}
                  shareFocusData={room.shareFocusData}
                />
              ))}
            </CardContent>
          </Card>

          <div className='flex flex-col gap-5'>
            {room.isMember && (
              <Card className='shadow-none'>
                <CardHeader className='border-b'>
                  <CardDescription>我的状态</CardDescription>
                  <CardTitle className='mt-1 text-xl'>加入这一轮专注</CardTitle>
                </CardHeader>
                <CardContent className='flex flex-col gap-4 pt-5'>
                  <div className='flex items-center justify-between gap-4 rounded-lg bg-muted/40 p-3'>
                    <div>
                      <p className='text-sm font-medium'>
                        {room.currentUser?.isFocused ? '我正在专注' : '我还没有开始'}
                      </p>
                      <p className='text-muted-foreground mt-1 text-xs'>
                        累计 {room.currentUser?.focusMinutesLabel || '0 分钟'}
                      </p>
                    </div>
                    <Switch
                      checked={Boolean(room.currentUser?.isFocused)}
                      onCheckedChange={(checked) => void toggleFocus(checked)}
                      disabled={busy !== null}
                      aria-label='切换个人专注状态'
                    />
                  </div>
                  <p className='text-muted-foreground text-xs leading-5'>
                    房间计时由房主控制，你可以独立标记自己的专注状态。
                  </p>
                </CardContent>
              </Card>
            )}
            <Card className='shadow-none'>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Icons.info /> 房间设置
                </CardTitle>
                <CardDescription>本房间的专注节奏。</CardDescription>
              </CardHeader>
              <CardContent className='grid grid-cols-2 gap-3 text-sm'>
                <Setting label='专注' value={`${room.settings.workMinutes} 分钟`} />
                <Setting label='短休息' value={`${room.settings.shortBreakMinutes} 分钟`} />
                <Setting label='长休息' value={`${room.settings.longBreakMinutes} 分钟`} />
                <Setting label='长休息间隔' value={`${room.settings.roundsBeforeLongBreak} 轮`} />
                <div className='col-span-2 flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground'>
                  {room.shareFocusData ? <Icons.share /> : <Icons.eyeOff />}
                  {room.shareFocusData ? '成员可以看到彼此的专注时长' : '专注时长仅自己可见'}
                </div>
              </CardContent>
            </Card>
            <div className='flex flex-wrap gap-2'>
              {room.isHost ? (
                <Button
                  variant='outline'
                  className='text-destructive'
                  onClick={() => setConfirmAction('close')}
                  disabled={busy !== null}
                >
                  <Icons.close data-icon='inline-start' /> 结束房间
                </Button>
              ) : room.isMember ? (
                <Button
                  variant='outline'
                  className='text-destructive'
                  onClick={() => setConfirmAction('leave')}
                  disabled={busy !== null}
                >
                  <Icons.logout data-icon='inline-start' /> 离开房间
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'close' ? '结束这个房间？' : '离开这个房间？'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'close'
                ? '结束后房间码失效，成员将无法继续加入。'
                : '离开后不会删除你的专注记录，之后仍可凭房间码重新加入。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmActionAndLeave()}>
              {confirmAction === 'close' ? '结束房间' : '确认离开'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}

function TimerDigit({
  value,
  label,
  reduceMotion
}: {
  value: string;
  label: string;
  reduceMotion: boolean | null;
}) {
  return (
    <div className='flex flex-col gap-1'>
      <motion.span
        key={value}
        initial={reduceMotion ? false : { opacity: 0.4, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16 }}
        className='font-mono text-6xl font-semibold leading-none tabular-nums text-background sm:text-8xl'
      >
        {value}
      </motion.span>
      <span className='text-xs text-background/45'>{label}</span>
    </div>
  );
}

function MemberRow({
  member,
  rank,
  currentUserId,
  shareFocusData
}: {
  member: FocusRoomMember;
  rank: number;
  currentUserId?: string;
  shareFocusData: boolean;
}) {
  const online = Date.now() - new Date(member.lastSeenAt).getTime() <= 60_000;
  const isCurrent = member.userId === currentUserId;
  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-3 rounded-lg border p-3',
        isCurrent && 'border-primary/40 bg-primary/[0.04]'
      )}
    >
      <span className='text-muted-foreground w-6 shrink-0 text-center font-mono text-xs tabular-nums'>
        #{rank}
      </span>
      <ProfileAvatar
        avatarUrl={member.avatarUrl}
        name={member.displayName}
        size='default'
        showStatus={online}
      />
      <div className='min-w-0 flex-1'>
        <div className='flex min-w-0 items-center gap-2'>
          <p className='truncate text-sm font-medium'>{member.displayName}</p>
          {member.isHost && (
            <Badge variant='secondary' className='shrink-0'>
              房主
            </Badge>
          )}
          {isCurrent && (
            <Badge variant='default' className='shrink-0'>
              你
            </Badge>
          )}
        </div>
        <div className='mt-1 flex min-w-0 items-center gap-1.5'>
          <ProfileTitlePill
            title={member.titleLabel}
            className='max-w-[9rem] truncate text-[10px]'
          />
          <span className='text-muted-foreground truncate text-xs'>{member.badgeLabel}</span>
        </div>
      </div>
      <div className='shrink-0 text-right'>
        {member.focusSeconds === null ? (
          <p className='text-muted-foreground text-xs'>不公开</p>
        ) : (
          <p className='text-sm font-medium tabular-nums'>{member.focusMinutesLabel}</p>
        )}
        <p
          className={cn(
            'mt-1 text-xs',
            member.isFocused ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          {member.isFocused === null
            ? shareFocusData
              ? '离线'
              : '仅本人可见'
            : member.isFocused
              ? '专注中'
              : '休息中'}
        </p>
      </div>
    </div>
  );
}

function Setting({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-lg bg-muted/40 p-3'>
      <p className='text-muted-foreground text-xs'>{label}</p>
      <p className='mt-1 font-medium tabular-nums'>{value}</p>
    </div>
  );
}

function getRemainingSeconds(room: FocusRoom, now: number): number {
  if (room.timer.status === 'running' && room.timer.phaseEndsAt)
    return Math.max(0, Math.ceil((new Date(room.timer.phaseEndsAt).getTime() - now) / 1000));
  return room.timer.remainingSeconds;
}

function phaseDuration(room: FocusRoom): number {
  if (room.timer.phase === 'long_break') return room.settings.longBreakMinutes * 60;
  if (room.timer.phase === 'short_break') return room.settings.shortBreakMinutes * 60;
  return room.settings.workMinutes * 60;
}
