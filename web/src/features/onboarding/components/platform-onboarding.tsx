'use client';

import { useEffect } from 'react';
import {
  NextStep,
  NextStepProvider,
  useNextStep,
  type CardComponentProps,
  type Tour
} from 'nextstepjs';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { usePlatformSession } from '@/features/auth/platform-session';

export const PLATFORM_TOUR_NAME = 'platform-onboarding';

const ONBOARDING_STORAGE_PREFIX = 'seat-platform:onboarding:v2:';

const onboardingSteps: Tour[] = [
  {
    tour: PLATFORM_TOUR_NAME,
    steps: [
      {
        icon: '01',
        title: '欢迎使用席定',
        content: '接下来用几步带你走完账号授权、选座、自动预约、签到保护和席定币活动。可以取消，也可以随时从右上角重新查看。',
        nextRoute: '/dashboard/accounts'
      },
      {
        icon: '02',
        title: '连接你的校园账号',
        content: '先完成一次正常验证。自习室和图书馆是独立服务，连接状态会分别维护。',
        selector: '#nextstep-account-connect',
        side: 'bottom',
        nextRoute: '/dashboard/seats',
        prevRoute: '/dashboard/overview',
        pointerPadding: 10,
        pointerRadius: 10,
        selectorRetryAttempts: 24,
        selectorRetryDelay: 150,
        cardOffset: 18,
        scrollOffset: 80
      },
      {
        icon: '03',
        title: '在座位图里找位置',
        content: '按场馆、楼栋、空间和日期找座位。选中后可以直接预约，也可以加入抢座任务。',
        selector: '#nextstep-seat-map-title',
        side: 'top',
        nextRoute: '/dashboard/tasks',
        prevRoute: '/dashboard/accounts',
        pointerPadding: 8,
        pointerRadius: 12,
        selectorRetryAttempts: 24,
        selectorRetryDelay: 150,
        cardOffset: 18,
        scrollOffset: 80
      },
      {
        icon: '04',
        title: '把偏好保存成任务',
        content: '设置主座位、备选座位、预约时间和执行日期。开放后按顺序尝试。',
        selector: '#nextstep-task-create',
        side: 'bottom',
        nextRoute: '/dashboard/attendance',
        prevRoute: '/dashboard/seats',
        pointerPadding: 10,
        pointerRadius: 10,
        selectorRetryAttempts: 24,
        selectorRetryDelay: 150,
        cardOffset: 18,
        scrollOffset: 80
      },
      {
        icon: '05',
        title: '打开签到保护',
        content: '自习室预约可以在允许迟到窗口结束前自动处理未签到记录，减少不必要的违约风险。',
        selector: '#nextstep-attendance-protection',
        side: 'top',
        nextRoute: '/dashboard/membership',
        prevRoute: '/dashboard/tasks',
        pointerPadding: 8,
        pointerRadius: 12,
        selectorRetryAttempts: 24,
        selectorRetryDelay: 150,
        cardOffset: 18,
        scrollOffset: 80
      },
      {
        icon: '06',
        title: '每日签到，积累席定币',
        content: '每天在活动中心签到领取 30 席定币，完成支线活动还能解锁更多奖励。',
        selector: '#nextstep-rewards',
        side: 'top',
        prevRoute: '/dashboard/attendance',
        pointerPadding: 8,
        pointerRadius: 12,
        selectorRetryAttempts: 24,
        selectorRetryDelay: 150,
        cardOffset: 18,
        scrollOffset: 80
      }
    ]
  }
];

function onboardingStorageKey(userId: string) {
  return `${ONBOARDING_STORAGE_PREFIX}${userId}`;
}

function CustomTourCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  skipTour,
  arrow
}: CardComponentProps) {
  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;

  return (
    <div
      role='dialog'
      aria-label='席定使用引导'
      className='border-primary/20 bg-background text-foreground w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl border shadow-xl'
    >
      <div className='flex items-center justify-between gap-3 border-b px-4 py-3'>
        <div className='flex min-w-0 items-center gap-2'>
          <span className='bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums'>
            {step.icon || String(currentStep + 1).padStart(2, '0')}
          </span>
          <Badge variant='secondary' className='shrink-0'>
            {currentStep + 1} / {totalSteps}
          </Badge>
        </div>
        <Button variant='ghost' size='sm' className='h-7 shrink-0 px-2 text-xs' onClick={skipTour}>
          <Icons.close data-icon='inline-start' />
          取消引导
        </Button>
      </div>

      <div className='space-y-3 p-4'>
        <div>
          <h2 className='text-base font-semibold'>{step.title}</h2>
          <p className='text-muted-foreground mt-1 text-sm leading-6'>{step.content}</p>
        </div>
        <Progress value={((currentStep + 1) / totalSteps) * 100} aria-label='引导进度' />
      </div>

      <div className='flex items-center justify-between gap-2 border-t bg-muted/20 px-4 py-3'>
        <Button variant='ghost' size='sm' onClick={prevStep} disabled={isFirst}>
          <Icons.chevronLeft data-icon='inline-start' />
          上一步
        </Button>
        <Button size='sm' onClick={nextStep}>
          {isLast ? '完成' : '下一步'}
          {!isLast && <Icons.arrowRight data-icon='inline-end' />}
        </Button>
      </div>
      {arrow}
    </div>
  );
}

function PlatformOnboardingRuntime({ children }: { children: React.ReactNode }) {
  const user = usePlatformSession();
  const { startNextStep } = useNextStep();

  useEffect(() => {
    if (!user || typeof window === 'undefined') return;
    const key = onboardingStorageKey(user.id);
    if (window.localStorage.getItem(key)) return;

    const timer = window.setTimeout(() => startNextStep(PLATFORM_TOUR_NAME), 500);
    return () => window.clearTimeout(timer);
  }, [startNextStep, user]);

  const markOnboardingDone = () => {
    if (!user || typeof window === 'undefined') return;
    window.localStorage.setItem(onboardingStorageKey(user.id), 'done');
  };

  return (
    <NextStep
      steps={onboardingSteps}
      cardComponent={CustomTourCard}
      onComplete={markOnboardingDone}
      onSkip={markOnboardingDone}
      shadowRgb='15, 23, 42'
      shadowOpacity='0.42'
      cardTransition={{ type: 'spring', stiffness: 260, damping: 24 }}
      displayArrow
      disableConsoleLogs
      overlayZIndex={60}
      scrollToTop={false}
    >
      {children}
    </NextStep>
  );
}

export function PlatformOnboarding({ children }: { children: React.ReactNode }) {
  return (
    <NextStepProvider>
      <PlatformOnboardingRuntime>{children}</PlatformOnboardingRuntime>
    </NextStepProvider>
  );
}
