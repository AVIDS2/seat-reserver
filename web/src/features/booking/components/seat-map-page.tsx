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
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

import {
  bookBookingReservation,
  createBookingCaptchaChallenge,
  getSeatCatalog,
  getSeatLayout,
  getSeatTimes,
  verifyBookingCaptchaChallenge
} from '../api/service';
import type {
  BookingAccount,
  BookingCaptchaChallenge,
  SeatCatalog,
  SeatLayout,
  SeatTimes,
  VenueType
} from '../types';
import { LibraryCaptchaDialog } from './library-captcha-dialog';
import { SeatMapPicker } from './seat-map-picker';
import { getSchoolAvailabilityNotice } from './school-status';

type InstantBookingInput = {
  accountId: string;
  serviceType: VenueType;
  seatId: string;
  date: string;
  startTime: number;
  endTime: number;
};

export default function SeatMapPage({ initialAccounts }: { initialAccounts: BookingAccount[] }) {
  const [accountId, setAccountId] = useState(initialAccounts[0]?.id || '');
  const [venueType, setVenueType] = useState<VenueType>('study_room');
  const [buildingId, setBuildingId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [date, setDate] = useState('');
  const [catalog, setCatalog] = useState<SeatCatalog | null>(null);
  const [layout, setLayout] = useState<SeatLayout | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [layoutLoading, setLayoutLoading] = useState(false);
  const [error, setError] = useState('');
  const [instantOpen, setInstantOpen] = useState(false);
  const [instantConfirmOpen, setInstantConfirmOpen] = useState(false);
  const [instantSeatId, setInstantSeatId] = useState('');
  const [instantTimes, setInstantTimes] = useState<SeatTimes>({
    startTimes: [],
    endTimes: []
  });
  const [instantStartTime, setInstantStartTime] = useState('');
  const [instantEndTime, setInstantEndTime] = useState('');
  const [instantLoading, setInstantLoading] = useState(false);
  const [instantSubmitting, setInstantSubmitting] = useState(false);
  const [instantError, setInstantError] = useState('');
  const [captchaOpen, setCaptchaOpen] = useState(false);
  const [captchaChallenge, setCaptchaChallenge] = useState<BookingCaptchaChallenge | null>(null);
  const [captchaBooking, setCaptchaBooking] = useState<InstantBookingInput | null>(null);
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [captchaError, setCaptchaError] = useState('');

  useEffect(() => {
    if (!accountId) {
      setCatalog(null);
      setLayout(null);
      setBuildingId('');
      setRoomId('');
      setDate('');
      return;
    }

    let cancelled = false;
    setCatalogLoading(true);
    setCatalog(null);
    setLayout(null);
    setSelectedIds([]);
    setError('');

    void getSeatCatalog(accountId, venueType)
      .then((nextCatalog) => {
        if (cancelled) return;
        const nextBuildingId = nextCatalog.buildings[0]?.id || '';
        const nextRoom = nextCatalog.rooms.find((room) => room.buildingId === nextBuildingId);
        setCatalog(nextCatalog);
        setBuildingId(nextBuildingId);
        setRoomId(nextRoom?.id || '');
        setDate(nextCatalog.dates[0] || '');
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : '场馆目录加载失败');
      })
      .finally(() => !cancelled && setCatalogLoading(false));

    return () => {
      cancelled = true;
    };
  }, [accountId, venueType]);

  const rooms = useMemo(
    () => catalog?.rooms.filter((room) => room.buildingId === buildingId) ?? [],
    [buildingId, catalog]
  );
  const selectedBuilding = catalog?.buildings.find((building) => building.id === buildingId);
  const selectedRoom = catalog?.rooms.find((room) => room.id === roomId);
  const catalogNotice = getSchoolAvailabilityNotice(error);
  const seatStats = useMemo(() => {
    const seats = layout?.nodes.filter((node) => node.kind === 'seat') ?? [];
    return {
      total: seats.length,
      available: seats.filter((seat) => seat.status === 'available').length,
      reserved: seats.filter((seat) => seat.status === 'reserved').length,
      mine: seats.filter((seat) => seat.status === 'mine').length
    };
  }, [layout]);

  useEffect(() => {
    if (!accountId || !roomId || !date) return;
    let cancelled = false;
    setLayoutLoading(true);
    setLayout(null);
    setSelectedIds([]);
    setError('');

    void getSeatLayout({ accountId, serviceType: venueType, roomId, date })
      .then((nextLayout) => {
        if (!cancelled) setLayout(nextLayout);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : '座位图加载失败');
      })
      .finally(() => !cancelled && setLayoutLoading(false));

    return () => {
      cancelled = true;
    };
  }, [accountId, date, roomId, venueType]);

  const changeBuilding = (nextBuildingId: string | null) => {
    if (!nextBuildingId) return;
    const nextRoom = catalog?.rooms.find((room) => room.buildingId === nextBuildingId);
    setBuildingId(nextBuildingId);
    setRoomId(nextRoom?.id || '');
    setLayout(null);
    setSelectedIds([]);
  };

  const changeRoom = (nextRoomId: string | null) => {
    if (!nextRoomId) return;
    setRoomId(nextRoomId);
    setLayout(null);
    setSelectedIds([]);
  };

  const refreshLayout = () => {
    if (!accountId || !roomId || !date) return;
    setLayoutLoading(true);
    setError('');
    void getSeatLayout({ accountId, serviceType: venueType, roomId, date }, { refresh: true })
      .then(setLayout)
      .catch((reason) => setError(reason instanceof Error ? reason.message : '座位图刷新失败'))
      .finally(() => setLayoutLoading(false));
  };

  const taskHref = useMemo(() => {
    if (!accountId || !buildingId || !roomId || !selectedIds.length) {
      return '/dashboard/tasks';
    }
    const params = new URLSearchParams({
      accountId,
      serviceType: venueType,
      buildingId,
      roomId,
      seatIds: selectedIds.join(',')
    });
    return `/dashboard/tasks?${params.toString()}`;
  }, [accountId, buildingId, roomId, selectedIds, venueType]);

  const loadInstantTimes = async (seatId: string) => {
    if (!accountId || !date) return;
    setInstantSeatId(seatId);
    setInstantTimes({ startTimes: [], endTimes: [] });
    setInstantStartTime('');
    setInstantEndTime('');
    setInstantError('');
    setInstantLoading(true);
    try {
      const times = await getSeatTimes({
        accountId,
        serviceType: venueType,
        roomId,
        seatId,
        date
      });
      setInstantTimes(times);
      const firstStart = times.startTimes[0]?.id || '';
      setInstantStartTime(firstStart);
      if (firstStart) {
        const endTimes = await getSeatTimes({
          accountId,
          serviceType: venueType,
          roomId,
          seatId,
          date,
          startTime: firstStart
        });
        setInstantTimes((current) => ({
          ...current,
          endTimes: endTimes.endTimes
        }));
        setInstantEndTime(endTimes.endTimes[0]?.id || '');
      }
    } catch (reason) {
      setInstantError(reason instanceof Error ? reason.message : '可预约时段加载失败');
    } finally {
      setInstantLoading(false);
    }
  };

  const openInstantBooking = () => {
    const seatId = selectedIds[0];
    if (!seatId || selectedIds.length !== 1) {
      toast.error('直接预约请只选择一个座位');
      return;
    }
    setInstantOpen(true);
    void loadInstantTimes(seatId);
  };

  const changeInstantStart = (nextStart: string | null) => {
    if (!nextStart || !accountId || !date || !instantSeatId) return;
    setInstantStartTime(nextStart);
    setInstantEndTime('');
    setInstantError('');
    setInstantLoading(true);
    void getSeatTimes({
      accountId,
      serviceType: venueType,
      roomId,
      seatId: instantSeatId,
      date,
      startTime: nextStart
    })
      .then((times) => {
        setInstantTimes((current) => ({
          ...current,
          endTimes: times.endTimes
        }));
        setInstantEndTime(times.endTimes[0]?.id || '');
      })
      .catch((reason) =>
        setInstantError(reason instanceof Error ? reason.message : '结束时间加载失败')
      )
      .finally(() => setInstantLoading(false));
  };

  const submitInstantBooking = async () => {
    if (!instantSeatId || !instantStartTime || !instantEndTime) return;
    const input: InstantBookingInput = {
      accountId,
      serviceType: venueType,
      seatId: instantSeatId,
      date,
      startTime: Number(instantStartTime),
      endTime: Number(instantEndTime)
    };
    setInstantSubmitting(true);
    try {
      if (venueType === 'library' && catalog?.captchaRequired) {
        const challenge = await createBookingCaptchaChallenge(input);
        setCaptchaBooking(input);
        setCaptchaChallenge(challenge);
        setCaptchaError('');
        setInstantConfirmOpen(false);
        setCaptchaOpen(true);
        return;
      }
      const reservation = await bookBookingReservation(input);
      setInstantConfirmOpen(false);
      setInstantOpen(false);
      toast.success('预约已提交', {
        description: `${reservation.location} · ${reservation.startTime}-${reservation.endTime}`
      });
      refreshLayout();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : '预约提交失败');
    } finally {
      setInstantSubmitting(false);
    }
  };

  const refreshCaptcha = async () => {
    if (!captchaBooking) return;
    setCaptchaLoading(true);
    setCaptchaError('');
    try {
      setCaptchaChallenge(await createBookingCaptchaChallenge(captchaBooking));
    } catch (reason) {
      setCaptchaChallenge(null);
      setCaptchaError(reason instanceof Error ? reason.message : '验证图片加载失败');
    } finally {
      setCaptchaLoading(false);
    }
  };

  const verifyCaptcha = async (points: Array<{ x: number; y: number }>) => {
    if (!captchaChallenge) return;
    setCaptchaLoading(true);
    setCaptchaError('');
    try {
      const reservation = await verifyBookingCaptchaChallenge(captchaChallenge.id, points);
      setCaptchaOpen(false);
      setCaptchaChallenge(null);
      setCaptchaBooking(null);
      setInstantOpen(false);
      toast.success('图书馆预约成功', {
        description: `${reservation.location} · ${reservation.startTime}-${reservation.endTime}`
      });
      refreshLayout();
    } catch (reason) {
      setCaptchaChallenge(null);
      setCaptchaError(reason instanceof Error ? reason.message : '验证失败，请换一张后重试');
    } finally {
      setCaptchaLoading(false);
    }
  };

  return (
    <PageContainer>
      <div className='mx-auto flex w-full max-w-[1440px] flex-col gap-5 sm:gap-6'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
          <div className='min-w-0'>
            <p className='text-muted-foreground mb-2 text-sm'>实时空间</p>
            <h1 className='text-2xl font-semibold tracking-tight sm:text-3xl'>座位图</h1>
            <p className='text-muted-foreground mt-2 max-w-2xl text-sm leading-6'>
              查看学校实时座位状态，按日期、楼栋和空间快速找到合适的位置。
            </p>
          </div>
          <Link href='/dashboard/tasks' className={cn(buttonVariants({ variant: 'outline' }))}>
            <Icons.target data-icon='inline-start' />
            创建预约任务
          </Link>
        </div>

        {initialAccounts.length === 0 ? (
          <Alert>
            <Icons.warning />
            <AlertTitle>先接入学校账号</AlertTitle>
            <AlertDescription>
              <Link href='/dashboard/accounts' className='underline underline-offset-4'>
                前往账号与授权
              </Link>
              ，完成验证后即可查看实时座位图。
            </AlertDescription>
          </Alert>
        ) : (
          <div className='grid min-w-0 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]'>
            <Card className='h-fit shadow-none'>
              <CardHeader className='border-b'>
                <CardDescription>实时筛选</CardDescription>
                <CardTitle className='text-lg'>选择空间</CardTitle>
              </CardHeader>
              <CardContent className='pt-5'>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor='seat-map-account'>使用账号</FieldLabel>
                    <Select
                      value={accountId}
                      items={initialAccounts.map((account) => ({
                        value: account.id,
                        label: account.label
                      }))}
                      onValueChange={(value) => value && setAccountId(value)}
                    >
                      <SelectTrigger id='seat-map-account' className='w-full'>
                        <SelectValue placeholder='选择学校账号' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>学校账号</SelectLabel>
                          {initialAccounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>预约系统</FieldLabel>
                    <ToggleGroup
                      value={[venueType]}
                      onValueChange={(values) => {
                        if (values[0]) setVenueType(values[0] as VenueType);
                      }}
                      variant='outline'
                      spacing={0}
                      className='grid w-full grid-cols-2'
                    >
                      <ToggleGroupItem value='study_room' className='w-full'>
                        自习室
                      </ToggleGroupItem>
                      <ToggleGroupItem value='library' className='w-full'>
                        图书馆
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor='seat-map-building'>
                      {venueType === 'library' ? '馆区' : '楼栋'}
                    </FieldLabel>
                    <Select
                      value={buildingId}
                      items={(catalog?.buildings ?? []).map((building) => ({
                        value: building.id,
                        label: building.name
                      }))}
                      onValueChange={changeBuilding}
                      disabled={!catalog || catalogLoading}
                    >
                      <SelectTrigger id='seat-map-building' className='w-full'>
                        <SelectValue placeholder='选择楼栋' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>{venueType === 'library' ? '馆区' : '楼栋'}</SelectLabel>
                          {catalog?.buildings.map((building) => (
                            <SelectItem key={building.id} value={building.id}>
                              {building.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor='seat-map-room'>空间</FieldLabel>
                    <Select
                      value={roomId}
                      items={rooms.map((room) => ({
                        value: room.id,
                        label: room.name
                      }))}
                      onValueChange={changeRoom}
                      disabled={!rooms.length}
                    >
                      <SelectTrigger id='seat-map-room' className='w-full'>
                        <SelectValue placeholder='选择空间' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>可预约空间</SelectLabel>
                          {rooms.map((room) => (
                            <SelectItem key={room.id} value={room.id}>
                              {room.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldDescription>名称来自学校实时目录。</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor='seat-map-date'>查看日期</FieldLabel>
                    <Select
                      value={date}
                      items={(catalog?.dates ?? []).map((item) => ({
                        value: item,
                        label: formatDateLabel(item)
                      }))}
                      onValueChange={(value) => {
                        if (value) {
                          setDate(value);
                          setSelectedIds([]);
                        }
                      }}
                      disabled={!catalog?.dates.length}
                    >
                      <SelectTrigger id='seat-map-date' className='w-full'>
                        <SelectValue placeholder='选择日期' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>可查看日期</SelectLabel>
                          {catalog?.dates.map((item) => (
                            <SelectItem key={item} value={item}>
                              {formatDateLabel(item)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                </FieldGroup>
                <Button
                  type='button'
                  variant='outline'
                  className='mt-5 w-full'
                  onClick={refreshLayout}
                  disabled={!layout || layoutLoading}
                >
                  <Icons.refresh className={cn(layoutLoading && 'animate-spin')} />
                  {layoutLoading ? '刷新中' : '刷新座位状态'}
                </Button>
              </CardContent>
            </Card>

            <div className='min-w-0 space-y-4'>
              {(error || catalog?.captchaRequired) && (
                <Alert variant={error && !catalogNotice.maintenance ? 'destructive' : 'default'}>
                  {error ? (
                    catalogNotice.maintenance ? (
                      <Icons.clock />
                    ) : (
                      <Icons.warning />
                    )
                  ) : (
                    <Icons.shield />
                  )}
                  <AlertTitle>
                    {error
                      ? catalogNotice.maintenance
                        ? '学校系统维护中'
                        : '实时数据未加载'
                      : '预约前需要验证'}
                  </AlertTitle>
                  <AlertDescription>
                    {error ? catalogNotice.message : '该系统当前开启预约验证，座位状态仍可查看。'}
                  </AlertDescription>
                </Alert>
              )}
              <div className='grid gap-3 sm:grid-cols-4'>
                <Stat label='全部座位' value={seatStats.total} />
                <Stat label='当前可选' value={seatStats.available} tone='success' />
                <Stat label='已预约' value={seatStats.reserved} tone='muted' />
                <Stat label='我的预约' value={seatStats.mine} tone='info' />
              </div>
              <SeatMapPicker
                layout={layout}
                loading={catalogLoading || layoutLoading}
                selectedIds={selectedIds}
                onSelectedIdsChange={setSelectedIds}
                onRefresh={refreshLayout}
                className='w-full'
              />
              <div className='flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between'>
                <div className='min-w-0'>
                  <p className='text-sm font-medium'>已选 {selectedIds.length} 个座位</p>
                  <p className='text-muted-foreground mt-1 text-xs'>
                    自动任务可以把任意真实座位加入候选；直接预约会再读取所选日期的可用时段。
                  </p>
                </div>
                <div className='flex flex-wrap gap-2 sm:justify-end'>
                  <Link
                    href={taskHref}
                    className={cn(
                      buttonVariants({ variant: 'default' }),
                      selectedIds.length === 0 && 'pointer-events-none opacity-50'
                    )}
                    aria-disabled={selectedIds.length === 0}
                  >
                    <Icons.target data-icon='inline-start' />
                    配置自动任务
                  </Link>
                  <Button
                    type='button'
                    variant='outline'
                    onClick={openInstantBooking}
                    disabled={selectedIds.length !== 1 || !date || layoutLoading}
                  >
                    <Icons.calendar data-icon='inline-start' />
                    直接预约
                  </Button>
                </div>
              </div>
              <p className='text-muted-foreground text-xs'>
                {selectedBuilding?.name || '未选择楼栋'}
                {selectedRoom ? ` · ${selectedRoom.name}` : ''}
                {date ? ` · ${formatDateLabel(date)}` : ''}
                {' · 状态来自学校实时座位接口'}
              </p>
            </div>
          </div>
        )}
      </div>

      <Dialog open={instantOpen} onOpenChange={setInstantOpen}>
        <DialogContent className='w-[calc(100%-2rem)] max-w-[480px]'>
          <DialogHeader>
            <DialogTitle>直接预约</DialogTitle>
            <DialogDescription>
              为 {date ? formatDateLabel(date) : '所选日期'} 的座位读取学校实时可用时段。
            </DialogDescription>
          </DialogHeader>
          <div className='flex flex-col gap-4'>
            <div className='rounded-lg bg-muted/40 px-3 py-2 text-sm'>
              <span className='text-muted-foreground'>位置：</span>
              {selectedBuilding?.name || '未选择楼栋'} · {selectedRoom?.name || '未选择空间'} · 座位{' '}
              {layout?.nodes.find((node) => node.id === instantSeatId)?.label || instantSeatId}
            </div>
            {instantError && (
              <Alert variant='destructive'>
                <Icons.warning />
                <AlertTitle>时段读取失败</AlertTitle>
                <AlertDescription>{instantError}</AlertDescription>
              </Alert>
            )}
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor='instant-start-time'>开始时间</FieldLabel>
                <Select
                  value={instantStartTime}
                  items={instantTimes.startTimes.map((item) => ({
                    value: item.id,
                    label: item.label
                  }))}
                  onValueChange={changeInstantStart}
                  disabled={instantLoading || !instantTimes.startTimes.length}
                >
                  <SelectTrigger id='instant-start-time' className='w-full'>
                    <SelectValue placeholder={instantLoading ? '读取中…' : '选择开始时间'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>可用开始时间</SelectLabel>
                      {instantTimes.startTimes.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor='instant-end-time'>结束时间</FieldLabel>
                <Select
                  value={instantEndTime}
                  items={instantTimes.endTimes.map((item) => ({
                    value: item.id,
                    label: item.label
                  }))}
                  onValueChange={(value) => value && setInstantEndTime(value)}
                  disabled={instantLoading || !instantTimes.endTimes.length}
                >
                  <SelectTrigger id='instant-end-time' className='w-full'>
                    <SelectValue placeholder={instantLoading ? '读取中…' : '选择结束时间'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>可用结束时间</SelectLabel>
                      {instantTimes.endTimes.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
            {!instantLoading && !instantError && !instantTimes.startTimes.length && (
              <Alert>
                <Icons.info />
                <AlertTitle>当前没有可提交的时段</AlertTitle>
                <AlertDescription>
                  可以保留这个座位并配置自动任务，系统会在开放窗口再次尝试。
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button type='button' variant='outline' onClick={() => setInstantOpen(false)}>
              取消
            </Button>
            <Button
              type='button'
              disabled={instantLoading || !instantStartTime || !instantEndTime}
              onClick={() => setInstantConfirmOpen(true)}
            >
              确认时段
              <Icons.arrowRight data-icon='inline-end' />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={instantConfirmOpen} onOpenChange={setInstantConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认提交这次预约？</AlertDialogTitle>
            <AlertDialogDescription>
              {formatDateLabel(date)} · {selectedRoom?.name || '所选空间'} · 座位{' '}
              {layout?.nodes.find((node) => node.id === instantSeatId)?.label || instantSeatId} ·{' '}
              {findTimeLabel(instantTimes.startTimes, instantStartTime)} -{' '}
              {findTimeLabel(instantTimes.endTimes, instantEndTime)}
              。提交后由学校系统判断最终占用情况。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={instantSubmitting}>返回修改</AlertDialogCancel>
            <AlertDialogAction
              disabled={instantSubmitting}
              onClick={() => void submitInstantBooking()}
            >
              {instantSubmitting ? '提交中…' : '确认预约'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <LibraryCaptchaDialog
        open={captchaOpen}
        onOpenChange={(nextOpen) => {
          setCaptchaOpen(nextOpen);
          if (!nextOpen) {
            setCaptchaChallenge(null);
            setCaptchaBooking(null);
            setCaptchaError('');
          }
        }}
        challenge={captchaChallenge}
        loading={captchaLoading}
        error={captchaError}
        onRefresh={() => void refreshCaptcha()}
        onVerify={(points) => void verifyCaptcha(points)}
      />
    </PageContainer>
  );
}

function Stat({ label, value, tone = 'default' }: { label: string; value: number; tone?: string }) {
  return (
    <div className='rounded-lg border bg-card px-4 py-3'>
      <p className='text-muted-foreground text-xs'>{label}</p>
      <p
        className={cn(
          'mt-1 text-2xl font-semibold tabular-nums',
          tone === 'success' && 'text-emerald-600 dark:text-emerald-400',
          tone === 'info' && 'text-sky-600 dark:text-sky-400',
          tone === 'muted' && 'text-muted-foreground'
        )}
      >
        {value}
      </p>
    </div>
  );
}

function formatDateLabel(value: string): string {
  return new Date(`${value}T00:00:00+08:00`).toLocaleDateString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short'
  });
}

function findTimeLabel(items: Array<{ id: string; label: string }>, id: string): string {
  return items.find((item) => item.id === id)?.label || id;
}
