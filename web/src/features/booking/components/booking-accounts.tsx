'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PageContainer from '@/components/layout/page-container';
import { cn } from '@/lib/utils';

import { createSchoolAccount, isDemoMode, refreshSchoolAccount } from '../api/service';
import type { BookingAccount } from '../types';

function AddAccountDialog({
  open,
  onOpenChange,
  onCreate
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (payload: { label: string; schoolUsername: string; schoolPassword: string }) => Promise<void>;
}) {
  const [label, setLabel] = useState('');
  const [schoolUsername, setSchoolUsername] = useState('');
  const [schoolPassword, setSchoolPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onCreate({ label, schoolUsername, schoolPassword });
      setLabel('');
      setSchoolUsername('');
      setSchoolPassword('');
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '添加账号失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[480px]'>
        <DialogHeader>
          <DialogTitle>添加学校账号</DialogTitle>
          <DialogDescription>系统会立即完成一次正常登录验证，验证通过后才会保存账号。</DialogDescription>
        </DialogHeader>
        <form id='add-school-account' onSubmit={submit} className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='account-label'>账号名称</Label>
            <Input id='account-label' value={label} onChange={(event) => setLabel(event.target.value)} placeholder='例如：我的账号' required />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='school-username'>学校账号</Label>
            <Input id='school-username' value={schoolUsername} onChange={(event) => setSchoolUsername(event.target.value)} placeholder='输入学号或系统账号' required />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='school-password'>学校密码</Label>
            <Input id='school-password' type='password' value={schoolPassword} onChange={(event) => setSchoolPassword(event.target.value)} placeholder='不会在页面中显示' required />
          </div>
        </form>
        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>取消</Button>
          <Button type='submit' form='add-school-account' disabled={saving}>{saving ? '验证中' : '验证并保存'}</Button>
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
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const refreshAccount = async (account: BookingAccount) => {
    setRefreshingId(account.id);
    try {
      const updated = await refreshSchoolAccount(account.id);
      setAccounts((current) => current.map((item) => item.id === account.id ? updated : item));
      toast.success(`${account.label} Token 已刷新`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '刷新 Token 失败');
    } finally {
      setRefreshingId(null);
    }
  };

  const addAccount = async (payload: Parameters<typeof createSchoolAccount>[0]) => {
    const created = await createSchoolAccount(payload);
    setAccounts((current) => [...current, created]);
    toast.success(isDemoMode() ? '演示账号已添加' : '账号验证并保存成功');
  };

  return (
    <PageContainer>
      <div className='mx-auto w-full max-w-[1200px] space-y-6'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
          <div>
            <p className='text-muted-foreground mb-2 text-sm'>连接管理</p>
            <h1 className='text-2xl font-semibold tracking-tight sm:text-3xl'>账号与授权</h1>
            <p className='text-muted-foreground mt-2 text-sm leading-6'>
              账号凭据仅用于正常登录和预约请求，敏感信息不会展示在页面上。
            </p>
          </div>
          <Button variant='outline' onClick={() => setAddOpen(true)}>
            <Icons.add />
            添加账号
          </Button>
        </div>

        <div className='border-emerald-500/20 bg-emerald-500/5 flex items-start gap-3 rounded-xl border p-4'>
          <Icons.shield className='mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400' />
          <div>
            <p className='text-sm font-medium'>授权链路正常</p>
            <p className='text-muted-foreground mt-1 text-xs leading-5'>
              最近一次检查已通过。系统会在每日执行前自动刷新 Token，并使用当前客户端请求参数。
            </p>
          </div>
        </div>

        <div className='grid gap-4 lg:grid-cols-2'>
          {accounts.map((account) => {
            const isRefreshing = refreshingId === account.id;
            return (
              <Card key={account.id} className='shadow-none'>
                <CardHeader className='border-b'>
                  <div className='flex items-start gap-3'>
                    <div className='bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg'>
                      <Icons.user className='size-5' />
                    </div>
                    <div>
                      <CardTitle className='text-lg'>{account.label}</CardTitle>
                      <CardDescription className='mt-1'>{account.username}</CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant='outline'
                    className={cn(
                      'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    )}
                  >
                    <Icons.circleCheck />
                    {account.statusLabel}
                  </Badge>
                </CardHeader>
                <CardContent className='space-y-5 pt-5'>
                  <div className='grid grid-cols-2 gap-4'>
                    <div>
                      <p className='text-muted-foreground text-xs'>授权状态</p>
                      <p className='mt-1 text-sm font-medium'>{account.tokenLabel}</p>
                    </div>
                    <div>
                      <p className='text-muted-foreground text-xs'>关联任务</p>
                      <p className='mt-1 text-sm font-medium'>{account.tasks} 个任务</p>
                    </div>
                    <div>
                      <p className='text-muted-foreground text-xs'>最近刷新</p>
                      <p className='mt-1 text-sm font-medium'>{account.refreshedAt}</p>
                    </div>
                    <div>
                      <p className='text-muted-foreground text-xs'>最近验证</p>
                      <p className='mt-1 text-sm font-medium'>{account.lastVerifiedAt}</p>
                    </div>
                  </div>
                  <div className='flex justify-end gap-2 border-t pt-4'>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => toast.info('账号编辑功能即将接入')}
                    >
                      <Icons.settings />
                      管理
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => refreshAccount(account)}
                      disabled={isRefreshing}
                    >
                      <Icons.refresh className={cn(isRefreshing && 'animate-spin')} />
                      {isRefreshing ? '刷新中' : '刷新 Token'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
      <AddAccountDialog open={addOpen} onOpenChange={setAddOpen} onCreate={addAccount} />
    </PageContainer>
  );
}
