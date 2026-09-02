'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import { createSchoolAccount, deleteSchoolAccount, refreshSchoolAccount, updateSchoolAccount, type CreateAccountPayload, type UpdateAccountPayload } from '../api/service';
import type { BookingAccount } from '../types';

function AccountEditorDialog({ open, onOpenChange, account, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; account?: BookingAccount; onSave: (payload: CreateAccountPayload | UpdateAccountPayload, id?: string) => Promise<void> }) {
  const [label, setLabel] = useState('');
  const [schoolUsername, setSchoolUsername] = useState('');
  const [schoolPassword, setSchoolPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLabel(account?.label || '');
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
        await onSave({ label: label.trim(), ...(username ? { schoolUsername: username } : {}), ...(schoolPassword ? { schoolPassword } : {}) }, account.id);
      } else {
        await onSave({ label: label.trim(), schoolUsername: username, schoolPassword }, undefined);
      }
      setLabel('');
      setSchoolUsername('');
      setSchoolPassword('');
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : account ? '更新账号失败' : '添加账号失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[480px]'>
        <DialogHeader>
          <DialogTitle>{account ? '编辑学校账号' : '添加学校账号'}</DialogTitle>
          <DialogDescription>{account ? '修改学校账号或密码时，系统会重新完成正常登录验证。密码留空表示不修改。' : '系统会立即完成一次正常登录验证，验证通过后才会保存账号。'}</DialogDescription>
        </DialogHeader>
        <form id='school-account-editor' onSubmit={submit} className='flex flex-col gap-4'>
          <div className='flex flex-col gap-2'><Label htmlFor='account-label'>账号名称</Label><Input id='account-label' value={label} onChange={(event) => setLabel(event.target.value)} placeholder='例如：我的账号' required /></div>
          <div className='flex flex-col gap-2'><Label htmlFor='school-username'>学校账号</Label><Input id='school-username' value={schoolUsername} onChange={(event) => setSchoolUsername(event.target.value)} placeholder={account ? '留空保持原账号' : '输入学号或系统账号'} required={!account} /></div>
          <div className='flex flex-col gap-2'><Label htmlFor='school-password'>学校密码</Label><Input id='school-password' type='password' value={schoolPassword} onChange={(event) => setSchoolPassword(event.target.value)} placeholder={account ? '留空保持原密码' : '不会在页面中显示'} required={!account} /></div>
        </form>
        <DialogFooter><Button type='button' variant='outline' onClick={() => onOpenChange(false)}>取消</Button><Button type='submit' form='school-account-editor' disabled={saving}>{saving ? '验证中' : account ? '验证并保存' : '验证并添加'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BookingAccountsPage({ initialAccounts }: { initialAccounts: BookingAccount[] }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [editorAccount, setEditorAccount] = useState<BookingAccount | undefined>();
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BookingAccount | null>(null);

  const saveAccount = async (payload: CreateAccountPayload | UpdateAccountPayload, id?: string) => {
    if (id) {
      const updated = await updateSchoolAccount(id, payload as UpdateAccountPayload);
      setAccounts((current) => current.map((item) => item.id === id ? updated : item));
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
      setAccounts((current) => current.map((item) => item.id === account.id ? updated : item));
      toast.success(`${account.label} Token 已刷新`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '刷新 Token 失败');
    } finally {
      setRefreshingId(null);
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
      <div className='mx-auto w-full max-w-[1200px] space-y-6'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'><div><p className='text-muted-foreground mb-2 text-sm'>连接管理</p><h1 className='text-2xl font-semibold tracking-tight sm:text-3xl'>账号与授权</h1><p className='text-muted-foreground mt-2 text-sm leading-6'>学校凭据只在后端加密保存，用于正常登录、Token 验证和预约。</p></div><Button variant='outline' onClick={() => { setEditorAccount(undefined); setEditorOpen(true); }}><Icons.add data-icon='inline-start' />添加账号</Button></div>
        <Alert><Icons.shield /><AlertTitle>自动续期已开启</AlertTitle><AlertDescription>系统会在每天预约前先验证缓存 Token；失效时自动用学校账号密码重新登录。页面不会显示 Token 或密码。</AlertDescription></Alert>
        {accounts.length === 0 ? <Card className='shadow-none'><CardContent className='flex flex-col items-center justify-center gap-2 py-16 text-center'><Icons.shield className='text-muted-foreground/40 size-10' /><p className='text-sm font-medium'>还没有学校账号</p><p className='text-muted-foreground text-xs'>添加并验证账号后，才能创建自动预约任务。</p></CardContent></Card> : <div className='grid gap-4 lg:grid-cols-2'>{accounts.map((account) => { const isRefreshing = refreshingId === account.id; const connected = account.status === 'connected'; return <Card key={account.id} className='shadow-none'><CardHeader className='border-b'><div className='flex items-start gap-3'><div className='bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg'><Icons.user className='size-5' /></div><div><CardTitle className='text-lg'>{account.label}</CardTitle><CardDescription className='mt-1'>{account.username}</CardDescription></div></div><Badge variant='outline' className={cn(connected ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400')}><Icons.circleCheck />{account.statusLabel}</Badge></CardHeader><CardContent className='flex flex-col gap-5 pt-5'><div className='grid grid-cols-2 gap-4'><Info label='授权状态' value={account.tokenLabel} /><Info label='关联任务' value={`${account.tasks} 个任务`} /><Info label='最近刷新' value={account.refreshedAt} /><Info label='最近验证' value={account.lastVerifiedAt} /></div><div className='flex flex-wrap justify-end gap-2 border-t pt-4'><Button variant='ghost' size='sm' onClick={() => { setEditorAccount(account); setEditorOpen(true); }}><Icons.edit data-icon='inline-start' />编辑</Button><Button variant='ghost' size='sm' className='text-destructive' onClick={() => setDeleteTarget(account)}><Icons.trash data-icon='inline-start' />移除</Button><Button variant='outline' size='sm' onClick={() => void refreshAccount(account)} disabled={isRefreshing}><Icons.refresh className={cn(isRefreshing && 'animate-spin')} />{isRefreshing ? '刷新中' : '刷新 Token'}</Button></div></CardContent></Card>; })}</div>}
      </div>
      <AccountEditorDialog open={editorOpen} onOpenChange={setEditorOpen} account={editorAccount} onSave={saveAccount} />
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>移除这个学校账号？</AlertDialogTitle><AlertDialogDescription>关联任务会停用，历史运行记录保留。之后如需使用，需要重新验证账号密码。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={() => void removeAccount()}>确认移除</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </PageContainer>
  );
}

function Info({ label, value }: { label: string; value: string }) { return <div><p className='text-muted-foreground text-xs'>{label}</p><p className='mt-1 text-sm font-medium'>{value}</p></div>; }
