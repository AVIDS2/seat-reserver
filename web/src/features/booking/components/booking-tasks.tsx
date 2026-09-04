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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

import {
  createBookingTask,
  deleteBookingTask,
  dryRunBookingTask,
  getSeatCatalog,
  getSeatLayout,
  getSeatTimes,
  prewarmBookingTask,
  runBookingTask,
  setBookingTaskEnabled,
  updateBookingTask,
  type DryRunResult,
  type TaskPayload
} from '../api/service';
import type {
  BookingAccount,
  BookingTaskDraft,
  BookingTask,
  SeatCatalog,
  SeatLayout,
  TimeCandidate,
  VenueType
} from '../types';
import { SeatMapPicker } from './seat-map-picker';
import { ScheduleDatePicker } from './schedule-date-picker';
import { getSchoolAvailabilityNotice } from './school-status';
import { TaskStatusBadge } from './status-badge';
import { TimeRangePicker } from './time-range-picker';

type EditorPayload = Omit<TaskPayload, 'enabled'>;
type ScheduleMode = 'daily' | 'weekdays' | 'weekly' | 'dates';

const WEEKDAYS = [
  { value: '1', label: '周一' },
  { value: '2', label: '周二' },
  { value: '3', label: '周三' },
  { value: '4', label: '周四' },
  { value: '5', label: '周五' },
  { value: '6', label: '周六' },
  { value: '0', label: '周日' }
];

async function runTask(task: BookingTask) {
  try {
    await runBookingTask(task.id);
    toast.success(`${task.name} 已开始执行`, {
      description: '系统正在按你设置的座位和时间尝试预约，完成后会通知结果。'
    });
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '运行任务失败');
  }
}

async function prewarmTask(task: BookingTask) {
  try {
    await prewarmBookingTask(task.id);
    toast.success(`${task.name} 正在检查账号连接`);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '预热任务失败');
  }
}

