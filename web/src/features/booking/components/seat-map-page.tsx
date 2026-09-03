'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

import { getSeatCatalog, getSeatLayout } from '../api/service';
import type { BookingAccount, SeatCatalog, SeatLayout, VenueType } from '../types';
import { SeatMapPicker } from './seat-map-picker';

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
    void getSeatLayout({ accountId, serviceType: venueType, roomId, date })
      .then(setLayout)
      .catch((reason) => setError(reason instanceof Error ? reason.message : '座位图刷新失败'))
      .finally(() => setLayoutLoading(false));
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
                      items={rooms.map((room) => ({ value: room.id, label: room.name }))}
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
                <Alert variant={error ? 'destructive' : 'default'}>
                  {error ? <Icons.warning /> : <Icons.shield />}
                  <AlertTitle>{error ? '实时数据未加载' : '预约前需要验证'}</AlertTitle>
                  <AlertDescription>
                    {error || '该系统当前开启预约验证，座位状态仍可查看。'}
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
