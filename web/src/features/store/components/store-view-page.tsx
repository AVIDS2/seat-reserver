'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ShineBorder } from '@/components/ui/shine-border';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  createProCheckout,
  getRewardsSnapshot,
  redeemInviteCode,
  requestPro,
  type RewardsSnapshot
} from '@/features/booking/api/service';
import { cn } from '@/lib/utils';

type ShopCategory = '全部' | '权益' | '邀请' | '即将上架';
type ProductKind = 'pro' | 'invite' | 'coming';

type ShopProduct = {
  id: string;
  category: Exclude<ShopCategory, '全部'>;
  kind: ProductKind;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  icon: keyof typeof Icons;
  accent: string;
};

const products: ShopProduct[] = [
  {
    id: 'pro-permanent',
    category: '权益',
    kind: 'pro',
    title: 'Pro 永久通行证',
    subtitle: '给多账号用户的长期权益',
    description: '把 1 个校园账号扩展到 3 个，适合同时管理自习室、图书馆和家人的预约策略。',
    badge: '热销',
    icon: 'pro',
    accent: 'bg-primary'
  },
  {
    id: 'friend-invite',
    category: '邀请',
    kind: 'invite',
    title: '好友邀请码',
    subtitle: '一次性 · 可转赠 · 30 天有效',
    description: '给认识的同学一个席定入口。邀请码只展示一次，生成后可以复制并转交。',
    badge: '600 席定币',
    icon: 'gift',
    accent: 'bg-emerald-600'
  },
  {
    id: 'campus-expansion',
    category: '即将上架',
    kind: 'coming',
    title: '高校扩展位',
    subtitle: '更多学校、更多校区',
    description: '江苏海洋大学和更多高校空间正在接入，新的服务会先在这里出现。',
    badge: '筹备中',
    icon: 'building',
    accent: 'bg-sky-700'
  },
  {
    id: 'quiet-hours',
    category: '即将上架',
    kind: 'coming',
    title: '专注时段包',
    subtitle: '让学习计划更有秩序',
    description: '围绕固定时段、连续学习和个人偏好设计的后续权益，目前不开放兑换。',
    badge: '即将上架',
    icon: 'clock',
    accent: 'bg-slate-700'
  }
];