function TaskEditorDialog({
  open,
  onOpenChange,
  accounts,
  task,
  draft,
  onSave
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: BookingAccount[];
  task?: BookingTask;
  draft?: BookingTaskDraft;
  onSave: (payload: EditorPayload, taskId?: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [accountId, setAccountId] = useState('');
  const [venueType, setVenueType] = useState<VenueType>('study_room');
  const [buildingId, setBuildingId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [previewDate, setPreviewDate] = useState('');
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('daily');
  const [scheduleWeekdays, setScheduleWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [scheduleDates, setScheduleDates] = useState<string[]>([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<SeatCatalog | null>(null);
  const [layout, setLayout] = useState<SeatLayout | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [layoutLoading, setLayoutLoading] = useState(false);
  const [timesLoading, setTimesLoading] = useState(false);
  const [availableStartTimes, setAvailableStartTimes] = useState<number[]>([]);
  const [catalogError, setCatalogError] = useState('');
  const [timeCandidates, setTimeCandidates] = useState<TimeCandidate[]>(
    defaultTimeCandidates('study_room')
  );
  const [maxAttempts, setMaxAttempts] = useState('12');
  const [delay, setDelay] = useState('1.2');
  const [windowSeconds, setWindowSeconds] = useState('20');
  const [prewarmOffset, setPrewarmOffset] = useState('0');
  const [runOffset, setRunOffset] = useState('1');
  const [step, setStep] = useState<1 | 2>(1);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(task?.name || '');
    setAccountId(task?.accountId || draft?.accountId || accounts[0]?.id || '');
    setVenueType(task?.venueType || draft?.venueType || 'study_room');
    setBuildingId(task?.buildingId || draft?.buildingId || '');
    setRoomId(task?.roomId || draft?.roomId || '');
    setPreviewDate('');
    setScheduleMode(task?.scheduleMode === 'once' ? 'dates' : task?.scheduleMode || 'daily');
    setScheduleWeekdays(task?.scheduleWeekdays?.length ? task.scheduleWeekdays : [1, 2, 3, 4, 5]);
    setScheduleDates(
      task?.scheduleDates?.length
        ? task.scheduleDates
        : task?.scheduleMode === 'once' && task.targetDate
          ? [task.targetDate]
          : []
    );
    setSelectedSeatIds(task ? [task.seatId, ...task.backupSeatIds] : draft?.seatIds || []);
    setCatalog(null);
    setLayout(null);
    setAvailableStartTimes([]);
    setCatalogError('');
    const taskVenue = task?.venueType || draft?.venueType || 'study_room';
    setTimeCandidates(
      normalizeTimeCandidates(
        task?.timeCandidates?.length ? task.timeCandidates : defaultTimeCandidates(taskVenue),
        maxDurationHours(taskVenue),
        defaultWindow(taskVenue)
      )
    );
    setMaxAttempts(String(task?.maxAttempts || 12));
    setDelay(String(task?.attemptDelaySeconds ?? 1.2));
    setWindowSeconds(String(task?.bookingWindowSeconds || 20));
    setPrewarmOffset(String(task?.prewarmOffsetSeconds || 0));
    setRunOffset(String(task?.runOffsetSeconds ?? 1));
    setStep(1);
    setAdvancedOpen(false);
  }, [accounts, draft, open, task]);

  useEffect(() => {
    if (!open || !accountId) return;
    let cancelled = false;
    setCatalogLoading(true);
    setCatalogError('');
    void getSeatCatalog(accountId, venueType)
      .then((nextCatalog) => {
        if (cancelled) return;
        setCatalog(nextCatalog);
        const preferredBuildingId =
          task?.venueType === venueType
            ? task.buildingId
            : draft?.venueType === venueType
              ? draft.buildingId
              : undefined;
        const matchedBuilding = nextCatalog.buildings.find(
          (item) => item.id === preferredBuildingId
        );
        const nextBuildingId = matchedBuilding?.id || nextCatalog.buildings[0]?.id || '';
        setBuildingId(nextBuildingId);
        const preferredRoomId =
          task?.venueType === venueType
            ? task.roomId
            : draft?.venueType === venueType
              ? draft.roomId
              : undefined;
        const matchedRoom = nextCatalog.rooms.find((item) => item.id === preferredRoomId);
        const nextRoom =
          matchedRoom || nextCatalog.rooms.find((item) => item.buildingId === nextBuildingId);
        setRoomId(nextRoom?.id || '');
        setPreviewDate(nextCatalog.dates[0] || '');
      })
      .catch((error) => {
        if (!cancelled)
          setCatalogError(error instanceof Error ? error.message : '场馆目录加载失败');
      })
      .finally(() => !cancelled && setCatalogLoading(false));
    return () => {
      cancelled = true;
    };
  }, [accountId, draft, open, task, venueType]);

  const loadLayout = async () => {
    if (!accountId || !roomId || !previewDate) return;
    setLayoutLoading(true);
    setCatalogError('');
    try {
      setLayout(
        await getSeatLayout({
          accountId,
          serviceType: venueType,
          roomId,
          date: previewDate
        })
      );
    } catch (error) {
      setLayout(null);
      setCatalogError(error instanceof Error ? error.message : '座位图加载失败');
    } finally {
      setLayoutLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !roomId || !previewDate) return;
    void loadLayout();
    // loadLayout intentionally tracks the concrete catalog selection only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, open, previewDate, roomId, venueType]);

  useEffect(() => {
    const primarySeatId = selectedSeatIds[0];
    if (!open || !accountId || !roomId || !previewDate || !primarySeatId) {
      setAvailableStartTimes([]);
      return;
    }
    let cancelled = false;
    setTimesLoading(true);
    void getSeatTimes({
      accountId,
      serviceType: venueType,
      roomId,
      seatId: primarySeatId,
      date: previewDate
    })
      .then((times) => {
        if (cancelled) return;
        setAvailableStartTimes(
          times.startTimes.map((item) => Number(item.id)).filter((item) => Number.isInteger(item))
        );
      })
      .catch(() => !cancelled && setAvailableStartTimes([]))
      .finally(() => !cancelled && setTimesLoading(false));
    return () => {
      cancelled = true;
    };
  }, [accountId, open, previewDate, roomId, selectedSeatIds, venueType]);

  const rooms = catalog?.rooms.filter((room) => room.buildingId === buildingId) ?? [];
  const selectedRoom = catalog?.rooms.find((room) => room.id === roomId);
  const selectedBuilding = catalog?.buildings.find((building) => building.id === buildingId);
  const selectedNodes = selectedSeatIds.map((id) => layout?.nodes.find((node) => node.id === id));
  const catalogNotice = getSchoolAvailabilityNotice(catalogError);
  const resetLocationSelection = () => {
    setCatalog(null);
    setLayout(null);
    setPreviewDate('');
    setBuildingId('');
    setRoomId('');
    setSelectedSeatIds([]);
    setAvailableStartTimes([]);
    setStep(1);
  };

  const canContinue = Boolean(
    name.trim() && accountId && selectedBuilding && selectedRoom && !catalogLoading
  );

  const handleContinue = () => {
    if (!canContinue) {
      toast.error('请先填写任务名称并选择账号、系统和空间');
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step !== 2) {
      handleContinue();
      return;
    }
    if (!name.trim() || !selectedSeatIds[0] || !accountId || !selectedRoom || !selectedBuilding) {
      toast.error('请选择账号、场馆和至少一个座位');
      return;
    }
    if (!timeCandidates.length || timeCandidates.some((range) => range.end <= range.start)) {
      toast.error('请至少保留一个有效时间段');
      return;
    }
    const normalizedScheduleMode = scheduleMode;
    if (normalizedScheduleMode === 'weekly' && !scheduleWeekdays.length) {
      toast.error('请至少选择一个执行日');
      return;
    }
    if (normalizedScheduleMode === 'dates' && !scheduleDates.length) {
      toast.error('请至少选择一个预约日期');
      return;
    }
    setSaving(true);
    try {
      await onSave(
        {
          accountId,
          name: name.trim(),
          venueType,
          building: selectedBuilding.name,
          buildingId,
          roomName: selectedRoom.name,
          roomId,
          scheduleMode: normalizedScheduleMode,
          targetDate: null,
          scheduleWeekdays,
          scheduleDates,
          primarySeatLabel: selectedNodes[0]?.label || task?.seatLabel || null,
          primarySeatId: selectedSeatIds[0],
          backupSeatIds: selectedSeatIds.slice(1),
          backupSeatLabels: selectedNodes
            .slice(1)
            .map(
              (node, index) => node?.label || task?.backupSeatLabels[index] || `备选 ${index + 1}`
            ),
          timeCandidates,
          maxAttempts: clampNumber(maxAttempts, 1, 100, 12),
          attemptDelaySeconds: clampNumber(delay, 0, 30, 1.2),
          bookingWindowSeconds: clampNumber(windowSeconds, 1, 120, 20),
          prewarmOffsetSeconds: clampNumber(prewarmOffset, 0, 300, 0),
          runOffsetSeconds: clampNumber(runOffset, 0, 300, 1)
        },
        task?.id
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存任务失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex h-[calc(100svh-1rem)] max-h-[calc(100svh-1rem)] w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] flex-col overflow-hidden overscroll-contain p-3 sm:h-auto sm:max-h-[min(900px,calc(100svh-2rem))] sm:w-[min(1040px,calc(100%-2rem))] sm:max-w-[1040px] sm:p-5'>
        <DialogHeader className='shrink-0 pr-8'>
          <DialogTitle>{task ? '编辑预约任务' : '新建预约任务'}</DialogTitle>
          <DialogDescription>配置一次预约任务，系统会按规则自动执行。</DialogDescription>
        </DialogHeader>
        <ToggleGroup
          value={[String(step)]}
          onValueChange={(values) => {
            const next = Number(values[0]);
            if (next === 1 || (next === 2 && canContinue)) setStep(next as 1 | 2);
          }}
          variant='outline'
          spacing={0}
          className='grid shrink-0 grid-cols-2'
          aria-label='任务配置步骤'
        >
          <ToggleGroupItem value='1' className='w-full justify-start gap-2 px-3 sm:justify-center'>
            <span className='flex size-5 items-center justify-center rounded-full bg-current/10 text-xs'>
              1
            </span>
            账号与空间
          </ToggleGroupItem>
          <ToggleGroupItem
            value='2'
            disabled={!canContinue}
            className='w-full justify-start gap-2 px-3 sm:justify-center'
          >
            <span className='flex size-5 items-center justify-center rounded-full bg-current/10 text-xs'>
              2
            </span>
            座位与时间
          </ToggleGroupItem>
        </ToggleGroup>
        <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-0.5'>
          <form
            id='booking-task-editor'
            onSubmit={handleSubmit}
            className='flex flex-col gap-4 pb-1'
          >
            {step === 1 ? (
              <section className='flex flex-col gap-5 rounded-xl border bg-card p-4 sm:p-5'>
                <div>
                  <h3 className='text-base font-semibold'>选择预约位置</h3>
                  <p className='text-muted-foreground mt-1 text-sm'>
                    先确定账号和空间，下一步选择座位与时间。
                  </p>
                </div>
                <FieldGroup className='grid gap-4 sm:grid-cols-2'>
                  <Field>
                    <FieldLabel htmlFor='task-name'>任务名称</FieldLabel>
                    <Input
                      id='task-name'
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder='例如：周三靠窗位'
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor='task-account'>使用账号</FieldLabel>
                    <Select
                      value={accountId}
                      items={accounts.map((account) => ({
                        value: account.id,
                        label: account.label
                      }))}
                      onValueChange={(value) => {
                        if (!value || value === accountId) return;
                        setAccountId(value);
                        resetLocationSelection();
                      }}
                      disabled={accounts.length === 0}
                    >
                      <SelectTrigger id='task-account' className='w-full'>
                        <SelectValue placeholder='选择学校账号' />
                      </SelectTrigger>
                      <SelectContent
                        align='start'
                        className='w-max min-w-48 max-w-[calc(100vw-2rem)] sm:w-(--anchor-width)'
                      >
                        <SelectGroup>
                          <SelectLabel>学校账号</SelectLabel>
                          {accounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldDescription>一个任务对应一个账号。</FieldDescription>
                  </Field>
                  <Field className='sm:col-span-2'>
                    <FieldLabel>预约系统</FieldLabel>
                    <ToggleGroup
                      value={[venueType]}
                      onValueChange={(value) => {
                        if (!value[0] || value[0] === venueType) return;
                        const nextVenue = value[0] as VenueType;
                        setVenueType(nextVenue);
                        setTimeCandidates(defaultTimeCandidates(nextVenue));
                        resetLocationSelection();
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
                    {venueType === 'library' && (
                      <FieldDescription>
                        首次加载图书馆时会建立独立连接，也可以先到
                        <Link
                          href='/dashboard/accounts'
                          className='text-primary underline underline-offset-4'
                        >
                          账号与授权
                        </Link>{' '}
                        手动连接。
                      </FieldDescription>
                    )}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor='task-building'>
                      {venueType === 'library' ? '馆区' : '楼栋'}
                    </FieldLabel>
                    <Select
                      value={buildingId}
                      items={(catalog?.buildings ?? []).map((building) => ({
                        value: building.id,
                        label: building.name
                      }))}
                      onValueChange={(value) => {
                        if (!value) return;
                        setBuildingId(value);
                        setRoomId(
                          catalog?.rooms.find((room) => room.buildingId === value)?.id || ''
                        );
                        setLayout(null);
                        setSelectedSeatIds([]);
                      }}
                      disabled={catalogLoading || !catalog}
                    >
                      <SelectTrigger id='task-building' className='w-full'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent
                        align='start'
                        className='w-max min-w-48 max-w-[calc(100vw-2rem)] sm:w-(--anchor-width)'
                      >
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
                    <FieldLabel htmlFor='task-room'>空间</FieldLabel>
                    <Select
                      value={roomId}
                      items={rooms.map((room) => ({
                        value: room.id,
                        label: room.name
                      }))}
                      onValueChange={(value) => {
                        if (value) {
                          setRoomId(value);
                          setLayout(null);
                          setSelectedSeatIds([]);
                        }
                      }}
                      disabled={!rooms.length}
                    >
                      <SelectTrigger id='task-room' className='w-full'>
                        <SelectValue placeholder='选择空间' />
                      </SelectTrigger>
                      <SelectContent
                        align='start'
                        className='w-max min-w-48 max-w-[calc(100vw-2rem)] sm:w-(--anchor-width)'
                      >
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
                    <FieldDescription>
                      {catalogLoading ? '正在读取学校实时空间…' : '名称来自学校实时目录。'}
                    </FieldDescription>
                  </Field>
                </FieldGroup>
                {catalogError && (
                  <Alert variant={catalogNotice.maintenance ? 'default' : 'destructive'}>
                    {catalogNotice.maintenance ? <Icons.clock /> : <Icons.warning />}
                    <AlertTitle>
                      {catalogNotice.maintenance ? '学校系统维护中' : '实时数据未加载'}
                    </AlertTitle>
                    <AlertDescription>{catalogNotice.message}</AlertDescription>
                  </Alert>
                )}
                <div className='rounded-lg bg-muted/40 px-3 py-2.5 text-sm'>
                  <span className='text-muted-foreground'>当前选择：</span>
                  <span className='font-medium'>
                    {selectedBuilding?.name || '未选楼栋'}
                    {selectedRoom ? ` / ${selectedRoom.name}` : ''}
                  </span>
                </div>
              </section>
            ) : (
              <section className='flex min-w-0 flex-col gap-5'>
                <div className='rounded-lg border bg-muted/30 px-4 py-3'>
                  <p className='text-muted-foreground text-xs'>预约位置</p>
                  <p className='mt-1 truncate text-sm font-medium'>
                    {selectedBuilding?.name} / {selectedRoom?.name}
                  </p>
                </div>
                <SeatMapPicker
                  layout={layout}
                  loading={layoutLoading || catalogLoading}
                  selectedIds={selectedSeatIds}
                  onSelectedIdsChange={setSelectedSeatIds}
                  onRefresh={() => void loadLayout()}
                  className='w-full'
                />
                {catalog?.captchaRequired && (
                  <Alert>
                    <Icons.shield />
                    <AlertTitle>预约前需要验证</AlertTitle>
                    <AlertDescription>
                      图书馆当前开启验证码。座位查询可正常使用，提交预约前需在控制台完成一次验证。
                    </AlertDescription>
                  </Alert>
                )}
                {catalogError && (
                  <Alert variant={catalogNotice.maintenance ? 'default' : 'destructive'}>
                    {catalogNotice.maintenance ? <Icons.clock /> : <Icons.warning />}
                    <AlertTitle>
                      {catalogNotice.maintenance ? '学校系统维护中' : '实时数据未加载'}
                    </AlertTitle>
                    <AlertDescription>{catalogNotice.message}</AlertDescription>
                  </Alert>
                )}
                <div className='grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]'>
                  <section className='min-w-0 rounded-xl border bg-card p-4'>
                    <TimeRangePicker
                      value={timeCandidates}
                      onChange={setTimeCandidates}
                      availableStartTimes={availableStartTimes}
                      maxDurationHours={catalog?.hours || maxDurationHours(venueType)}
                      windowStartMinutes={catalog?.windowStart || defaultWindow(venueType).start}
                      windowEndMinutes={catalog?.windowEnd || defaultWindow(venueType).end}
                    />
                    {selectedSeatIds[0] && (
                      <p className='text-muted-foreground mt-2 text-xs'>
                        {timesLoading
                          ? '正在读取该座位的可用时段…'
                          : availableStartTimes.length
                            ? '已读取学校实时起始时段；自动任务仍按你设置的时段执行。'
                            : '暂未取得该座位的实时起始时段，仍可使用常规半小时刻度。'}
                      </p>
                    )}
                  </section>
                  <section className='min-w-0 rounded-xl border bg-card p-4'>
                    <FieldGroup>
                      <Field>
                        <FieldLabel>执行频率</FieldLabel>
                        <ToggleGroup
                          value={[scheduleMode]}
                          onValueChange={(value) =>
                            value[0] && setScheduleMode(value[0] as ScheduleMode)
                          }
                          variant='outline'
                          spacing={0}
                          className='grid w-full grid-cols-2 sm:grid-cols-4'
                        >
                          <ToggleGroupItem value='daily' className='w-full'>
                            每天
                          </ToggleGroupItem>
                          <ToggleGroupItem value='weekdays' className='w-full'>
                            工作日
                          </ToggleGroupItem>
                          <ToggleGroupItem value='weekly' className='w-full'>
                            按星期
                          </ToggleGroupItem>
                          <ToggleGroupItem value='dates' className='w-full'>
                            指定日期
                          </ToggleGroupItem>
                        </ToggleGroup>
                      </Field>
                      {scheduleMode === 'weekly' && (
                        <Field>
                          <div className='flex items-center justify-between gap-3'>
                            <FieldLabel>执行星期</FieldLabel>
                            <span className='text-muted-foreground text-xs'>至少一天</span>
                          </div>
                          <ToggleGroup
                            multiple
                            value={scheduleWeekdays.map(String)}
                            onValueChange={(values) => setScheduleWeekdays(values.map(Number))}
                            variant='outline'
                            spacing={1}
                            className='grid w-full grid-cols-4 sm:grid-cols-7'
                            aria-label='选择执行星期'
                          >
                            {WEEKDAYS.map((weekday) => (
                              <ToggleGroupItem
                                key={weekday.value}
                                value={weekday.value}
                                className='w-full'
                              >
                                {weekday.label}
                              </ToggleGroupItem>
                            ))}
                          </ToggleGroup>
                        </Field>
                      )}
                      {scheduleMode === 'dates' && (
                        <Field>
                          <FieldLabel>预约日期</FieldLabel>
                          <ScheduleDatePicker value={scheduleDates} onChange={setScheduleDates} />
                        </Field>
                      )}
                    </FieldGroup>
                    <div className='mt-4 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground'>
                      {scheduleMode === 'daily'
                        ? '每天按照下面的时间段自动尝试。'
                        : scheduleMode === 'weekdays'
                          ? '周一至周五自动尝试。'
                          : scheduleMode === 'weekly'
                            ? '只在选中的星期自动尝试。'
                            : '只在日历中选中的日期自动尝试。'}
                    </div>
                  </section>
                </div>
                <Collapsible
                  open={advancedOpen}
                  onOpenChange={setAdvancedOpen}
                  className='rounded-xl border bg-card'
                >
                  <CollapsibleTrigger className='flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium'>
                    高级执行参数
                    <Icons.chevronDown className='size-4 text-muted-foreground transition-transform data-panel-open:rotate-180' />
                  </CollapsibleTrigger>
                  <CollapsibleContent className='border-t px-4 py-4'>
                    <div className='grid grid-cols-2 gap-3 sm:grid-cols-3'>
                      <NumberField
                        id='task-attempts'
                        label='最大尝试次数'
                        value={maxAttempts}
                        onChange={setMaxAttempts}
                        min='1'
                        max='100'
                        step='1'
                      />
                      <NumberField
                        id='task-delay'
                        label='尝试间隔（秒）'
                        value={delay}
                        onChange={setDelay}
                        min='0'
                        max='30'
                        step='0.1'
                      />
                      <NumberField
                        id='task-window'
                        label='执行窗口（秒）'
                        value={windowSeconds}
                        onChange={setWindowSeconds}
                        min='1'
                        max='120'
                        step='1'
                      />
                      <NumberField
                        id='task-prewarm-offset'
                        label='预热错峰（秒）'
                        value={prewarmOffset}
                        onChange={setPrewarmOffset}
                        min='0'
                        max='300'
                        step='1'
                      />
                      <NumberField
                        id='task-run-offset'
                        label='预约错峰（秒）'
                        value={runOffset}
                        onChange={setRunOffset}
                        min='0'
                        max='300'
                        step='1'
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </section>
            )}
          </form>
        </div>
        <DialogFooter className='sticky bottom-0 z-10 shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-between'>
          <Button
            type='button'
            variant='outline'
            onClick={() => (step === 2 ? setStep(1) : onOpenChange(false))}
          >
            {step === 2 ? (
              <>
                <Icons.chevronLeft data-icon='inline-start' />
                返回
              </>
            ) : (
              '取消'
            )}
          </Button>
          {step === 1 ? (
            <Button
              type='button'
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleContinue();
              }}
              disabled={!canContinue}
            >
              下一步：座位与时间
              <Icons.arrowRight data-icon='inline-end' />
            </Button>
          ) : (
            <Button
              type='submit'
              form='booking-task-editor'
              disabled={saving || accounts.length === 0 || !selectedSeatIds.length}
            >
              {saving
                ? '保存中'
                : task
                  ? '保存修改'
                  : venueType === 'library'
                    ? '保存图书馆任务'
                    : '创建任务'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  min: string;
  max: string;
  step: string;
}) {
  return (
    <div className='flex flex-col gap-2'>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type='number'
        value={value}
        onChange={(event) => onChange(event.target.value)}
        min={min}
        max={max}
        step={step}
        required
      />
    </div>
  );
}

export default function BookingTasksPage({
  initialTasks,
  initialAccounts,
  initialTaskDraft
}: {
  initialTasks: BookingTask[];
  initialAccounts: BookingAccount[];
  initialTaskDraft?: BookingTaskDraft;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [accounts] = useState(initialAccounts);
  const [search, setSearch] = useState('');
  const [editorTask, setEditorTask] = useState<BookingTask | undefined>();
  const [editorDraft, setEditorDraft] = useState<BookingTaskDraft | undefined>(initialTaskDraft);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BookingTask | null>(null);
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);

  useEffect(() => {
    if (!initialTaskDraft) return;
    setEditorTask(undefined);
    setEditorDraft(initialTaskDraft);
    setEditorOpen(true);
  }, [initialTaskDraft]);

  const filteredTasks = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return tasks;
    return tasks.filter((task) =>
      `${task.name} ${task.account} ${task.seat}`.toLowerCase().includes(value)
    );
  }, [search, tasks]);

  const saveTask = async (payload: EditorPayload, taskId?: string) => {
    const updated = taskId
      ? await updateBookingTask(taskId, payload)
      : await createBookingTask(payload);
    setTasks((current) =>
      taskId ? current.map((task) => (task.id === taskId ? updated : task)) : [updated, ...current]
    );
    toast.success(taskId ? '任务已更新' : '任务创建成功');
  };

  const toggleTask = async (id: string, enabled: boolean) => {
    const previousTasks = tasks;
    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? {
              ...task,
              enabled,
              status: enabled ? 'enabled' : 'paused',
              nextRun: enabled ? '等待下一次开放窗口' : '已暂停'
            }
          : task
      )
    );
    try {
      const updated = await setBookingTaskEnabled(id, enabled);
      setTasks((current) => current.map((task) => (task.id === id ? updated : task)));
      toast.success(enabled ? '任务已启用' : '任务已暂停', {
        description: enabled
          ? '系统会在下一次开放时按你的设置自动预约。'
          : '暂停后不会再自动预约，已有预约不会被取消。'
      });
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
      <div className='mx-auto w-full max-w-[1440px] space-y-5 sm:space-y-6'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
          <div>
            <p className='text-muted-foreground mb-2 text-sm'>自动化规则</p>
            <h1 className='text-2xl font-semibold tracking-tight sm:text-3xl'>预约任务</h1>
            <p className='text-muted-foreground mt-2 text-sm leading-6'>
              管理座位优先级、时间候选和每日自动执行状态。
            </p>
          </div>
          <Button
            className='w-full sm:w-auto'
            onClick={() => {
              setEditorTask(undefined);
              setEditorDraft(undefined);
              setEditorOpen(true);
            }}
            disabled={accounts.length === 0}
          >
            <Icons.add data-icon='inline-start' />
            新建任务
          </Button>
        </div>

        {accounts.length === 0 && (
          <Alert>
            <Icons.warning />
            <AlertTitle>先接入学校账号</AlertTitle>
            <AlertDescription>完成一次正常登录验证后，才能创建预约任务。</AlertDescription>
          </Alert>
        )}

        <Card className='shadow-none'>
          <CardHeader className='grid-cols-1 border-b sm:grid-cols-[minmax(0,1fr)_auto]'>
            <div>
              <CardDescription>{tasks.length} 个任务</CardDescription>
              <CardTitle className='text-xl'>全部任务</CardTitle>
            </div>
            <CardAction className='col-start-1 row-auto w-full justify-self-stretch sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:w-auto sm:justify-self-end'>
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
                  className='grid min-w-0 gap-3 border-b py-4 last:border-b-0 lg:grid-cols-[minmax(220px,1.5fr)_minmax(120px,0.8fr)_minmax(150px,1fr)_130px_100px] lg:items-center lg:gap-4'
                >
                  <div className='flex min-w-0 items-start gap-3'>
                    <div className='bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg'>
                      <Icons.target className='size-4' />
                    </div>
                    <div className='min-w-0'>
                      <p className='truncate text-sm font-medium'>{task.name}</p>
                      <p className='text-muted-foreground mt-1 truncate text-xs'>
                        主座位 {task.seat} ·{' '}
                        {task.backupSeatLabels.length
                          ? `备选 ${task.backupSeatLabels.map((label) => `${label}号`).join('、')}`
                          : '无备选'}
                      </p>
                      <p className='text-muted-foreground mt-1 truncate text-xs'>
                        {task.building} · {venueLabel(task.venueType)} · {task.roomName}
                      </p>
                    </div>
                  </div>
                  <div className='text-muted-foreground pl-12 text-sm lg:pl-0'>{task.account}</div>
                  <div className='text-muted-foreground flex min-w-0 items-start gap-2 pl-12 text-sm lg:pl-0'>
                    <Icons.clock className='mt-0.5 size-4 shrink-0' />
                    <span className='min-w-0'>
                      <span className='block break-words'>{task.time}</span>
                      <span className='mt-1 block text-xs'>
                        共 {task.maxAttempts} 次 · {task.bookingWindowSeconds} 秒
                      </span>
                    </span>
                  </div>
                  <div className='pl-12 text-sm lg:pl-0'>{task.nextRun}</div>
                  <div className='flex items-center justify-between gap-3 pl-12 lg:justify-end lg:pl-0'>
                    <TaskStatusBadge status={task.status} />
                    <Switch
                      checked={task.enabled}
                      onCheckedChange={(checked) => void toggleTask(task.id, checked)}
                      disabled={task.venueType === 'library'}
                      title={task.venueType === 'library' ? '图书馆需要预约前人工验证' : undefined}
                      aria-label={`${task.name}自动执行`}
                    />
                  </div>
                  <div className='flex min-w-0 flex-wrap items-center gap-1 pl-12 lg:col-span-full lg:pl-0'>
                    <span className='text-muted-foreground mr-auto min-w-0 basis-full truncate text-xs sm:basis-auto'>
                      {task.lastMessage}
                    </span>
                    <Button variant='ghost' size='sm' onClick={() => void inspectTask(task)}>
                      <Icons.shield data-icon='inline-start' />
                      检查
                    </Button>
                    <Button variant='ghost' size='sm' onClick={() => void prewarmTask(task)}>
                      <Icons.refresh data-icon='inline-start' />
                      预热
                    </Button>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => {
                        setEditorTask(task);
                        setEditorOpen(true);
                      }}
                    >
                      <Icons.edit data-icon='inline-start' />
                      编辑
                    </Button>
                    {task.venueType === 'library' ? (
                      <Link
                        href={taskBookingHref(task)}
                        className={buttonVariants({ variant: 'default', size: 'sm' })}
                      >
                        <Icons.shield data-icon='inline-start' />
                        验证并预约
                      </Link>
                    ) : (
                      <Button variant='ghost' size='sm' onClick={() => void runTask(task)}>
                        <Icons.play data-icon='inline-start' />
                        立即运行
                      </Button>
                    )}
                    <Button
                      variant='ghost'
                      size='sm'
                      className='text-destructive'
                      onClick={() => setDeleteTarget(task)}
                    >
                      <Icons.trash data-icon='inline-start' />
                      删除
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <TaskEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        accounts={accounts}
        task={editorTask}
        draft={editorDraft}
        onSave={saveTask}
      />

      <Dialog open={!!dryRun} onOpenChange={(open) => !open && setDryRun(null)}>
        <DialogContent className='flex h-[calc(100svh-1rem)] max-h-[calc(100svh-1rem)] w-[calc(100%-1rem)] flex-col overflow-hidden overscroll-contain sm:h-auto sm:max-h-[calc(100svh-2rem)] sm:max-w-[560px]'>
          <DialogHeader className='shrink-0 pr-8'>
            <DialogTitle>任务检查</DialogTitle>
            <DialogDescription>只检查账号连接和候选顺序，不会提交真实预约。</DialogDescription>
          </DialogHeader>
          {dryRun && (
            <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-0.5'>
              <div className='flex flex-col gap-4 pb-1'>
                <Alert variant={dryRun.tokenStatus === 'valid' ? 'default' : 'destructive'}>
                  <Icons.shield />
                  <AlertTitle>{tokenStatusLabel(dryRun.tokenStatus)}</AlertTitle>
                  <AlertDescription>{dryRun.message}</AlertDescription>
                </Alert>
                <div className='flex flex-col gap-2'>
                  <p className='text-muted-foreground text-xs'>候选顺序</p>
                  {dryRun.candidates.map((candidate) => (
                    <div
                      key={`${candidate.order}-${candidate.seatId}-${candidate.startTime}`}
                      className='bg-muted flex flex-col gap-1 rounded-lg px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between'
                    >
                      <span>
                        #{candidate.order} · {candidate.seatLabel}
                      </span>
                      <span className='text-muted-foreground'>
                        {formatTime(candidate.startTime)} - {formatTime(candidate.endTime)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这个预约任务？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后不会再参与自动执行，历史运行记录会保留。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void removeTask()}>确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}

function clampNumber(value: string, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function taskBookingHref(task: BookingTask): string {
  const maximumMinutes = task.venueType === 'library' ? 4 * 60 : 8 * 60;
  const firstTime =
    task.timeCandidates.find((candidate) => candidate.end - candidate.start <= maximumMinutes) ||
    { start: 480, end: 480 + maximumMinutes };
  const query = new URLSearchParams({
    accountId: task.accountId,
    serviceType: task.venueType,
    ...(task.buildingId ? { buildingId: task.buildingId } : {}),
    ...(task.roomId ? { roomId: task.roomId } : {}),
    seatId: task.seatId,
    ...(firstTime ? { startTime: String(firstTime.start), endTime: String(firstTime.end) } : {}),
    book: '1'
  });
  return `/dashboard/seats?${query.toString()}`;
}

function formatTime(minutes: number): string {
  return `${Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`;
}

function tokenStatusLabel(status: DryRunResult['tokenStatus']): string {
  return {
    valid: '连接正常',
    missing: '尚未建立连接',
    invalid: '连接已失效',
    unavailable: '连接检查暂不可用'
  }[status];
}

function venueLabel(venueType: VenueType): string {
  return { library: '图书馆', study_room: '自习室' }[venueType];
}

function maxDurationHours(venueType: VenueType): number {
  return venueType === 'library' ? 4 : 8;
}

function defaultWindow(venueType: VenueType): { start: number; end: number } {
  return venueType === 'library' ? { start: 420, end: 1380 } : { start: 420, end: 1320 };
}

function defaultTimeCandidates(venueType: VenueType): TimeCandidate[] {
  return [{ start: 480, end: venueType === 'library' ? 720 : 840 }];
}

function normalizeTimeCandidates(
  candidates: TimeCandidate[],
  durationHours: number,
  window: { start: number; end: number }
): TimeCandidate[] {
  const maxMinutes = durationHours * 60;
  return candidates.map((candidate) => ({
    start: Math.max(window.start, Math.min(candidate.start, window.end - 30)),
    end: Math.max(
      Math.max(window.start, Math.min(candidate.start, window.end - 30)) + 30,
      Math.min(
        candidate.end,
        Math.max(window.start, Math.min(candidate.start, window.end - 30)) + maxMinutes,
        window.end
      )
    )
  }));
}
