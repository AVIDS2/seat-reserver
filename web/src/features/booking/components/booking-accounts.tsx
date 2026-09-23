'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { cn } from '@/lib/utils';
import { getCampusDefinition, type CampusCode } from '@/config/campus-config';
import { useCampusWorkspace } from '@/features/campus/campus-workspace';
import { CampusLogo, CampusPicker } from '@/features/campus/components/campus-switcher';

import {
  createSchoolAccount,
  connectSchoolService,
  deleteSchoolAccount,
  getClientSnapshot,
  refreshSchoolAccount,
  updateSchoolAccount,
  type CreateAccountPayload,
  type UpdateAccountPayload
} from '../api/service';
import type { BookingAccount } from '../types';

function AccountEditorDialog({
  open,
  onOpenChange,
  account,
  onSave
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: BookingAccount;
  onSave: (payload: CreateAccountPayload | UpdateAccountPayload, id?: string) => Promise<void>;
}) {
  const [label, setLabel] = useState('');
  const [schoolCode, setSchoolCode] = useState<CampusCode>('cczu');
  const [schoolUsername, setSchoolUsername] = useState('');
  const [schoolPassword, setSchoolPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLabel(account?.label || '');
    setSchoolCode(account?.schoolCode || 'cczu');
    setSchoolUsername('');
    setSchoolPassword('');
  }, [account, open]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!label.trim() || (!account && !schoolUsername.trim()) || (!account && !schoolPassword)) {
      toast.error('请填写账号名称、学校账号和密码');
      return;
    }
    setSaving(true);
    try {
      const username = schoolUsername.trim();
      if (account) {
        await onSave(
          {
            label: label.trim(),
            ...(username ? { schoolUsername: username } : {}),
            ...(schoolPassword ? { schoolPassword } : {})
          },
          account.id
        );
      } else {
        await onSave(
          { schoolCode, label: label.trim(), schoolUsername: username, schoolPassword },
          undefined
        );
      }
      setLabel('');
      setSchoolUsername('');
      setSchoolPassword('');
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : account ? '更新账号失败' : '添加账号失败'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex h-[calc(100svh-1rem)] max-h-[calc(100svh-1rem)] w-[calc(100%-1rem)] flex-col overflow-hidden overscroll-contain sm:h-auto sm:max-h-[calc(100svh-2rem)] sm:max-w-[480px]'>
        <DialogHeader className='shrink-0 pr-8'>
          <DialogTitle>{account ? '编辑学校账号' : '添加学校账号'}</DialogTitle>
          <DialogDescription>
            {account
              ? '修改账号或密码时，会重新验证登录。密码留空表示不修改。'
              : '会立即验证登录，验证通过后再保存账号。'}
          </DialogDescription>
        </DialogHeader>
        <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-0.5'>
          <form id='school-account-editor' onSubmit={submit} className='flex flex-col gap-4 pb-1'>
            <div className='flex flex-col gap-2'>
              <Label>绑定高校</Label>
              <CampusPicker
                value={schoolCode}
                onValueChange={setSchoolCode}
                disabled={Boolean(account)}
              />
              {account ? (
                <p className='text-muted-foreground text-xs'>
                  高校归属固定，避免账号、任务和授权数据串校。
                </p>
              ) : (
                <p className='text-muted-foreground text-xs'>
                  每所高校使用独立的授权链路和场馆目录。
                </p>
              )}
            </div>
            <div className='flex flex-col gap-2'>
              <Label htmlFor='account-label'>账号名称</Label>
              <Input
                id='account-label'
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder='例如：我的账号'
                required
              />
            </div>
            <div className='flex flex-col gap-2'>
              <Label htmlFor='school-username'>学校账号</Label>
              <Input
                id='school-username'
                value={schoolUsername}
                onChange={(event) => setSchoolUsername(event.target.value)}
                placeholder={account ? '留空保持原账号' : '输入学号或系统账号'}
                required={!account}
              />
            </div>
            <div className='flex flex-col gap-2'>
              <Label htmlFor='school-password'>学校密码</Label>
              <Input
                id='school-password'
                type='password'
                value={schoolPassword}
                onChange={(event) => setSchoolPassword(event.target.value)}
                placeholder={account ? '留空保持原密码' : '不会在页面中显示'}
                required={!account}
              />
            </div>
          </form>
        </div>
        <DialogFooter className='sticky bottom-0 z-10 shrink-0'>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type='submit' form='school-account-editor' disabled={saving}>
            {saving ? '验证中' : account ? '验证并保存' : '验证并添加'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BookingAccountsPage({
  initialAccounts
}: {
  initialAccounts: BookingAccount[];
}) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const { activeCampus } = useCampusWorkspace();
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [connectingService, setConnectingService] = useState<string | null>(null);
  const [editorAccount, setEditorAccount] = useState<BookingAccount | undefined>();
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BookingAccount | null>(null);

  const visibleAccounts = useMemo(() => {
    const scoped =
      activeCampus === 'all'
        ? accounts
        : accounts.filter((account) => (account.schoolCode || 'cczu') === activeCampus);
    return scoped.toSorted((left, right) =>
      (left.schoolCode || 'cczu').localeCompare(right.schoolCode || 'cczu')
    );
  }, [accounts, activeCampus]);

  useEffect(() => {
    let active = true;
    const poll = () => {
      void getClientSnapshot()
        .then((snapshot) => {
          if (active) setAccounts(snapshot.accounts);
        })
        .catch(() => undefined);
    };
    const interval = window.setInterval(poll, 30_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const saveAccount = async (payload: CreateAccountPayload | UpdateAccountPayload, id?: string) => {
    if (id) {
      const updated = await updateSchoolAccount(id, payload as UpdateAccountPayload);
      setAccounts((current) => current.map((item) => (item.id === id ? updated : item)));
      toast.success('账号已更新');
    } else {
      const created = await createSchoolAccount(payload as CreateAccountPayload);
      setAccounts((current) => [...current, created]);
      toast.success('账号验证并保存成功');
    }
  };

  const refreshAccount = async (account: BookingAccount) => {
    setRefreshingId(account.id);
    try {
      const updated = await refreshSchoolAccount(account.id);
      setAccounts((current) => current.map((item) => (item.id === account.id ? updated : item)));
      toast.success(`${account.label} 连接已刷新`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '刷新连接失败');
    } finally {
      setRefreshingId(null);
    }
  };

  const connectService = async (account: BookingAccount, serviceType: 'study_room' | 'library') => {
    const key = `${account.id}:${serviceType}`;
    setConnectingService(key);
    try {
      const updated = await connectSchoolService(account.id, serviceType);
      setAccounts((current) => current.map((item) => (item.id === account.id ? updated : item)));
      toast.success(`${serviceType === 'library' ? '图书馆' : '自习室'}已连接`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '连接预约系统失败');
    } finally {
      setConnectingService(null);
    }
  };

  const removeAccount = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSchoolAccount(deleteTarget.id);
      setAccounts((current) => current.filter((item) => item.id !== deleteTarget.id));
      toast.success('学校账号已移除');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '移除账号失败');
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <PageContainer>
      <div className='mx-auto flex w-full max-w-[1200px] flex-col gap-5 sm:gap-6'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
          <div className='min-w-0'>
            <p className='text-muted-foreground mb-2 text-sm'>学校账号</p>
            <h1 className='text-2xl font-semibold tracking-tight sm:text-3xl'>账号与授权</h1>
            <p className='text-muted-foreground mt-2 text-sm leading-6'>
              一个校园账号可以连接多个座位服务，授权状态分别维护。
            </p>
          </div>
          <Button
            id='nextstep-account-connect'
            className='w-full sm:w-auto'
            variant='outline'
            onClick={() => {
              setEditorAccount(undefined);
              setEditorOpen(true);
            }}
          >
            <Icons.add data-icon='inline-start' />
            添加账号
          </Button>
        </div>
        <Alert>
          <Icons.shield />
          <AlertTitle>账号自动维护已开启</AlertTitle>
          <AlertDescription>
            预约前会自动检查连接，失效时尝试恢复。图书馆需要单独启用，点击账号卡片中的“连接图书馆”即可开始。页面和记录不会显示密码或授权凭证。
          </AlertDescription>
        </Alert>
        {visibleAccounts.length === 0 ? (
          <Card className='shadow-none'>
            <CardContent className='flex flex-col items-center justify-center gap-2 py-16 text-center'>
              <Icons.building className='text-muted-foreground/40 size-10' />
              <p className='text-sm font-medium'>
                {activeCampus === 'all'
                  ? '还没有学校账号'
                  : `${getCampusDefinition(activeCampus).name}还没有学校账号`}
              </p>
              <p className='text-muted-foreground text-xs'>
                添加并验证账号后，才能创建自动预约任务。
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className='grid gap-4 lg:grid-cols-2'>
            {visibleAccounts.map((account, index) => {
              const campus = getCampusDefinition(account.schoolCode);
              const previousCampus =
                index > 0 ? getCampusDefinition(visibleAccounts[index - 1]?.schoolCode) : null;
              const isRefreshing = refreshingId === account.id;
              const connected = account.status === 'connected';
              const recovering = account.status === 'recovering';
              return (
                <Fragment key={account.id}>
                  {(!previousCampus || previousCampus.code !== campus.code) && (
                    <div className='col-span-full flex items-center gap-3 pt-2'>
                      <CampusLogo campus={campus.code} />
                      <div className='min-w-0'>
                        <p className='text-sm font-semibold'>{campus.name}</p>
                        <p className='text-muted-foreground text-xs'>{campus.detail}</p>
                      </div>
                    </div>
                  )}
                  <Card className='min-w-0 shadow-none'>
                    <CardHeader className='border-b'>
                      <div className='flex min-w-0 items-start gap-3'>
                        <div className='bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg'>
                          <Icons.user className='size-5' />
                        </div>
                        <div className='min-w-0'>
                          <CardTitle className='truncate text-lg'>{account.label}</CardTitle>
                          <CardDescription className='mt-1 truncate'>
                            {account.username}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge
                        variant='outline'
                        className={cn(
                          connected
                            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                            : recovering
                              ? 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400'
                              : 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                        )}
                      >
                        {connected ? <Icons.circleCheck /> : <Icons.refresh />}
                        {account.statusLabel}
                      </Badge>
                    </CardHeader>
                    <CardContent className='flex flex-col gap-5 pt-5'>
                      <div className='flex flex-wrap items-center gap-2'>
                        {account.services.map((service) => {
                          const serviceKey = `${account.id}:${service.type}`;
                          const serviceConnected = service.status === 'connected';
                          const serviceRecovering = service.status === 'recovering';
                          const serviceAttention = service.status === 'attention';
                          return (
                            <div key={service.type} className='flex items-center gap-1.5'>
                              <Badge
                                variant='outline'
                                className={cn(
                                  serviceConnected
                                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                    : serviceRecovering
                                      ? 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400'
                                      : serviceAttention
                                        ? 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                        : 'text-muted-foreground'
                                )}
                              >
                                {service.label} ·{' '}
                                {serviceConnected
                                  ? '已连接'
                                  : serviceRecovering
                                    ? '正在恢复连接'
                                    : serviceAttention
                                      ? '登录已失效'
                                      : '未连接'}
                              </Badge>
                              {!serviceConnected && (
                                <Button
                                  type='button'
                                  variant='outline'
                                  size='xs'
                                  onClick={() => void connectService(account, service.type)}
                                  disabled={connectingService === serviceKey}
                                >
                                  {connectingService === serviceKey
                                    ? '连接中'
                                    : serviceRecovering
                                      ? '立即重试'
                                      : serviceAttention
                                        ? '验证账号'
                                        : `连接${service.label}`}
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className='grid grid-cols-2 gap-4'>
                        <Info label='授权状态' value={account.tokenLabel} />
                        <Info label='关联任务' value={`${account.tasks} 个任务`} />
                        <Info label='最近刷新' value={account.refreshedAt} />
                        <Info label='最近验证' value={account.lastVerifiedAt} />
                      </div>
                      <div className='flex flex-wrap justify-end gap-2 border-t pt-4'>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => {
                            setEditorAccount(account);
                            setEditorOpen(true);
                          }}
                        >
                          <Icons.edit data-icon='inline-start' />
                          编辑
                        </Button>
                        <Button
                          variant='ghost'
                          size='sm'
                          className='text-destructive'
                          onClick={() => setDeleteTarget(account)}
                        >
                          <Icons.trash data-icon='inline-start' />
                          移除
                        </Button>
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => void refreshAccount(account)}
                          disabled={isRefreshing}
                        >
                          <Icons.refresh className={cn(isRefreshing && 'animate-spin')} />
                          {isRefreshing ? '检查中' : '验证账号'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </Fragment>
              );
            })}
          </div>
        )}
      </div>
      <AccountEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        account={editorAccount}
        onSave={saveAccount}
      />
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>移除这个学校账号？</AlertDialogTitle>
            <AlertDialogDescription>
              关联任务会停用，历史运行记录保留。之后如需使用，需要重新验证账号密码。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void removeAccount()}>确认移除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className='text-muted-foreground text-xs'>{label}</p>
      <p className='mt-1 text-sm font-medium'>{value}</p>
    </div>
  );
}
