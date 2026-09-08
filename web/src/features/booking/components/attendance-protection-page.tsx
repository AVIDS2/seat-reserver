'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

import {
  getAttendanceSettings,
  getBookingReservations,
  updateAttendanceSettings,
  type AttendanceSettings
} from '../api/service';
import type { BookingAccount, BookingReservation } from '../types';

export default function AttendanceProtectionPage({
  initialAccounts
}: {
  initialAccounts: BookingAccount[];
}) {
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const [reservations, setReservations] = useState<BookingReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [nextSettings, ...result] = await Promise.all([
        getAttendanceSettings(),
        ...initialAccounts.map((account) =>
          getBookingReservations({ accountId: account.id, serviceType: 'study_room' })
        )
      ]);
      setSettings(nextSettings);
      setReservations(result.flat().filter((item) => ['upcoming', 'active'].includes(item.status)));
      if (showRefresh) toast.success('签到状态已刷新');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '签到保护数据加载失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 60_000);
    return () => window.clearInterval(timer);
    // Account list comes from the authenticated server snapshot for this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAccounts]);

  const toggleProtection = async (checked: boolean) => {
    setSaving(true);
    try {
      const next = await updateAttendanceSettings(checked);
      setSettings(next);
      toast.success(checked ? '签到保护已开启' : '签到保护已关闭');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存签到保护失败');
    } finally {
      setSaving(false);
    }
  };

  const upcoming = useMemo(
    () => reservations.toSorted((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`)),
    [reservations]
  );

  return (
    <PageContainer
      pageTitle='签到保护'
      pageDescription='学校允许提前签到或延后签到时，平台帮你盯住最后窗口。'
      pageHeaderAction={
        <Button variant='outline' onClick={() => void load(true)} disabled={loading || refreshing}>
          <Icons.refresh className={cn(refreshing && 'animate-spin')} data-icon='inline-start' />
          {refreshing ? '刷新中' : '刷新状态'}
        </Button>
      }
    >
      <div className='mx-auto flex w-full max-w-[1080px] flex-col gap-4 sm:gap-5'>
        <Alert>
          <Icons.info />
          <AlertTitle>这项保护默认关闭</AlertTitle>
          <AlertDescription>
            开启后，仅针对自习室预约：学校接口在开始后仍显示未签到时，平台会在允许迟到窗口结束前 1 分钟自动取消，避免产生违约记录。
          </AlertDescription>
        </Alert>

        <div className='grid gap-4 lg:grid-cols-[1.1fr_0.9fr]'>
          <Card id='nextstep-attendance-protection' className='shadow-none'>
            <CardHeader className='border-b'>
              <div className='flex items-start justify-between gap-4'>
                <div>
                  <CardDescription>自习室预约</CardDescription>
                  <CardTitle className='mt-1 flex items-center gap-2 text-xl'>
                    <Icons.shield /> 未签到自动取消
                  </CardTitle>
                </div>
                {settings && (
                  <Switch
                    checked={settings.autoCancelNoShow}
                    onCheckedChange={(checked) => void toggleProtection(checked)}
                    disabled={saving}
                    aria-label='开启未签到自动取消'
                  />
                )}
              </div>
            </CardHeader>
            <CardContent className='grid gap-3 pt-5 sm:grid-cols-3'>
              <Rule label='可提前签到' value={`${settings?.checkInAheadMinutes ?? 30} 分钟`} />
              <Rule label='允许迟到' value={`${settings?.lateAllowedMinutes ?? 15} 分钟`} />
              <Rule label='保护触发' value={`截止前 ${settings?.cancelLeadMinutes ?? 1} 分钟`} />
            </CardContent>
          </Card>

          <Card className='shadow-none'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'><Icons.clock /> 运行方式</CardTitle>
              <CardDescription>每分钟自动检查，不需要你守着页面。</CardDescription>
            </CardHeader>
            <CardContent className='space-y-3 text-sm'>
              <div className='flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2'>
                <span className='text-muted-foreground'>学校状态来源</span>
                <Badge variant='outline'>预约历史接口</Badge>
              </div>
              <div className='flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2'>
                <span className='text-muted-foreground'>保护范围</span>
                <span className='font-medium'>仅自习室</span>
              </div>
              <p className='text-muted-foreground text-xs leading-5'>图书馆规则可能不同，暂不自动取消图书馆预约；你仍可在“我的预约”中手动取消。</p>
            </CardContent>
          </Card>
        </div>

        <Card className='shadow-none'>
          <CardHeader className='flex flex-row items-center justify-between gap-3'>
            <div>
              <CardTitle>待签到预约</CardTitle>
              <CardDescription>状态来自学校接口，平台不会伪造签到成功。</CardDescription>
            </div>
            <Badge variant='secondary'>{upcoming.length} 条</Badge>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className='grid gap-3 sm:grid-cols-2'>
                <Skeleton className='h-28 rounded-lg' />
                <Skeleton className='h-28 rounded-lg' />
              </div>
            ) : initialAccounts.length === 0 ? (
              <EmptyState title='还没有学校账号' description='先连接账号，平台才能读取预约和签到状态。' actionHref='/dashboard/accounts' actionLabel='去连接账号' />
            ) : upcoming.length === 0 ? (
              <EmptyState title='当前没有待签到预约' description='新预约会在这里显示，保护状态也会跟着更新。' actionHref='/dashboard/seats' actionLabel='去座位图' />
            ) : (
              <div className='grid gap-3 sm:grid-cols-2'>
                {upcoming.map((reservation) => (
                  <ReservationAttendanceCard key={`${reservation.accountId}-${reservation.id}`} reservation={reservation} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className='flex flex-wrap items-center gap-2 text-sm'>
          <Link href='/dashboard/reservations' className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <Icons.calendar data-icon='inline-start' /> 查看全部预约
          </Link>
          <Link href='/dashboard/notifications' className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            查看保护通知 <Icons.arrowRight data-icon='inline-end' />
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}

function Rule({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-lg border bg-muted/20 p-3'>
      <p className='text-muted-foreground text-xs'>{label}</p>
      <p className='mt-1 font-medium tabular-nums'>{value}</p>
    </div>
  );
}

function ReservationAttendanceCard({ reservation }: { reservation: BookingReservation }) {
  return (
    <div className='rounded-lg border p-4'>
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <p className='truncate font-medium'>{reservation.location}</p>
          <p className='text-muted-foreground mt-1 text-xs'>{reservation.account} · {reservation.date}</p>
        </div>
        <Badge variant={reservation.checkedIn ? 'default' : 'secondary'}>{reservation.checkedIn ? '已签到' : '待签到'}</Badge>
      </div>
      <Separator className='my-3' />
      <div className='flex items-center justify-between gap-3 text-sm'>
        <span className='text-muted-foreground'>预约时段</span>
        <span className='font-medium tabular-nums'>{reservation.startTime} - {reservation.endTime}</span>
      </div>
      <p className='text-muted-foreground mt-2 text-xs'>允许提前 30 分钟签到，最晚可迟到 15 分钟。</p>
    </div>
  );
}

function EmptyState({
  title,
  description,
  actionHref,
  actionLabel
}: {
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className='rounded-lg border border-dashed p-6 text-center'>
      <Icons.shield className='text-muted-foreground mx-auto size-6' />
      <p className='mt-2 font-medium'>{title}</p>
      <p className='text-muted-foreground mt-1 text-sm'>{description}</p>
      <Link href={actionHref} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-4')}>
        {actionLabel} <Icons.arrowRight data-icon='inline-end' />
      </Link>
    </div>
  );
}
