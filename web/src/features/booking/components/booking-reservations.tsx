'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
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
import { Card, CardContent } from '@/components/ui/card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@/components/ui/empty';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { useCampusWorkspace } from '@/features/campus/campus-workspace';

import { cancelBookingReservation, getBookingReservations } from '../api/service';
import type { BookingAccount, BookingReservation, ReservationStatus, VenueType } from '../types';

type ServiceFilter = 'all' | VenueType;
type StatusFilter = 'today' | 'upcoming' | 'history' | 'all';

export default function BookingReservationsPage({
  initialAccounts
}: {
  initialAccounts: BookingAccount[];
}) {
  const [reservations, setReservations] = useState<BookingReservation[]>([]);
  const { activeCampus } = useCampusWorkspace();
  const scopedAccounts = useMemo(
    () =>
      activeCampus === 'all'
        ? initialAccounts
        : initialAccounts.filter((account) => (account.schoolCode || 'cczu') === activeCampus),
    [activeCampus, initialAccounts]
  );
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('today');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [cancelTarget, setCancelTarget] = useState<BookingReservation | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const loadReservations = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    const requests = scopedAccounts.flatMap((account) => {
      const services = account.services
        .filter((service) => service.status === 'connected' || service.status === 'recovering')
        .map((service) => service.type);
      return services.map((serviceType) => ({
        account,
        serviceType,
        request: getBookingReservations({ accountId: account.id, serviceType }, { refresh: showRefresh })
      }));
    });
    const results = await Promise.allSettled(requests.map((item) => item.request));
    const nextReservations = results.flatMap((result) =>
      result.status === 'fulfilled' ? result.value : []
    );
    const nextErrors = results.flatMap((result, index) =>
      result.status === 'rejected'
        ? [`${requests[index]?.account.label || '账号'} · ${requests[index]?.serviceType === 'library' ? '图书馆' : '自习室'}：${result.reason instanceof Error ? result.reason.message : '记录暂时不可用'}`]
        : []
    );
    setReservations(sortReservations(nextReservations));
    setErrors(Array.from(new Set(nextErrors)));
    if (showRefresh) toast.success('预约记录已刷新');
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    void loadReservations();
    // The account list is a server snapshot for this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedAccounts]);

  const today = todayDate();
  const todayReservations = useMemo(
    () => reservations.filter((reservation) => reservation.date === today),
    [reservations, today]
  );
  const upcomingReservations = useMemo(
    () => reservations.filter((reservation) => ['upcoming', 'active'].includes(reservation.status) && reservation.date >= today),
    [reservations, today]
  );
  const historyReservations = useMemo(
    () => reservations.filter((reservation) => ['completed', 'cancelled'].includes(reservation.status) || reservation.date < today),
    [reservations, today]
  );
  const filteredReservations = useMemo(() => reservations.filter((reservation) => {
    const matchesService = serviceFilter === 'all' || reservation.venueType === serviceFilter;
    const matchesStatus =
      statusFilter === 'today'
        ? reservation.date === today
        : statusFilter === 'upcoming'
          ? ['upcoming', 'active'].includes(reservation.status) && reservation.date >= today
          : statusFilter === 'history'
            ? ['completed', 'cancelled'].includes(reservation.status) || reservation.date < today
            : true;
    return matchesService && matchesStatus;
  }), [reservations, serviceFilter, statusFilter, today]);

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const cancelled = await cancelBookingReservation({
        reservationId: cancelTarget.id,
        accountId: cancelTarget.accountId,
        serviceType: cancelTarget.venueType
      });
      setReservations((current) =>
        sortReservations(
          current.map((item) =>
            item.id === cancelled.id && item.accountId === cancelled.accountId ? cancelled : item
          )
        )
      );
      toast.success('预约已取消');
      setCancelTarget(null);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : '取消预约失败');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <PageContainer>
      <div className='mx-auto flex w-full max-w-[1440px] flex-col gap-5 sm:gap-6'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
          <div className='min-w-0'>
            <p className='text-muted-foreground mb-2 text-sm'>学校服务</p>
            <h1 className='text-2xl font-semibold tracking-tight sm:text-3xl'>我的预约</h1>
            <p className='text-muted-foreground mt-2 max-w-2xl text-sm leading-6'>
              先看今天的预约，再按需查看待使用和历史记录。数据来自已连接的学校服务。
            </p>
          </div>
          <Button
            variant='outline'
            onClick={() => void loadReservations(true)}
            disabled={loading || refreshing}
          >
            <Icons.refresh className={cn(refreshing && 'animate-spin')} data-icon='inline-start' />
            {refreshing ? '刷新中' : '刷新记录'}
          </Button>
        </div>

        {scopedAccounts.length === 0 ? (
          <Alert>
            <Icons.warning />
            <AlertTitle>还没有接入学校账号</AlertTitle>
            <AlertDescription>
              <Link href='/dashboard/accounts' className='underline underline-offset-4'>
                前往账号与授权
              </Link>{' '}
              完成验证后，这里会显示你的预约记录。
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
              <SummaryCard label='今天' value={todayReservations.length} detail='今日预约记录' active={statusFilter === 'today'} onClick={() => setStatusFilter('today')} />
              <SummaryCard label='待使用' value={upcomingReservations.length} detail='尚未开始的预约' active={statusFilter === 'upcoming'} onClick={() => setStatusFilter('upcoming')} />
              <SummaryCard label='历史' value={historyReservations.length} detail='已完成或已取消' active={statusFilter === 'history'} onClick={() => setStatusFilter('history')} />
              <SummaryCard label='已加载' value={reservations.length} detail='已连接服务返回' active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
            </div>

            <Card className='shadow-none'>
              <CardContent className='flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between'>
                <ToggleGroup
                  value={[statusFilter]}
                  onValueChange={(values) => values[0] && setStatusFilter(values[0] as StatusFilter)}
                  variant='outline'
                  spacing={0}
                  className='grid w-full grid-cols-4 sm:w-fit'
                  aria-label='选择预约记录视图'
                >
                  <ToggleGroupItem value='today'>今天</ToggleGroupItem>
                  <ToggleGroupItem value='upcoming'>待使用</ToggleGroupItem>
                  <ToggleGroupItem value='history'>历史</ToggleGroupItem>
                  <ToggleGroupItem value='all'>全部</ToggleGroupItem>
                </ToggleGroup>
                <div className='grid grid-cols-2 gap-2 sm:flex'>
                <Select
                  value={serviceFilter}
                  onValueChange={(value) => value && setServiceFilter(value as ServiceFilter)}
                >
                  <SelectTrigger className='w-full sm:w-32' aria-label='筛选预约系统'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>预约系统</SelectLabel>
                      <SelectItem value='all'>全部系统</SelectItem>
                      <SelectItem value='study_room'>自习室</SelectItem>
                      <SelectItem value='library'>图书馆</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              </CardContent>
            </Card>

            {errors.length > 0 && (
              <Alert>
                <Icons.info />
                <AlertTitle>部分记录未加载</AlertTitle>
                <AlertDescription>{errors.join('；')}</AlertDescription>
              </Alert>
            )}

            {loading ? (
              <div className='grid gap-3 md:grid-cols-2'>
                {[1, 2, 3, 4].map((item) => (
                  <Skeleton key={item} className='h-44 rounded-lg' />
                ))}
              </div>
            ) : filteredReservations.length === 0 ? (
              <Empty className='min-h-64'>
                <EmptyHeader>
                  <EmptyMedia variant='icon'>
                    <Icons.history />
                  </EmptyMedia>
                  <EmptyTitle>没有匹配的预约</EmptyTitle>
                  <EmptyDescription>{emptyDescription(statusFilter)}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Link href='/dashboard/seats' className={buttonVariants({ variant: 'outline' })}>
                    <Icons.mapPin data-icon='inline-start' />
                    去座位图
                  </Link>
                </EmptyContent>
              </Empty>
            ) : (
              <div className='grid gap-3 md:grid-cols-2'>
                {filteredReservations.map((reservation) => (
                  <ReservationCard
                    key={`${reservation.accountId}-${reservation.venueType}-${reservation.id}`}
                    reservation={reservation}
                    onCancel={() => setCancelTarget(reservation)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>取消这条预约？</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget &&
                `${cancelTarget.date} · ${cancelTarget.startTime}-${cancelTarget.endTime} · ${cancelTarget.location}`}
              。取消后学校座位会重新进入可预约状态。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>保留预约</AlertDialogCancel>
            <AlertDialogAction disabled={cancelling} onClick={() => void confirmCancel()}>
              {cancelling ? '取消中…' : '确认取消'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}

function ReservationCard({
  reservation,
  onCancel
}: {
  reservation: BookingReservation;
  onCancel: () => void;
}) {
  return (
    <article className='flex min-w-0 flex-col gap-4 rounded-lg border bg-card p-4'>
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <div className='flex flex-wrap items-center gap-2'>
            <Badge variant='outline'>{reservation.venueLabel}</Badge>
            <Badge variant={reservationStatusVariant(reservation.status)}>
              {reservation.statusLabel}
            </Badge>
            {reservation.checkedIn && (
              <Badge variant='default'>
                <Icons.check data-icon='inline-start' /> 已签到
              </Badge>
            )}
          </div>
          <p className='mt-3 truncate text-sm font-medium'>{reservation.location}</p>
          <p className='text-muted-foreground mt-1 text-xs'>账号：{reservation.account}</p>
        </div>
        {reservation.canCancel && (
          <Button variant='ghost' size='sm' className='text-destructive' onClick={onCancel}>
            <Icons.close data-icon='inline-start' />
            取消
          </Button>
        )}
      </div>
      <div className='grid grid-cols-2 gap-3 border-t pt-3 text-sm'>
        <div>
          <p className='text-muted-foreground text-xs'>日期</p>
          <p className='mt-1 font-medium'>{formatDate(reservation.date)}</p>
        </div>
        <div>
          <p className='text-muted-foreground text-xs'>时间</p>
          <p className='mt-1 font-medium tabular-nums'>
            {reservation.startTime} - {reservation.endTime}
          </p>
        </div>
      </div>
      {reservation.receipt && (
        <p className='text-muted-foreground text-xs'>回执 {reservation.receipt}</p>
      )}
    </article>
  );
}

function reservationStatusVariant(
  status: ReservationStatus
): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'active') return 'default';
  if (status === 'upcoming') return 'secondary';
  if (status === 'cancelled') return 'outline';
  return 'outline';
}

function sortReservations(items: BookingReservation[]): BookingReservation[] {
  return [...items].toSorted((a, b) =>
    `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`)
  );
}

function formatDate(value: string): string {
  if (!value) return '日期未知';
  return new Date(`${value}T00:00:00+08:00`).toLocaleDateString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  });
}

function SummaryCard({
  label,
  value,
  detail,
  active,
  onClick
}: {
  label: string;
  value: number;
  detail: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={cn('bg-card text-left transition-colors', active ? 'border-primary ring-ring/30 rounded-lg border p-4 ring-2' : 'rounded-lg border p-4 hover:bg-muted/30')}
    >
      <p className='text-muted-foreground text-xs'>{label}</p>
      <p className='mt-1 text-2xl font-semibold tabular-nums'>{value}</p>
      <p className='text-muted-foreground mt-1 text-xs'>{detail}</p>
    </button>
  );
}

function todayDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function emptyDescription(status: StatusFilter): string {
  if (status === 'today') return '今天还没有预约记录。可以去座位图查看实时空间。';
  if (status === 'upcoming') return '当前没有待使用的预约。';
  if (status === 'history') return '还没有历史预约记录。';
  return '已连接服务返回的预约记录会显示在这里。';
}
