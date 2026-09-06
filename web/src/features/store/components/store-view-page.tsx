'use client';

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { requestPro, type RewardsSnapshot } from '@/features/booking/api/service';
import { cn } from '@/lib/utils';

export default function StoreViewPage({ initialData }: { initialData: RewardsSnapshot }) {
  const [data, setData] = useState(initialData);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const membership = data.membership;
  const isAdmin = membership.plan === 'admin';
  const canRequest = !membership.isPro && !data.proRequest;

  const submitProRequest = async () => {
    setBusy(true);
    try {
      const result = await requestPro();
      setData((current) => ({
        ...current,
        membership: result.membership,
        proRequest: result.request
      }));
      setCheckoutOpen(false);
      toast.success(result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '提交开通申请失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer
      pageTitle='席定商店'
      pageDescription='把校园座位预约能力，变成一套长期可用的个人工具。'
    >
      <div className='mx-auto flex w-full max-w-[1180px] flex-col gap-6 pb-8'>
        <section className='overflow-hidden rounded-xl border bg-primary text-primary-foreground'>
          <div className='grid gap-8 px-6 py-8 sm:px-8 sm:py-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end'>
            <div className='max-w-2xl'>
              <Badge variant='secondary' className='mb-4'>
                席定权益中心
              </Badge>
              <h1 className='max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl'>
                让每一次预约，都有一套稳定的执行策略。
              </h1>
              <p className='mt-4 max-w-xl text-sm leading-6 text-primary-foreground/75 sm:text-base'>
                从校园账号、实时座位图到每日自动执行，席定把重复操作交给系统，把选择权留给你。
              </p>
              <div className='mt-6 flex flex-wrap gap-3'>
                <Button
                  variant='secondary'
                  onClick={() => setCheckoutOpen(true)}
                  disabled={!canRequest}
                >
                  <Icons.pro data-icon='inline-start' />
                  {isAdmin
                    ? '管理员方案'
                    : membership.isPro
                      ? 'Pro 已生效'
                      : data.proRequest
                        ? '申请审核中'
                        : '开通 Pro'}
                </Button>
                <Link
                  href='/dashboard/membership#invite'
                  className={cn(
                    buttonVariants({ variant: 'ghost' }),
                    'text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground'
                  )}
                >
                  <Icons.gift data-icon='inline-start' />
                  查看邀请奖励
                </Link>
              </div>
            </div>
            <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2'>
              <StoreMetric label='当前方案' value={membership.planLabel} />
              <StoreMetric
                label='校园账号'
                value={isAdmin ? '不限' : `${membership.accountCount}/${membership.accountLimit}`}
              />
              <StoreMetric
                label='邀请积分'
                value={`${data.pointsBalance} 分`}
                className='col-span-2 sm:col-span-1 lg:col-span-2'
              />
            </div>
          </div>
        </section>

        <Tabs defaultValue='plans' className='flex flex-col gap-5'>
          <TabsList className='w-full sm:w-fit'>
            <TabsTrigger value='plans'>权益方案</TabsTrigger>
            <TabsTrigger value='community'>邀请奖励</TabsTrigger>
          </TabsList>

          <TabsContent value='plans' className='flex flex-col gap-6'>
            <div className='grid gap-4 lg:grid-cols-2'>
              <PlanCard
                title='基础版'
                description='先用起来，再按你的预约规模升级。'
                price='¥0'
                priceNote='永久免费'
                features={['绑定 1 个校园账号', '创建自动预约任务', '实时座位图与预约记录']}
                action={
                  <Button variant='outline' className='w-full' disabled>
                    当前方案
                  </Button>
                }
              />
              <PlanCard
                featured
                title='Pro 会员'
                description='给需要多账号、多场景管理的用户。'
                price='¥20'
                priceNote='一次开通，永久有效'
                features={[
                  '绑定最多 3 个校园账号',
                  '自习室与图书馆服务独立管理',
                  '优先使用后续平台能力',
                  '永久权益，不按月续费'
                ]}
                action={
                  <Button
                    className='w-full'
                    onClick={() => setCheckoutOpen(true)}
                    disabled={!canRequest}
                  >
                    <Icons.pro data-icon='inline-start' />
                    {isAdmin
                      ? '管理员方案'
                      : membership.isPro
                        ? '已拥有 Pro'
                        : data.proRequest
                          ? '申请审核中'
                          : '开通 Pro'}
                  </Button>
                }
              />
            </div>

            <Card className='shadow-none'>
              <CardHeader>
                <CardTitle>权益对比</CardTitle>
                <CardDescription>先看清楚，再决定是否升级，不隐藏关键限制。</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>能力</TableHead>
                      <TableHead>基础版</TableHead>
                      <TableHead>Pro 会员</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <CompareRow label='校园账号数量' free='1 个' pro='3 个' />
                    <CompareRow label='自动预约任务' free='支持' pro='支持' />
                    <CompareRow label='实时座位图' free='支持' pro='支持' />
                    <CompareRow label='有效期' free='永久' pro='永久' />
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className='grid gap-4 md:grid-cols-3'>
              <ValueBlock
                icon={<Icons.target />}
                title='先选座，再定策略'
                text='从真实座位图开始，把主座位、备选座位和时间段组合起来。'
              />
              <ValueBlock
                icon={<Icons.refresh />}
                title='连接状态可追踪'
                text='账号、服务连接和执行记录分开显示，异常不会藏在一个绿色状态里。'
              />
              <ValueBlock
                icon={<Icons.sparkles />}
                title='权益持续生长'
                text='Pro 是一次开通，后续新增高校和服务能力会继续纳入平台。'
              />
            </div>
          </TabsContent>

          <TabsContent value='community' className='flex flex-col gap-6'>
            <Card id='invite' className='scroll-mt-24 shadow-none'>
              <CardHeader>
                <div className='flex flex-wrap items-start justify-between gap-4'>
                  <div>
                    <CardTitle className='flex items-center gap-2'>
                      <Icons.gift />
                      邀请奖励计划
                    </CardTitle>
                    <CardDescription className='mt-2 max-w-2xl'>
                      邀请码不在商店直接售卖。通过真实使用、账号验证和好友完成首次验证获得积分，再兑换一次性邀请码。
                    </CardDescription>
                  </div>
                  <Badge variant='outline'>社区成长</Badge>
                </div>
              </CardHeader>
              <CardContent className='grid gap-4 sm:grid-cols-3'>
                <ValueBlock
                  icon={<Icons.bolt />}
                  title={`每日 +${data.dailyActivityPoints} 分`}
                  text='完成一次有效账号验证即可记录当天活跃。'
                />
                <ValueBlock
                  icon={<Icons.teams />}
                  title={`好友 +${data.referralRewardPoints} 分`}
                  text='好友完成首次验证后，邀请关系才会生效。'
                />
                <ValueBlock
                  icon={<Icons.share />}
                  title={`${data.invitePointsCost} 分兑换`}
                  text={`生成后有效 ${data.inviteValidDays} 天，只显示一次。`}
                />
              </CardContent>
              <CardFooter>
                <Link
                  href='/dashboard/membership#invite'
                  className={cn(buttonVariants(), 'w-full sm:w-auto')}
                >
                  <Icons.gift data-icon='inline-start' />
                  进入邀请中心
                </Link>
              </CardFooter>
            </Card>

            <Card className='shadow-none'>
              <CardHeader>
                <CardTitle>接下来会有什么</CardTitle>
                <CardDescription>
                  平台会优先把真实可用的高校服务接进来，再开放对应权益。
                </CardDescription>
              </CardHeader>
              <CardContent className='grid gap-3 sm:grid-cols-3'>
                <ComingSoon
                  icon={<Icons.building />}
                  title='更多高校空间'
                  text='按高校和校区扩展座位目录。'
                />
                <ComingSoon
                  icon={<Icons.mapPin />}
                  title='更多预约服务'
                  text='自习室、图书馆和学习空间统一管理。'
                />
                <ComingSoon
                  icon={<Icons.teams />}
                  title='团队协作能力'
                  text='为学习小组提供更清晰的共享策略。'
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <section className='grid gap-4 lg:grid-cols-[1fr_0.75fr]'>
          <Card className='shadow-none'>
            <CardHeader>
              <CardTitle>常见问题</CardTitle>
              <CardDescription>关于权益、申请和邀请码的几个关键说明。</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion>
                <AccordionItem value='payment'>
                  <AccordionTrigger>现在是在线支付还是申请开通？</AccordionTrigger>
                  <AccordionContent className='text-muted-foreground'>
                    当前页面走真实的 Pro
                    开通申请接口，由管理员确认后授予永久权益，不会伪造支付成功。接入在线支付前，需要配置支付商户、回调签名和退款状态同步。
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value='invite'>
                  <AccordionTrigger>邀请码可以在商店直接买吗？</AccordionTrigger>
                  <AccordionContent className='text-muted-foreground'>
                    不直接售卖。邀请码由管理员发放或由用户用活跃积分兑换，生成后只显示一次，适合转赠给认识的同学。
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value='pro'>
                  <AccordionTrigger>Pro 为什么是永久权益？</AccordionTrigger>
                  <AccordionContent className='text-muted-foreground'>
                    当前定价是一次开通
                    ¥20，服务端不设置到期时间。后续如果增加新的付费能力，会单独设计产品和规则。
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
          <Card className='bg-muted/30 shadow-none'>
            <CardHeader>
              <CardDescription>你的当前状态</CardDescription>
              <CardTitle>{membership.planLabel}</CardTitle>
            </CardHeader>
            <CardContent className='flex flex-col gap-4 text-sm'>
              <StatusLine
                label='账号额度'
                value={
                  isAdmin
                    ? '管理员不限额'
                    : `${membership.accountCount} / ${membership.accountLimit}`
                }
              />
              <Separator />
              <StatusLine label='有效期' value={membership.isPermanent ? '永久有效' : '基础方案'} />
              <Separator />
              <StatusLine label='活跃积分' value={`${data.pointsBalance} 分`} />
              <Link
                href='/dashboard/membership'
                className={cn(buttonVariants({ variant: 'outline' }), 'mt-2 w-full')}
              >
                管理会员与邀请
                <Icons.arrowRight data-icon='inline-end' />
              </Link>
            </CardContent>
          </Card>
        </section>
      </div>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>开通席定 Pro</DialogTitle>
            <DialogDescription>
              ¥20，一次开通，永久有效。提交后由管理员确认，确认完成后权益立即生效。
            </DialogDescription>
          </DialogHeader>
          <div className='rounded-lg border bg-muted/30 p-4'>
            <div className='flex items-start justify-between gap-4'>
              <div>
                <p className='font-medium'>Pro 会员</p>
                <p className='text-muted-foreground mt-1 text-sm'>
                  最多绑定 3 个校园账号，适合多账号和多预约场景。
                </p>
              </div>
              <p className='text-xl font-semibold tabular-nums'>¥20</p>
            </div>
          </div>
          <p className='text-muted-foreground text-sm leading-6'>
            提交申请不会扣款，也不会立即伪造开通结果。管理员完成确认后，系统会把申请单变为永久 Pro。
          </p>
          <DialogFooter>
            <Button variant='outline' onClick={() => setCheckoutOpen(false)}>
              稍后再说
            </Button>
            <Button onClick={() => void submitProRequest()} disabled={busy || !canRequest}>
              {busy ? '提交中' : '提交开通申请'}
              <Icons.arrowRight data-icon='inline-end' />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

function PlanCard({
  title,
  description,
  price,
  priceNote,
  features,
  action,
  featured = false
}: {
  title: string;
  description: string;
  price: string;
  priceNote: string;
  features: string[];
  action: React.ReactNode;
  featured?: boolean;
}) {
  return (
    <Card
      className={cn(
        'relative flex h-full flex-col shadow-none',
        featured && 'border-primary ring-1 ring-primary/20'
      )}
    >
      {featured && <Badge className='absolute top-4 right-4'>推荐</Badge>}
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className='mt-1 text-3xl tabular-nums'>{price}</CardTitle>
        <p className='text-muted-foreground text-sm'>{priceNote}</p>
        <p className='text-muted-foreground pt-2 text-sm leading-6'>{description}</p>
      </CardHeader>
      <CardContent className='flex flex-1 flex-col gap-3'>
        {features.map((feature) => (
          <div key={feature} className='flex items-start gap-2 text-sm'>
            <Icons.check className='text-primary mt-0.5 shrink-0' />
            <span>{feature}</span>
          </div>
        ))}
      </CardContent>
      <CardFooter>{action}</CardFooter>
    </Card>
  );
}

function CompareRow({ label, free, pro }: { label: string; free: string; pro: string }) {
  return (
    <TableRow>
      <TableCell className='font-medium'>{label}</TableCell>
      <TableCell className='text-muted-foreground'>{free}</TableCell>
      <TableCell>{pro}</TableCell>
    </TableRow>
  );
}

function StoreMetric({
  label,
  value,
  className
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-primary-foreground/15 bg-primary-foreground/10 p-3',
        className
      )}
    >
      <p className='text-xs text-primary-foreground/60'>{label}</p>
      <p className='mt-1 truncate text-base font-semibold'>{value}</p>
    </div>
  );
}

function ValueBlock({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className='flex flex-col gap-2 rounded-lg border bg-muted/20 p-4'>
      <div className='text-primary'>{icon}</div>
      <p className='font-medium'>{title}</p>
      <p className='text-muted-foreground text-sm leading-6'>{text}</p>
    </div>
  );
}

function ComingSoon({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className='flex items-start gap-3 rounded-lg border p-4'>
      <div className='text-muted-foreground mt-0.5'>{icon}</div>
      <div>
        <p className='font-medium'>{title}</p>
        <p className='text-muted-foreground mt-1 text-sm leading-6'>{text}</p>
      </div>
    </div>
  );
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex items-center justify-between gap-4 text-sm'>
      <span className='text-muted-foreground'>{label}</span>
      <span className='font-medium'>{value}</span>
    </div>
  );
}
