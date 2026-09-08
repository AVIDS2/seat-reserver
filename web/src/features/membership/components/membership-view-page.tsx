'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { buttonVariants } from '@/components/ui/button';
import { ShinyText } from '@/components/react-bits/shiny-text';
import CountUp from '@/components/react-bits/count-up';
import {
  claimRewardActivity,
  checkInForPoints,
  redeemInviteCode,
  requestPro as requestProActivation,
  type RewardActivity,
  type RewardsSnapshot
} from '@/features/booking/api/service';
import { cn } from '@/lib/utils';

export default function MembershipViewPage({ initialData }: { initialData: RewardsSnapshot }) {
  const [data, setData] = useState(initialData);
  const [busy, setBusy] = useState<'pro' | 'invite' | null>(null);
  const [activityBusy, setActivityBusy] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  const requestPro = async () => {
    setBusy('pro');
    try {
      const result = await requestProActivation();
      setData((current) => ({
        ...current,
        membership: result.membership,
        proRequest: result.request
      }));
      toast.success(result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '提交 Pro 申请失败');
    } finally {
      setBusy(null);
    }
  };

  const redeemInvite = async () => {
    if (data.pointsBalance < data.invitePointsCost) return;
    setBusy('invite');
    try {
      const result = await redeemInviteCode();
      setData((current) => ({
        ...current,
        pointsBalance: result.pointsBalance,
        invitations: [result.invitation, ...current.invitations]
      }));
      setGeneratedCode(result.code);
      toast.success('邀请码已生成');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '兑换邀请码失败');
    } finally {
      setBusy(null);
    }
  };

  const claimActivity = async (activity: RewardActivity) => {
    if (activity.status !== 'available' || activityBusy) return;
    setActivityBusy(activity.id);
    try {
      const result =
        activity.id === 'daily_check_in'
          ? await checkInForPoints()
          : await claimRewardActivity(activity.id);
      setData((current) => ({
        ...current,
        pointsBalance: result.pointsBalance,
        activities: current.activities.map((item) =>
          item.id === result.activity.id ? result.activity : item
        )
      }));
      toast.success(`${activity.title}完成，+${activity.points} 席定币`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '领取活动奖励失败');
    } finally {
      setActivityBusy(null);
    }
  };

  const copyCode = async () => {
    if (!generatedCode) return;
    await navigator.clipboard.writeText(generatedCode);
    toast.success('邀请码已复制');
  };

  const pointsProgress = Math.min(
    100,
    Math.round((data.pointsBalance / data.invitePointsCost) * 100)
  );
  const membership = data.membership;
  const isAdmin = membership.plan === 'admin';

  return (
    <PageContainer
      pageTitle='会员与邀请'
      pageDescription='管理你的 Pro 权益、活跃积分和好友邀请。'
      pageHeaderAction={
        <Link href='/dashboard/store' className={buttonVariants()}>
          <Icons.product data-icon='inline-start' />
          打开席定商店
        </Link>
      }
    >
      <div className='mx-auto flex w-full max-w-[1120px] flex-col gap-4 sm:gap-5'>
        <Alert>
          <Icons.shield />
          <AlertTitle>权益由平台统一维护</AlertTitle>
          <AlertDescription>
            Pro 为一次开通、永久有效；账号额度在服务端校验，邀请和积分变更都会留下记录。
          </AlertDescription>
        </Alert>

        <div className='grid gap-4 lg:grid-cols-[1.15fr_0.85fr]'>
          <Card id='invite' className='scroll-mt-24 shadow-none'>
            <CardHeader className='border-b'>
              <div className='flex items-start justify-between gap-3'>
                <div>
                  <CardDescription>当前方案</CardDescription>
                  <CardTitle className='mt-1 flex items-center gap-2 text-2xl'>
                    {isAdmin ? <Icons.shield /> : <Icons.pro />}
                    {membership.planLabel}
                  </CardTitle>
                </div>
                <Badge variant={membership.isPro ? 'default' : 'outline'}>
                  {membership.isPermanent ? '永久有效' : '基础权益'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className='flex flex-col gap-5 pt-5'>
              <div className='grid gap-4 sm:grid-cols-2'>
                <Metric
                  label='校园账号额度'
                  value={
                    isAdmin ? '不限' : `${membership.accountCount} / ${membership.accountLimit}`
                  }
                />
                <Metric label='邀请好友' value={`${data.referrals.qualified} 人已完成`} />
              </div>
              {!membership.isPro && (
                <div className='flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between'>
                  <div className='min-w-0'>
                    <p className='font-medium'>Pro 会员</p>
                    <p className='text-muted-foreground mt-1 text-sm'>
                      ¥20，一次开通，永久可绑定 3 个校园账号。
                    </p>
                  </div>
                  <Button
                    className='w-full sm:w-auto'
                    onClick={() => void requestPro()}
                    disabled={busy === 'pro' || Boolean(data.proRequest)}
                  >
                    <Icons.pro data-icon='inline-start' />
                    {data.proRequest ? '申请审核中' : busy === 'pro' ? '提交中' : '申请开通'}
                  </Button>
                </div>
              )}
              {membership.isPro && !isAdmin && (
                <div className='text-muted-foreground flex items-center gap-2 text-sm'>
                  <Icons.badgeCheck className='text-primary' />
                  已解锁 3 个校园账号额度，后续新增账号会立即按 Pro 权益校验。
                </div>
              )}
            </CardContent>
          </Card>

          <Card className='shadow-none'>
            <CardHeader className='border-b'>
              <div className='flex items-start justify-between gap-3'>
                <div>
                  <CardDescription>活跃积分</CardDescription>
                  <CardTitle className='mt-1 text-2xl tabular-nums'>
                    <CountUp to={data.pointsBalance} duration={0.8} /> 席定币
                  </CardTitle>
                </div>
                <div className='bg-muted flex size-9 items-center justify-center rounded-lg'>
                  <Icons.sparkles className='size-5' />
                </div>
              </div>
            </CardHeader>
            <CardContent className='flex flex-col gap-4 pt-5'>
              <Progress value={pointsProgress} aria-label='邀请码积分进度'>
                <div className='flex w-full items-center justify-between gap-2'>
                  <span className='text-sm font-medium'>兑换好友邀请码</span>
                  <span className='text-muted-foreground text-sm tabular-nums'>
                    {data.pointsBalance} / {data.invitePointsCost}
                  </span>
                </div>
              </Progress>
              <p className='text-muted-foreground text-sm leading-6'>
                每日签到获得 {data.dailyActivityPoints} 席定币；支线活动和好友邀请也会留下可追溯流水。
              </p>
              <Button
                variant='outline'
                onClick={() => void redeemInvite()}
                disabled={busy === 'invite' || data.pointsBalance < data.invitePointsCost}
              >
                <Icons.gift data-icon='inline-start' />
                {busy === 'invite' ? '兑换中' : '兑换邀请码'}
              </Button>
              <p className='text-muted-foreground text-xs'>
                生成的邀请码有效 {data.inviteValidDays} 天，只显示一次，请及时转给好友。
              </p>
            </CardContent>
          </Card>
        </div>

        <Card
          id='nextstep-rewards'
          className='overflow-hidden border-primary/20 shadow-none scroll-mt-24'
        >
          <CardHeader className='border-b'>
            <div className='flex items-start justify-between gap-3'>
              <div>
                <CardDescription>每日来看看</CardDescription>
                <CardTitle className='mt-1 flex items-center gap-2 text-xl'>
                  <Icons.sparkles className='text-primary' />
                  活动中心
                </CardTitle>
              </div>
              <ShinyText text='BONUS TRACKS' className='text-xs font-semibold tracking-[0.16em]' />
            </div>
          </CardHeader>
          <CardContent className='grid gap-3 pt-5 sm:grid-cols-2'>
            {data.activities.map((activity) => (
              <ActivityRow
                key={activity.id}
                activity={activity}
                busy={activityBusy === activity.id}
                onClaim={() => void claimActivity(activity)}
              />
            ))}
          </CardContent>
        </Card>

        {data.proRequest && (
          <Alert>
            <Icons.clock />
            <AlertTitle>Pro 开通申请已提交</AlertTitle>
            <AlertDescription>
              申请单 #{data.proRequest.id} 正在等待管理员确认。确认后会自动变为永久
              Pro，不需要重复提交。
            </AlertDescription>
          </Alert>
        )}

        <div className='grid gap-4 lg:grid-cols-2'>
          <Card className='shadow-none'>
            <CardHeader className='border-b'>
              <CardTitle className='text-lg'>我的邀请码</CardTitle>
              <CardDescription>
                把邀请码赠给真实认识的同学，兑换记录不会展示邀请码明文。
              </CardDescription>
            </CardHeader>
            <CardContent className='pt-4'>
              {data.invitations.length === 0 ? (
                <EmptyState text='还没有兑换过邀请码' />
              ) : (
                <div className='flex flex-col gap-3'>
                  {data.invitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className='flex items-center justify-between gap-3 rounded-lg border p-3'
                    >
                      <div className='min-w-0'>
                        <p className='text-sm font-medium'>一次性好友邀请码</p>
                        <p className='text-muted-foreground mt-1 text-xs'>
                          {invitation.expiresAt
                            ? `有效至 ${formatDate(invitation.expiresAt)}`
                            : '长期有效'}
                        </p>
                      </div>
                      <Badge variant={invitation.status === 'active' ? 'outline' : 'secondary'}>
                        {invitation.status === 'active'
                          ? '待赠送'
                          : invitation.status === 'exhausted'
                            ? '已使用'
                            : invitation.status === 'expired'
                              ? '已过期'
                              : '已停用'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className='shadow-none'>
            <CardHeader className='border-b'>
              <CardTitle className='text-lg'>积分流水</CardTitle>
              <CardDescription>每笔积分变化都可追溯，避免重复奖励或重复扣分。</CardDescription>
            </CardHeader>
            <CardContent className='pt-4'>
              {data.ledger.length === 0 ? (
                <EmptyState text='完成签到或支线活动后会显示积分记录' />
              ) : (
                <div className='flex flex-col gap-3'>
                  {data.ledger.map((entry, index) => (
                    <div key={entry.id}>
                      <div className='flex items-center justify-between gap-3'>
                        <div className='min-w-0'>
                          <p className='truncate text-sm font-medium'>{entry.description}</p>
                          <p className='text-muted-foreground mt-1 text-xs'>
                            {formatDate(entry.createdAt)}
                          </p>
                        </div>
                        <p
                          className={cn(
                            'shrink-0 text-sm font-semibold tabular-nums',
                            entry.amount > 0 ? 'text-emerald-600' : 'text-muted-foreground'
                          )}
                        >
                          {entry.amount > 0 ? '+' : ''}
                          {entry.amount} 分
                        </p>
                      </div>
                      {index < data.ledger.length - 1 && <Separator className='mt-3' />}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={Boolean(generatedCode)}
        onOpenChange={(open) => !open && setGeneratedCode(null)}
      >
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>邀请码已生成</DialogTitle>
            <DialogDescription>
              邀请码只在这里显示一次。复制后发给你认识的同学，不要公开发布。
            </DialogDescription>
          </DialogHeader>
          <div className='bg-muted rounded-lg px-4 py-5 text-center font-mono text-lg tracking-[0.16em]'>
            {generatedCode}
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setGeneratedCode(null)}>
              关闭
            </Button>
            <Button onClick={() => void copyCode()}>
              <Icons.copy data-icon='inline-start' />
              复制邀请码
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-lg border bg-muted/20 p-3'>
      <p className='text-muted-foreground text-xs'>{label}</p>
      <p className='mt-1 text-lg font-semibold tabular-nums'>{value}</p>
    </div>
  );
}

function ActivityRow({
  activity,
  busy,
  onClaim
}: {
  activity: RewardActivity;
  busy: boolean;
  onClaim: () => void;
}) {
  const claimed = activity.status === 'claimed';
  const locked = activity.status === 'locked';
  return (
    <div className='flex min-w-0 items-center gap-3 rounded-lg border bg-muted/20 p-3'>
      <div className='bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg'>
        <Icons.sparkles className='size-4' aria-hidden='true' />
      </div>
      <div className='min-w-0 flex-1'>
        <div className='flex items-center gap-2'>
          <p className='truncate text-sm font-medium'>{activity.title}</p>
          <span className='shrink-0 text-xs font-semibold tabular-nums text-emerald-600'>
            +{activity.points}
          </span>
        </div>
        <p className='text-muted-foreground mt-1 line-clamp-2 text-xs leading-5'>
          {locked ? activity.lockedReason : activity.description}
        </p>
      </div>
      <Button
        variant={claimed ? 'secondary' : 'outline'}
        size='sm'
        className='shrink-0'
        disabled={claimed || locked || busy}
        onClick={onClaim}
      >
        {busy ? '领取中…' : claimed ? '已领取' : locked ? '未完成' : '领取'}
      </Button>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className='text-muted-foreground py-8 text-center text-sm'>{text}</p>;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
