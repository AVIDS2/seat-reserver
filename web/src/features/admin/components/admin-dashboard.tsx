'use client';

import { useState } from 'react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePlatformSession } from '@/features/auth/platform-session';
import {
  createInvitation,
  disableInvitation,
  getAdminAccounts,
  getAdminOverview,
  getAdminRuns,
  getAdminTasks,
  getAdminUsers,
  getAdminProRequests,
  getInvitations,
  grantAdminPro,
  rejectAdminProRequest,
  type AdminAccount,
  setAdminUserEnabled,
  type AdminRun,
  type AdminTask,
  type AdminOverview,
  type AdminProRequest,
  type AdminUser,
  type Invitation
} from '@/features/booking/api/service';

export type AdminSnapshot = {
  overview: AdminOverview;
  users: AdminUser[];
  invitations: Invitation[];
  accounts: AdminAccount[];
  tasks: AdminTask[];
  runs: AdminRun[];
  proRequests: AdminProRequest[];
};

export default function AdminDashboard({ initialData }: { initialData: AdminSnapshot }) {
  const session = usePlatformSession();
  const [overview, setOverview] = useState(initialData.overview);
  const [users, setUsers] = useState(initialData.users);
  const [invitations, setInvitations] = useState(initialData.invitations);
  const [accounts, setAccounts] = useState(initialData.accounts);
  const [tasks, setTasks] = useState(initialData.tasks);
  const [runs, setRuns] = useState(initialData.runs);
  const [proRequests, setProRequests] = useState(initialData.proRequests);
  const [createOpen, setCreateOpen] = useState(false);
  const [maxUses, setMaxUses] = useState('1');
  const [validDays, setValidDays] = useState('30');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [busyProUserId, setBusyProUserId] = useState<string | null>(null);
  const [proTarget, setProTarget] = useState<AdminUser | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refreshAdminData = async () => {
    setRefreshing(true);
    try {
      const [
        nextOverview,
        nextUsers,
        nextInvitations,
        nextAccounts,
        nextTasks,
        nextRuns,
        nextProRequests
      ] = await Promise.all([
        getAdminOverview(),
        getAdminUsers(),
        getInvitations(),
        getAdminAccounts(),
        getAdminTasks(),
        getAdminRuns(),
        getAdminProRequests()
      ]);
      setOverview(nextOverview);
      setUsers(nextUsers);
      setInvitations(nextInvitations);
      setAccounts(nextAccounts);
      setTasks(nextTasks);
      setRuns(nextRuns);
      setProRequests(nextProRequests);
      toast.success('管理员数据已刷新');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '刷新管理员数据失败');
    } finally {
      setRefreshing(false);
    }
  };

  const submitInvitation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const invitation = await createInvitation(Number(maxUses), Number(validDays));
      setInvitations((current) => [invitation, ...current]);
      setGeneratedCode(invitation.code || null);
      setCreateOpen(false);
      toast.success('邀请码已创建', { description: '邀请码只在这里显示一次。' });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '创建邀请码失败');
    } finally {
      setSaving(false);
    }
  };

  const toggleUser = async (user: AdminUser) => {
    setBusyUserId(user.id);
    try {
      const updated = await setAdminUserEnabled(user.id, user.status !== 'active');
      setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setOverview((current) => ({
        ...current,
        activeUsers: current.activeUsers + (updated.status === 'active' ? 1 : -1)
      }));
      toast.success(updated.status === 'active' ? '用户已启用' : '用户已禁用');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '更新用户状态失败');
    } finally {
      setBusyUserId(null);
    }
  };

  const revokeInvitation = async (invitation: Invitation) => {
    try {
      const updated = await disableInvitation(invitation.id);
      setInvitations((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      toast.success('邀请码已停用');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '停用邀请码失败');
    }
  };

  const grantUserPro = async (user: AdminUser) => {
    setBusyProUserId(user.id);
    try {
      await grantAdminPro(user.id, '管理员确认开通');
      setUsers((current) =>
        current.map((item) => (item.id === user.id ? { ...item, plan: 'pro' } : item))
      );
      setProRequests((current) =>
        current.map((item) =>
          item.userId === user.id && item.status === 'pending'
            ? { ...item, status: 'approved', handledAt: new Date().toISOString() }
            : item
        )
      );
      setOverview((current) => ({
        ...current,
        proUsers: current.proUsers + (user.plan === 'pro' ? 0 : 1),
        pendingProRequests: Math.max(
          0,
          current.pendingProRequests -
            (proRequests.some((item) => item.userId === user.id && item.status === 'pending')
              ? 1
              : 0)
        )
      }));
      toast.success(`${user.displayName} 已永久开通 Pro`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '开通 Pro 失败');
    } finally {
      setBusyProUserId(null);
    }
  };

  const rejectPro = async (request: AdminProRequest) => {
    setBusyProUserId(request.userId);
    try {
      const updated = await rejectAdminProRequest(request.id, '管理员关闭申请');
      setProRequests((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      setOverview((current) => ({
        ...current,
        pendingProRequests: Math.max(0, current.pendingProRequests - 1)
      }));
      toast.success('Pro 申请已关闭');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '关闭 Pro 申请失败');
    } finally {
      setBusyProUserId(null);
    }
  };

  const copyCode = async () => {
    if (!generatedCode) return;
    await navigator.clipboard.writeText(generatedCode);
    toast.success('邀请码已复制');
  };

  return (
    <PageContainer>
      <div className='mx-auto w-full max-w-[1440px] space-y-5 sm:space-y-6'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
          <div>
            <p className='text-muted-foreground mb-2 text-sm'>平台运营</p>
            <h1 className='text-2xl font-semibold tracking-tight sm:text-3xl'>管理员工作台</h1>
            <p className='text-muted-foreground mt-2 text-sm leading-6'>
              管理成员、邀请码和全平台预约运行状态。
            </p>
          </div>
          <div className='grid grid-cols-2 gap-2 sm:flex'>
            <Button
              className='w-full sm:w-auto'
              variant='outline'
              onClick={() => void refreshAdminData()}
              disabled={refreshing}
            >
              <Icons.refresh
                className={refreshing ? 'animate-spin' : ''}
                data-icon='inline-start'
              />
              {refreshing ? '刷新中' : '刷新数据'}
            </Button>
            <Button className='w-full sm:w-auto' onClick={() => setCreateOpen(true)}>
              <Icons.add data-icon='inline-start' />
              创建邀请码
            </Button>
          </div>
        </div>

        {generatedCode && (
          <Alert>
            <Icons.badgeCheck />
            <AlertTitle>邀请码已生成</AlertTitle>
            <AlertDescription className='flex flex-col items-stretch gap-3 sm:flex-row sm:items-center'>
              <code className='bg-muted min-w-0 break-all rounded px-2 py-1 font-mono text-sm'>
                {generatedCode}
              </code>
              <Button
                className='w-full sm:w-auto'
                type='button'
                variant='outline'
                size='sm'
                onClick={() => void copyCode()}
              >
                <Icons.copy data-icon='inline-start' />
                复制邀请码
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-5'>
          <StatCard
            label='平台用户'
            value={`${overview.activeUsers} / ${overview.users}`}
            detail='启用用户 / 总用户'
            icon={Icons.teams}
          />
          <StatCard
            label='学校账号'
            value={`${overview.connectedAccounts} / ${overview.accounts}`}
            detail='已连接 / 总账号'
            icon={Icons.shield}
          />
          <StatCard
            label='自动任务'
            value={`${overview.enabledTasks} / ${overview.tasks}`}
            detail='启用任务 / 总任务'
            icon={Icons.target}
          />
          <StatCard
            label='今日运行'
            value={`${overview.successfulRunsToday} 成功`}
            detail={`${overview.failedRunsToday} 次未成功 · 自动执行${overview.queueStatus === 'ok' ? '正常' : '需检查'}`}
            icon={Icons.history}
          />
          <StatCard
            label='Pro 会员'
            value={`${overview.proUsers} 人`}
            detail={`${overview.pendingProRequests} 个申请待处理`}
            icon={Icons.pro}
          />
        </div>

        <div className='grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]'>
          <Card className='shadow-none'>
            <CardHeader className='border-b'>
              <CardTitle className='text-xl'>成员管理</CardTitle>
              <CardDescription>普通用户只能访问自己的账号、任务和运行记录。</CardDescription>
            </CardHeader>
            <CardContent className='pt-2'>
              <Table className='hidden min-w-[680px] lg:table'>
                <TableHeader>
                  <TableRow>
                    <TableHead>用户</TableHead>
                    <TableHead>角色 / 方案</TableHead>
                    <TableHead>资源</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className='text-right'>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const isCurrent = user.id === session?.id;
                    const isBusy = busyUserId === user.id;
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className='min-w-[180px]'>
                            <p className='font-medium'>
                              {user.displayName}
                              {isCurrent ? '（你）' : ''}
                            </p>
                            <p className='text-muted-foreground mt-1 text-xs'>
                              {user.email || '未设置邮箱'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className='flex flex-wrap gap-1.5'>
                            <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                              {user.role === 'admin' ? '管理员' : '普通用户'}
                            </Badge>
                            <Badge variant={user.plan === 'pro' ? 'outline' : 'secondary'}>
                              {user.plan === 'pro'
                                ? 'Pro'
                                : user.plan === 'admin'
                                  ? '全权限'
                                  : '基础版'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className='text-muted-foreground text-xs'>
                          {user.accountCount} 账号 · {user.taskCount} 任务
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.status === 'active' ? 'outline' : 'destructive'}>
                            {user.status === 'active' ? '正常' : '已禁用'}
                          </Badge>
                        </TableCell>
                        <TableCell className='text-right'>
                          <div className='flex justify-end gap-1'>
                            {user.role !== 'admin' && user.plan !== 'pro' && (
                              <Button
                                variant='outline'
                                size='sm'
                                disabled={isCurrent || busyProUserId === user.id}
                                onClick={() => setProTarget(user)}
                              >
                                {busyProUserId === user.id ? '处理中' : '开通 Pro'}
                              </Button>
                            )}
                            <Button
                              variant='ghost'
                              size='sm'
                              disabled={isCurrent || isBusy}
                              onClick={() => void toggleUser(user)}
                            >
                              {isBusy ? (
                                <Icons.spinner className='animate-spin' />
                              ) : user.status === 'active' ? (
                                '禁用'
                              ) : (
                                '启用'
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className='flex flex-col gap-2 lg:hidden'>
                {users.length === 0 ? (
                  <p className='text-muted-foreground py-12 text-center text-sm'>暂无成员</p>
                ) : (
                  users.map((user) => {
                    const isCurrent = user.id === session?.id;
                    const isBusy = busyUserId === user.id;
                    return (
                      <div
                        key={user.id}
                        className='flex min-w-0 items-start justify-between gap-3 rounded-lg border p-3'
                      >
                        <div className='min-w-0'>
                          <p className='truncate font-medium'>
                            {user.displayName}
                            {isCurrent ? '（你）' : ''}
                          </p>
                          <p className='text-muted-foreground mt-1 truncate text-xs'>
                            {user.email || '未设置邮箱'}
                          </p>
                          <div className='mt-3 flex flex-wrap items-center gap-2'>
                            <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                              {user.role === 'admin' ? '管理员' : '普通用户'}
                            </Badge>
                            <Badge variant={user.plan === 'pro' ? 'outline' : 'secondary'}>
                              {user.plan === 'pro'
                                ? 'Pro'
                                : user.plan === 'admin'
                                  ? '全权限'
                                  : '基础版'}
                            </Badge>
                            <Badge variant={user.status === 'active' ? 'outline' : 'destructive'}>
                              {user.status === 'active' ? '正常' : '已禁用'}
                            </Badge>
                            <span className='text-muted-foreground text-xs'>
                              {user.accountCount} 账号 · {user.taskCount} 任务
                            </span>
                          </div>
                        </div>
                        <div className='flex shrink-0 flex-col items-end gap-1'>
                          {user.role !== 'admin' && user.plan !== 'pro' && (
                            <Button
                              variant='outline'
                              size='sm'
                              disabled={isCurrent || busyProUserId === user.id}
                              onClick={() => setProTarget(user)}
                            >
                              {busyProUserId === user.id ? '处理中' : '开通 Pro'}
                            </Button>
                          )}
                          <Button
                            variant='ghost'
                            size='sm'
                            disabled={isCurrent || isBusy}
                            onClick={() => void toggleUser(user)}
                          >
                            {isBusy ? (
                              <Icons.spinner className='animate-spin' />
                            ) : user.status === 'active' ? (
                              '禁用'
                            ) : (
                              '启用'
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          <Card className='shadow-none'>
            <CardHeader className='border-b'>
              <CardTitle className='text-xl'>邀请码</CardTitle>
              <CardDescription>注册成功后邀请码按使用次数自动耗尽。</CardDescription>
            </CardHeader>
            <CardContent className='pt-0'>
              {invitations.length === 0 ? (
                <div className='text-muted-foreground py-12 text-center text-sm'>还没有邀请码</div>
              ) : (
                <div className='flex flex-col gap-2'>
                  {invitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className='flex items-start justify-between gap-3 border-b py-3 last:border-0 sm:items-center'
                    >
                      <div className='min-w-0'>
                        <p className='font-mono text-sm'>
                          使用 {invitation.usedCount} / {invitation.maxUses}
                        </p>
                        <p className='text-muted-foreground mt-1 text-xs'>
                          {invitation.expiresAt
                            ? `有效至 ${formatDate(invitation.expiresAt)}`
                            : '长期有效'}
                        </p>
                      </div>
                      <div className='flex shrink-0 flex-wrap items-center justify-end gap-2'>
                        <Badge variant={invitation.status === 'active' ? 'outline' : 'secondary'}>
                          {invitation.status === 'active'
                            ? '可用'
                            : invitation.status === 'exhausted'
                              ? '已用完'
                              : '已停用'}
                        </Badge>
                        {invitation.status === 'active' && (
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={() => void revokeInvitation(invitation)}
                          >
                            停用
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className='shadow-none'>
          <CardHeader className='border-b'>
            <div className='flex items-start justify-between gap-3'>
              <div>
                <CardTitle className='text-xl'>Pro 开通申请</CardTitle>
                <CardDescription>确认外部收款后，在这里授予永久 Pro 权益。</CardDescription>
              </div>
              <Badge
                variant={
                  proRequests.some((item) => item.status === 'pending') ? 'default' : 'secondary'
                }
              >
                {proRequests.filter((item) => item.status === 'pending').length} 待处理
              </Badge>
            </div>
          </CardHeader>
          <CardContent className='pt-4'>
            {proRequests.length === 0 ? (
              <p className='text-muted-foreground py-8 text-center text-sm'>
                暂时没有 Pro 开通申请
              </p>
            ) : (
              <div className='flex flex-col gap-3'>
                {proRequests.map((request) => (
                  <div
                    key={request.id}
                    className='flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between'
                  >
                    <div className='min-w-0'>
                      <div className='flex flex-wrap items-center gap-2'>
                        <p className='font-medium'>{request.userName}</p>
                        <Badge variant={request.status === 'pending' ? 'outline' : 'secondary'}>
                          {request.status === 'pending'
                            ? '待确认'
                            : request.status === 'approved'
                              ? '已开通'
                              : '已关闭'}
                        </Badge>
                      </div>
                      <p className='text-muted-foreground mt-1 truncate text-xs'>
                        {request.userEmail || '未设置邮箱'} · ¥{request.priceCents / 100} / 永久 ·{' '}
                        {formatDateTime(request.createdAt)}
                      </p>
                    </div>
                    {request.status === 'pending' && (
                      <div className='grid w-full grid-cols-2 gap-2 sm:w-auto'>
                        <Button
                          size='sm'
                          onClick={() => {
                            const user = users.find((item) => item.id === request.userId);
                            if (user) void grantUserPro(user);
                          }}
                          disabled={busyProUserId === request.userId}
                        >
                          {busyProUserId === request.userId ? '处理中' : '确认并开通'}
                        </Button>
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() => void rejectPro(request)}
                          disabled={busyProUserId === request.userId}
                        >
                          关闭申请
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue='runs' className='w-full'>
          <TabsList className='sticky top-16 z-10 -mx-4 w-[calc(100%+2rem)] max-w-none overflow-x-auto rounded-none border-b bg-background/95 px-4 py-2 backdrop-blur sm:static sm:mx-0 sm:w-fit sm:max-w-full sm:rounded-lg sm:border-0 sm:bg-muted sm:p-[3px]'>
            <TabsTrigger value='runs'>全局运行记录 ({runs.length})</TabsTrigger>
            <TabsTrigger value='tasks'>全局任务 ({tasks.length})</TabsTrigger>
            <TabsTrigger value='accounts'>学校账号 ({accounts.length})</TabsTrigger>
          </TabsList>

          <TabsContent value='runs' className='mt-4'>
            <Card className='shadow-none'>
              <CardHeader className='border-b'>
                <CardTitle className='text-xl'>全局运行记录</CardTitle>
                <CardDescription>
                  仅显示运行结果和归属信息，不显示学校密码、登录凭证或原始敏感请求。
                </CardDescription>
              </CardHeader>
              <CardContent className='overflow-x-auto px-3 pt-3 sm:px-4'>
                <Table className='hidden min-w-[880px] lg:table'>
                  <TableHeader>
                    <TableRow>
                      <TableHead>开始时间</TableHead>
                      <TableHead>成员</TableHead>
                      <TableHead>任务 / 账号</TableHead>
                      <TableHead>目标日期</TableHead>
                      <TableHead>结果</TableHead>
                      <TableHead>状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className='text-muted-foreground py-12 text-center'>
                          暂无运行记录
                        </TableCell>
                      </TableRow>
                    ) : (
                      runs.map((run) => (
                        <TableRow key={run.id}>
                          <TableCell className='text-muted-foreground text-xs'>
                            {run.startedAt}
                          </TableCell>
                          <TableCell>
                            <p className='text-sm font-medium'>{run.ownerName}</p>
                            <p className='text-muted-foreground text-xs'>
                              {run.ownerEmail || '未设置邮箱'}
                            </p>
                          </TableCell>
                          <TableCell>
                            <p className='text-sm font-medium'>{run.task}</p>
                            <p className='text-muted-foreground text-xs'>{run.account}</p>
                          </TableCell>
                          <TableCell className='text-sm'>{run.targetDate}</TableCell>
                          <TableCell>
                            <p className='text-sm'>{run.result}</p>
                            <p className='text-muted-foreground max-w-[240px] truncate text-xs'>
                              {run.detail}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                run.status === 'success'
                                  ? 'outline'
                                  : run.status === 'failed'
                                    ? 'destructive'
                                    : 'secondary'
                              }
                            >
                              {run.statusLabel}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <div className='flex flex-col gap-2 lg:hidden'>
                  {runs.length === 0 ? (
                    <p className='text-muted-foreground py-12 text-center text-sm'>暂无运行记录</p>
                  ) : (
                    runs.map((run) => (
                      <div
                        key={run.id}
                        className='flex min-w-0 flex-col gap-3 rounded-lg border p-3'
                      >
                        <div className='flex min-w-0 items-start justify-between gap-3'>
                          <div className='min-w-0'>
                            <p className='truncate text-sm font-medium'>{run.task}</p>
                            <p className='text-muted-foreground mt-1 truncate text-xs'>
                              {run.account} · {run.ownerName}
                            </p>
                          </div>
                          <Badge
                            className='shrink-0'
                            variant={
                              run.status === 'success'
                                ? 'outline'
                                : run.status === 'failed'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                          >
                            {run.statusLabel}
                          </Badge>
                        </div>
                        <div className='grid grid-cols-2 gap-3 text-xs'>
                          <div>
                            <p className='text-muted-foreground'>开始时间</p>
                            <p className='mt-1'>{run.startedAt}</p>
                          </div>
                          <div>
                            <p className='text-muted-foreground'>目标日期</p>
                            <p className='mt-1'>{run.targetDate}</p>
                          </div>
                          <div>
                            <p className='text-muted-foreground'>结果</p>
                            <p className='mt-1'>{run.result}</p>
                          </div>
                          <div>
                            <p className='text-muted-foreground'>尝试次数</p>
                            <p className='mt-1'>{run.attempts} 次</p>
                          </div>
                        </div>
                        <p className='text-muted-foreground line-clamp-2 text-xs'>{run.detail}</p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value='tasks' className='mt-4'>
            <Card className='shadow-none'>
              <CardHeader className='border-b'>
                <CardTitle className='text-xl'>全局任务</CardTitle>
                <CardDescription>
                  管理员可以检查所有成员的任务状态，但任务仍由所属成员独立管理。
                </CardDescription>
              </CardHeader>
              <CardContent className='overflow-x-auto px-3 pt-3 sm:px-4'>
                <Table className='hidden min-w-[820px] lg:table'>
                  <TableHeader>
                    <TableRow>
                      <TableHead>任务</TableHead>
                      <TableHead>成员</TableHead>
                      <TableHead>账号</TableHead>
                      <TableHead>策略</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>最近运行</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className='text-muted-foreground py-12 text-center'>
                          暂无任务
                        </TableCell>
                      </TableRow>
                    ) : (
                      tasks.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell>
                            <p className='text-sm font-medium'>{task.name}</p>
                            <p className='text-muted-foreground text-xs'>{task.seat}</p>
                            <p className='text-muted-foreground mt-1 max-w-[220px] truncate text-xs'>
                              {formatLocation(task.building, task.venueType, task.roomName)}
                            </p>
                          </TableCell>
                          <TableCell>
                            <p className='text-sm'>{task.ownerName}</p>
                            <p className='text-muted-foreground text-xs'>
                              {task.ownerEmail || '未设置邮箱'}
                            </p>
                          </TableCell>
                          <TableCell className='text-sm'>{task.account}</TableCell>
                          <TableCell>
                            <p className='text-sm'>{task.time}</p>
                            <p className='text-muted-foreground text-xs'>{task.lastMessage}</p>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                task.status === 'enabled'
                                  ? 'outline'
                                  : task.status === 'attention'
                                    ? 'destructive'
                                    : 'secondary'
                              }
                            >
                              {task.status === 'enabled'
                                ? '启用'
                                : task.status === 'paused'
                                  ? '暂停'
                                  : task.status === 'disabled'
                                    ? '用户已禁用'
                                    : '需要关注'}
                            </Badge>
                          </TableCell>
                          <TableCell className='text-muted-foreground text-xs'>
                            {task.lastRun ? formatDateTime(task.lastRun) : '尚未运行'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <div className='flex flex-col gap-2 lg:hidden'>
                  {tasks.length === 0 ? (
                    <p className='text-muted-foreground py-12 text-center text-sm'>暂无任务</p>
                  ) : (
                    tasks.map((task) => (
                      <div
                        key={task.id}
                        className='flex min-w-0 flex-col gap-3 rounded-lg border p-3'
                      >
                        <div className='flex min-w-0 items-start justify-between gap-3'>
                          <div className='min-w-0'>
                            <p className='truncate text-sm font-medium'>{task.name}</p>
                            <p className='text-muted-foreground mt-1 truncate text-xs'>
                              {task.ownerName} · {task.account}
                            </p>
                          </div>
                          <Badge
                            className='shrink-0'
                            variant={
                              task.status === 'enabled'
                                ? 'outline'
                                : task.status === 'attention'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                          >
                            {task.status === 'enabled'
                              ? '启用'
                              : task.status === 'paused'
                                ? '暂停'
                                : task.status === 'disabled'
                                  ? '用户已禁用'
                                  : '需要关注'}
                          </Badge>
                        </div>
                        <div className='grid grid-cols-2 gap-3 text-xs'>
                          <div>
                            <p className='text-muted-foreground'>座位</p>
                            <p className='mt-1'>{task.seat}</p>
                          </div>
                          <div>
                            <p className='text-muted-foreground'>位置</p>
                            <p className='mt-1'>
                              {formatLocation(task.building, task.venueType, task.roomName)}
                            </p>
                          </div>
                          <div>
                            <p className='text-muted-foreground'>时间</p>
                            <p className='mt-1'>{task.time}</p>
                          </div>
                          <div>
                            <p className='text-muted-foreground'>最近运行</p>
                            <p className='mt-1'>
                              {task.lastRun ? formatDateTime(task.lastRun) : '尚未运行'}
                            </p>
                          </div>
                        </div>
                        <p className='text-muted-foreground line-clamp-2 text-xs'>
                          {task.lastMessage}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value='accounts' className='mt-4'>
            <Card className='shadow-none'>
              <CardHeader className='border-b'>
                <CardTitle className='text-xl'>学校账号</CardTitle>
                <CardDescription>
                  账号标识已脱敏，管理员只查看连接状态和归属，不接触凭据。
                </CardDescription>
              </CardHeader>
              <CardContent className='overflow-x-auto px-3 pt-3 sm:px-4'>
                <Table className='hidden min-w-[760px] lg:table'>
                  <TableHeader>
                    <TableRow>
                      <TableHead>账号</TableHead>
                      <TableHead>成员</TableHead>
                      <TableHead>账号状态</TableHead>
                      <TableHead>关联任务</TableHead>
                      <TableHead>最近验证</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className='text-muted-foreground py-12 text-center'>
                          暂无学校账号
                        </TableCell>
                      </TableRow>
                    ) : (
                      accounts.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell>
                            <p className='text-sm font-medium'>{account.label}</p>
                            <p className='text-muted-foreground font-mono text-xs'>
                              {account.username}
                            </p>
                          </TableCell>
                          <TableCell>
                            <p className='text-sm'>{account.ownerName}</p>
                            <p className='text-muted-foreground text-xs'>
                              {account.ownerEmail || '未设置邮箱'}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={account.status === 'connected' ? 'outline' : 'destructive'}
                            >
                              {account.statusLabel}
                            </Badge>
                            <p className='text-muted-foreground mt-1 text-xs'>
                              {account.tokenLabel}
                            </p>
                          </TableCell>
                          <TableCell className='text-sm'>{account.taskCount} 个任务</TableCell>
                          <TableCell className='text-muted-foreground text-xs'>
                            {account.lastVerifiedAt
                              ? formatDateTime(account.lastVerifiedAt)
                              : '尚未验证'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <div className='flex flex-col gap-2 lg:hidden'>
                  {accounts.length === 0 ? (
                    <p className='text-muted-foreground py-12 text-center text-sm'>暂无学校账号</p>
                  ) : (
                    accounts.map((account) => (
                      <div
                        key={account.id}
                        className='flex min-w-0 flex-col gap-3 rounded-lg border p-3'
                      >
                        <div className='flex min-w-0 items-start justify-between gap-3'>
                          <div className='min-w-0'>
                            <p className='truncate text-sm font-medium'>{account.label}</p>
                            <p className='text-muted-foreground mt-1 truncate font-mono text-xs'>
                              {account.username}
                            </p>
                          </div>
                          <Badge
                            className='shrink-0'
                            variant={account.status === 'connected' ? 'outline' : 'destructive'}
                          >
                            {account.statusLabel}
                          </Badge>
                        </div>
                        <div className='grid grid-cols-2 gap-3 text-xs'>
                          <div>
                            <p className='text-muted-foreground'>归属成员</p>
                            <p className='mt-1 truncate'>{account.ownerName}</p>
                          </div>
                          <div>
                            <p className='text-muted-foreground'>关联任务</p>
                            <p className='mt-1'>{account.taskCount} 个</p>
                          </div>
                          <div>
                            <p className='text-muted-foreground'>授权状态</p>
                            <p className='mt-1'>{account.tokenLabel}</p>
                          </div>
                          <div>
                            <p className='text-muted-foreground'>最近验证</p>
                            <p className='mt-1'>
                              {account.lastVerifiedAt
                                ? formatDateTime(account.lastVerifiedAt)
                                : '尚未验证'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className='flex h-[calc(100svh-1rem)] max-h-[calc(100svh-1rem)] w-[calc(100%-1rem)] flex-col overflow-hidden overscroll-contain sm:h-auto sm:max-h-[calc(100svh-2rem)] sm:max-w-[420px]'>
          <DialogHeader className='shrink-0 pr-8'>
            <DialogTitle>创建邀请码</DialogTitle>
            <DialogDescription>生成后只显示一次，建议立即复制并发给指定成员。</DialogDescription>
          </DialogHeader>
          <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-0.5'>
            <form
              id='create-platform-invitation'
              onSubmit={submitInvitation}
              className='flex flex-col gap-4 pb-1'
            >
              <div className='flex flex-col gap-2'>
                <Label htmlFor='invitation-max-uses'>可使用次数</Label>
                <Input
                  id='invitation-max-uses'
                  type='number'
                  inputMode='numeric'
                  min='1'
                  max='100'
                  value={maxUses}
                  onChange={(event) => setMaxUses(event.target.value)}
                  required
                />
              </div>
              <div className='flex flex-col gap-2'>
                <Label htmlFor='invitation-valid-days'>有效天数</Label>
                <Input
                  id='invitation-valid-days'
                  type='number'
                  inputMode='numeric'
                  min='1'
                  max='365'
                  value={validDays}
                  onChange={(event) => setValidDays(event.target.value)}
                  required
                />
              </div>
            </form>
          </div>
          <DialogFooter className='sticky bottom-0 z-10 shrink-0 sm:flex-row'>
            <Button
              className='w-full sm:w-auto'
              type='button'
              variant='outline'
              onClick={() => setCreateOpen(false)}
            >
              取消
            </Button>
            <Button
              className='w-full sm:w-auto'
              type='submit'
              form='create-platform-invitation'
              disabled={saving}
            >
              {saving ? '生成中' : '生成邀请码'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(proTarget)}
        onOpenChange={(open) => !open && setProTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>直接开通永久 Pro？</AlertDialogTitle>
            <AlertDialogDescription>
              将为「{proTarget?.displayName}」立即开通永久 Pro，校园账号额度会提升到 3 个。该操作会写入管理员授予记录。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!proTarget) return;
                const target = proTarget;
                setProTarget(null);
                void grantUserPro(target);
              }}
            >
              确认开通
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className='gap-3 py-4 shadow-none'>
      <CardHeader className='px-4'>
        <div className='flex items-start justify-between gap-3'>
          <CardDescription>{label}</CardDescription>
          <div className='bg-muted flex size-8 items-center justify-center rounded-lg'>
            <Icon className='size-4' />
          </div>
        </div>
      </CardHeader>
      <CardContent className='px-4'>
        <p className='text-2xl font-semibold tracking-tight tabular-nums'>{value}</p>
        <p className='text-muted-foreground mt-1 text-xs'>{detail}</p>
      </CardContent>
    </Card>
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'numeric',
    day: 'numeric'
  });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatLocation(
  building: string,
  venueType: AdminTask['venueType'],
  roomName: string
): string {
  const venue = { library: '图书馆', study_room: '自习室', other: '其他' }[venueType];
  return (
    [building, venue, roomName].filter((value) => value && value !== '未指定').join(' · ') ||
    '位置未设置'
  );
}