export default function StoreViewPage({
  initialData,
  checkoutResult
}: {
  initialData: RewardsSnapshot;
  checkoutResult: 'success' | 'cancelled' | null;
}) {
  const [data, setData] = useState(initialData);
  const [category, setCategory] = useState<ShopCategory>('全部');
  const [selectedProduct, setSelectedProduct] = useState<ShopProduct | null>(null);
  const [busy, setBusy] = useState<'pro' | 'invite' | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const membership = data.membership;
  const canRequest = !data.proRequest;
  const inviteCost = data.invitePointsCost;
  const progress = Math.min(100, Math.round((data.pointsBalance / inviteCost) * 100));
  const pointsMissing = Math.max(0, inviteCost - data.pointsBalance);
  const activeDaysNeeded = Math.ceil(pointsMissing / Math.max(1, data.dailyActivityPoints));

  const visibleProducts = useMemo(
    () => (category === '全部' ? products : products.filter((product) => product.category === category)),
    [category]
  );

  useEffect(() => {
    if (checkoutResult !== 'success') return;
    let active = true;
    const refresh = () => {
      void getRewardsSnapshot()
        .then((snapshot) => {
          if (active) setData(snapshot);
        })
        .catch(() => undefined);
    };
    refresh();
    const timer = window.setTimeout(refresh, 1800);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [checkoutResult]);

  const handleProductAction = async (product: ShopProduct) => {
    if (product.kind === 'coming') {
      setSelectedProduct(product);
      return;
    }
    if (product.kind === 'pro') {
      if (membership.isPro) return;
      setSelectedProduct(product);
      return;
    }
    if (data.pointsBalance < inviteCost) {
      setSelectedProduct(product);
      return;
    }
    setBusy('invite');
    try {
      const result = await redeemInviteCode();
      setData((current) => ({
        ...current,
        pointsBalance: result.pointsBalance,
        invitations: [result.invitation, ...current.invitations]
      }));
      setGeneratedCode(result.code);
      toast.success('好友邀请码已兑换');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '兑换失败');
    } finally {
      setBusy(null);
    }
  };

  const openProCheckout = async () => {
    setBusy('pro');
    try {
      if (membership.paymentAvailable) {
        const checkout = await createProCheckout();
        window.location.assign(checkout.url);
        return;
      }
      const result = await requestPro();
      setData((current) => ({
        ...current,
        membership: result.membership,
        proRequest: result.request
      }));
      setSelectedProduct(null);
      toast.success(result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '开通失败');
    } finally {
      setBusy(null);
    }
  };

  return (
    <PageContainer
      pageTitle='席定杂货铺'
      pageDescription='用活跃换权益，把校园预约能力一件件收入自己的货架。'
      pageHeaderAction={
        <Link href='/dashboard/store/recharge' className={buttonVariants({ variant: 'outline' })}>
          <Icons.creditCard data-icon='inline-start' />
          充值席定币
        </Link>
      }
    >
      <div className='mx-auto flex w-full max-w-[1180px] flex-col gap-5 pb-8 sm:gap-6'>
        {checkoutResult === 'success' && (
          <Alert>
            <Icons.clock />
            <AlertTitle>{membership.isPro ? 'Pro 已开通' : '支付已返回，正在确认'}</AlertTitle>
            <AlertDescription>
              {membership.isPro
                ? '支付已确认，永久 Pro 权益已经生效。'
                : '支付平台已返回成功页面，权益正在等待回调确认。页面会自动刷新。'}
            </AlertDescription>
          </Alert>
        )}
        {checkoutResult === 'cancelled' && (
          <Alert>
            <Icons.info />
            <AlertTitle>支付未完成</AlertTitle>
            <AlertDescription>没有产生扣款，当前方案没有变化。</AlertDescription>
          </Alert>
        )}

        <section className='overflow-hidden rounded-xl border bg-foreground text-background'>
          <div className='grid gap-6 px-5 py-6 sm:px-8 sm:py-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-end'>
            <div>
              <div className='flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-background/60'>
                <span className='bg-primary size-2 rounded-full' aria-hidden='true' />
                SEAT DEPOT
                <span className='text-background/30'>/</span>
                DAILY REWARDS
              </div>
              <h1 className='mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl'>
                席定杂货铺
              </h1>
              <p className='mt-3 max-w-xl text-sm leading-6 text-background/65 sm:text-base'>
                不卖噱头，只把真实可用的预约权益放到货架上。今天的活跃，换成之后的选择权。
              </p>
              <div className='mt-5 flex flex-wrap gap-2'>
                <Badge variant='secondary'>{membership.planLabel}</Badge>
                <Badge className='border-background/20 bg-background/10 text-background'>
                  {data.pointsBalance} 席定币
                </Badge>
                <Badge className='border-background/20 bg-background/10 text-background'>
                  {data.invitations.filter((item) => item.status === 'active').length} 件待赠出
                </Badge>
              </div>
            </div>
            <div className='store-balance-panel relative overflow-hidden rounded-lg border border-background/15 bg-background/10 p-4'>
              <ShineBorder
                duration={18}
                shineColor={['#4ade80', '#38bdf8', '#fbbf24']}
                className='opacity-60'
              />
              <div className='flex items-center justify-between gap-3'>
                <div>
                  <p className='text-xs text-background/55'>下一件可兑换商品</p>
                  <p className='mt-1 font-semibold'>好友邀请码</p>
                </div>
                <Icons.gift className='text-primary' />
              </div>
              <div className='mt-4 flex items-end justify-between gap-3'>
                <p className='font-mono text-3xl font-semibold tabular-nums'>{data.pointsBalance}<span className='text-base text-background/45'> / {inviteCost}</span></p>
                <p className='text-right text-xs text-background/55'>{pointsMissing ? `还差 ${pointsMissing} 席定币` : '现在可以兑换'}</p>
              </div>
              <Progress value={progress} aria-label='兑换进度' className='mt-3 [&_[data-slot=progress-track]]:bg-background/15 [&_[data-slot=progress-indicator]]:bg-primary' />
              <p className='mt-2 text-xs text-background/50'>按每日 +{data.dailyActivityPoints} 席定币计算，约需 {activeDaysNeeded} 天活跃</p>
            </div>
          </div>
        </section>

        <Tabs value={category} onValueChange={(value) => setCategory(value as ShopCategory)} className='flex flex-col gap-4'>
          <div className='flex flex-col justify-between gap-3 sm:flex-row sm:items-center'>
            <TabsList className='w-full overflow-x-auto sm:w-fit'>
              <TabsTrigger value='全部'>全部商品</TabsTrigger>
              <TabsTrigger value='权益'>平台权益</TabsTrigger>
              <TabsTrigger value='邀请'>邀请礼物</TabsTrigger>
              <TabsTrigger value='即将上架'>即将上架</TabsTrigger>
            </TabsList>
            <Link href='/dashboard/membership#invite' className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
              <Icons.history data-icon='inline-start' />
              兑换记录
            </Link>
          </div>

          <TabsContent value={category} className='mt-0'>
            <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
              {visibleProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  data={data}
                  busy={busy}
                  onAction={() => void handleProductAction(product)}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <section className='grid gap-4 lg:grid-cols-[1.15fr_0.85fr]'>
          <Card className='shadow-none'>
            <CardHeader>
              <div className='flex items-start justify-between gap-3'>
                <div>
                  <CardTitle className='flex items-center gap-2'><Icons.gift />我的货架</CardTitle>
                  <CardDescription className='mt-1'>已兑换的邀请商品和当前权益。</CardDescription>
                </div>
                <Badge variant='outline'>{data.invitations.length + (membership.isPro ? 1 : 0)} 件</Badge>
              </div>
            </CardHeader>
            <CardContent className='flex flex-col gap-2'>
              {membership.isPro && <ShelfRow icon={<Icons.pro />} title='Pro 永久通行证' meta='已激活 · 3 个校园账号额度' status='已拥有' />}
              {data.invitations.map((invitation) => (
                <ShelfRow
                  key={invitation.id}
                  icon={<Icons.gift />}
                  title='好友邀请码'
                  meta={invitation.expiresAt ? `有效至 ${formatDate(invitation.expiresAt)}` : '长期有效'}
                  status={invitation.status === 'active' ? '待赠出' : invitation.status === 'exhausted' ? '已使用' : '已失效'}
                />
              ))}
              {!membership.isPro && data.invitations.length === 0 && (
                <div className='rounded-lg border border-dashed p-5 text-center'>
                  <Icons.product className='text-muted-foreground mx-auto' />
                  <p className='mt-2 text-sm font-medium'>货架还是空的</p>
                  <p className='text-muted-foreground mt-1 text-xs'>从上面的精选商品开始积累。</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className='shadow-none'>
            <CardHeader>
              <CardTitle>杂货铺规则</CardTitle>
              <CardDescription>积分有门槛，权益有记录。</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion>
                <AccordionItem value='earn'>
                  <AccordionTrigger>席定币怎么获得？</AccordionTrigger>
                  <AccordionContent className='text-muted-foreground'>每日完成一次有效账号验证获得 {data.dailyActivityPoints} 席定币；好友完成首次验证后，邀请人获得 {data.referralRewardPoints} 席定币。</AccordionContent>
                </AccordionItem>
                <AccordionItem value='redeem'>
                  <AccordionTrigger>为什么邀请码要 {data.invitePointsCost} 席定币？</AccordionTrigger>
                  <AccordionContent className='text-muted-foreground'>兑换门槛按约 60 元价值锚定，避免批量滥发。按每日活跃计算，需要约 {Math.ceil(data.invitePointsCost / Math.max(1, data.dailyActivityPoints))} 天。</AccordionContent>
                </AccordionItem>
                <AccordionItem value='source'>
                  <AccordionTrigger>邀请码可以公开出售吗？</AccordionTrigger>
                  <AccordionContent className='text-muted-foreground'>平台不提供公开售卖入口。邀请码只建议转赠给真实认识的同学，生成记录和使用状态都由服务端保存。</AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </section>
      </div>

      <Dialog open={Boolean(selectedProduct)} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>{selectedProduct?.title}</DialogTitle>
            <DialogDescription>{selectedProduct?.description}</DialogDescription>
          </DialogHeader>
          {selectedProduct?.kind === 'invite' && (
            <div className='rounded-lg border bg-muted/30 p-4 text-sm'>
              <div className='flex items-center justify-between gap-4'><span>兑换门槛</span><strong>{inviteCost} 席定币</strong></div>
              <Separator className='my-3' />
              <div className='flex items-center justify-between gap-4'><span>当前余额</span><strong>{data.pointsBalance} 席定币</strong></div>
              <p className='text-muted-foreground mt-3 text-xs'>生成后只显示一次，请确认有明确的转赠对象。</p>
            </div>
          )}
          {selectedProduct?.kind === 'pro' && (
            <div className='rounded-lg border bg-muted/30 p-4 text-sm'>¥20，一次支付，永久有效。支付成功后由 webhook 自动授予 Pro。</div>
          )}
          {selectedProduct?.kind === 'coming' && <div className='rounded-lg border bg-muted/30 p-4 text-sm'>这个商品正在准备真实的后端能力，当前不会扣除积分，也不会伪造兑换结果。</div>}
          <DialogFooter>
            <Button variant='outline' onClick={() => setSelectedProduct(null)}>返回货架</Button>
            {selectedProduct?.kind === 'pro' && <Button onClick={() => void openProCheckout()} disabled={busy === 'pro' || !canRequest}>{busy === 'pro' ? '处理中' : membership.paymentAvailable ? '前往支付' : '申请开通'}</Button>}
            {selectedProduct?.kind === 'invite' && <Button onClick={() => void handleProductAction(selectedProduct)} disabled={busy === 'invite' || data.pointsBalance < inviteCost}>{busy === 'invite' ? '兑换中' : '确认兑换'}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(generatedCode)} onOpenChange={(open) => !open && setGeneratedCode(null)}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader><DialogTitle>邀请码已生成</DialogTitle><DialogDescription>只显示一次，请复制后转赠给认识的同学。</DialogDescription></DialogHeader>
          <div className='rounded-lg border bg-muted px-4 py-5 text-center font-mono text-lg tracking-[0.16em]'>{generatedCode}</div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setGeneratedCode(null)}>关闭</Button>
            <Button onClick={() => { if (generatedCode) void navigator.clipboard.writeText(generatedCode).then(() => toast.success('邀请码已复制')); }}><Icons.copy data-icon='inline-start' />复制邀请码</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

function ProductCard({ product, data, busy, onAction }: { product: ShopProduct; data: RewardsSnapshot; busy: 'pro' | 'invite' | null; onAction: () => void }) {
  const owned = product.kind === 'pro' && data.membership.isPro;
  const affordable = product.kind !== 'invite' || data.pointsBalance >= data.invitePointsCost;
  return (
    <Card className='group flex h-full flex-col overflow-hidden shadow-none transition-transform hover:-translate-y-0.5'>
      <ProductArt product={product} />
      <CardHeader className='gap-1'>
        <CardDescription>{product.subtitle}</CardDescription>
        <CardTitle className='text-lg'>{product.title}</CardTitle>
      </CardHeader>
      <CardContent className='flex flex-1 flex-col gap-3'>
        <p className='text-muted-foreground text-sm leading-6'>{product.description}</p>
        {product.kind === 'invite' && <p className='font-mono text-sm tabular-nums'>{data.invitePointsCost} 席定币</p>}
        {product.kind === 'pro' && <p className='text-lg font-semibold tabular-nums'>¥20 <span className='text-muted-foreground text-xs font-normal'>永久</span></p>}
      </CardContent>
      <CardFooter>
        <Button className='w-full' variant={product.kind === 'coming' ? 'outline' : 'default'} onClick={onAction} disabled={owned || busy !== null}>
          {owned ? '已拥有' : product.kind === 'coming' ? '查看详情' : product.kind === 'invite' ? affordable ? '兑换商品' : '查看门槛' : '查看商品'}
          {product.kind !== 'coming' && <Icons.arrowRight data-icon='inline-end' />}
        </Button>
      </CardFooter>
    </Card>
  );
}

function ProductArt({ product }: { product: ShopProduct }) {
  const Icon = Icons[product.icon];
  return (
    <div
      className={cn('store-product-art relative flex h-32 items-end justify-between overflow-hidden p-4 text-white', product.accent)}
      data-product-kind={product.kind}
      data-product-id={product.id}
    >
      <ShineBorder
        duration={16}
        shineColor={shineColors(product)}
        className='opacity-90'
      />
      <div className='store-art-visual' aria-hidden='true'>
        <span className='store-art-card store-art-card-back' />
        <span className='store-art-card store-art-card-front'>
          <span className='store-art-chip' />
          <span className='store-art-bar store-art-bar-wide' />
          <span className='store-art-bar store-art-bar-short' />
        </span>
      </div>
      <span className='store-art-icon relative z-10 flex size-11 items-center justify-center rounded-lg border border-white/20 bg-black/10 backdrop-blur-sm'>
        <Icon className='size-6 opacity-95' aria-hidden='true' />
      </span>
      <Badge className='relative z-10 border-white/20 bg-white/90 text-slate-900'>{product.badge}</Badge>
    </div>
  );
}

function shineColors(product: ShopProduct): string[] {
  if (product.kind === 'pro') return ['#fef3c7', '#fb923c', '#fda4af'];
  if (product.kind === 'invite') return ['#a7f3d0', '#67e8f9', '#fef08a'];
  if (product.id === 'campus-expansion') return ['#bae6fd', '#c4b5fd', '#f0abfc'];
  return ['#cbd5e1', '#e2e8f0', '#fef3c7'];
}

function ShelfRow({ icon, title, meta, status }: { icon: React.ReactNode; title: string; meta: string; status: string }) {
  return <div className='flex items-center gap-3 rounded-lg border p-3'><div className='text-primary'>{icon}</div><div className='min-w-0 flex-1'><p className='truncate text-sm font-medium'>{title}</p><p className='text-muted-foreground mt-1 truncate text-xs'>{meta}</p></div><Badge variant='outline'>{status}</Badge></div>;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric' });
}
