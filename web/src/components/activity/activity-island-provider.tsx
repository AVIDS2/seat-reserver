'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

import { Icons } from '@/components/icons';
import { activityEventName, type ActivityEvent } from './activity-events';

type ActiveActivity = ActivityEvent & { visible: boolean };

export function ActivityIslandProvider({ children }: { children: React.ReactNode }) {
  const [activity, setActivity] = useState<ActiveActivity | null>(null);
  const [expanded, setExpanded] = useState(false);
  const hideTimer = useRef<number | null>(null);

  useEffect(() => {
    const onActivity = (event: Event) => {
      const detail = (event as CustomEvent<ActivityEvent>).detail;
      if (!detail) return;
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);

      if (detail.phase === 'start') {
        setExpanded(false);
        setActivity({ ...detail, visible: true });
        return;
      }

      setActivity({ ...detail, visible: true });
      hideTimer.current = window.setTimeout(
        () => {
          setActivity((current) =>
            current?.id === detail.id ? { ...current, visible: false } : current
          );
          hideTimer.current = window.setTimeout(() => {
            setActivity((current) => (current?.id === detail.id ? null : current));
          }, 420);
        },
        detail.phase === 'error' ? 3600 : 1800
      );
    };

    window.addEventListener(activityEventName(), onActivity);
    return () => {
      window.removeEventListener(activityEventName(), onActivity);
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    };
  }, []);

  return (
    <>
      {children}
      <AnimatePresence>
        {activity?.visible && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30, mass: 0.6 }}
            className='activity-island fixed top-[calc(var(--header-height)+0.75rem)] left-1/2 z-40 -translate-x-1/2'
            role='status'
            aria-live='polite'
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? (
              <LargeActivity activity={activity} />
            ) : (
              <SmallActivity activity={activity} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function SmallActivity({ activity }: { activity: ActiveActivity }) {
  return (
    <>
      <ActivityIcon activity={activity} />
      <span className='min-w-0 flex-1 truncate text-xs font-medium'>{activity.title}</span>
      {activity.phase === 'start' && <Icons.spinner className='size-3.5 animate-spin opacity-70' />}
    </>
  );
}

function LargeActivity({ activity }: { activity: ActiveActivity }) {
  const isWorking = activity.phase === 'start';
  return (
    <div className='flex h-full flex-col justify-between gap-3'>
      <div className='flex items-start gap-3'>
        <div className='activity-island-icon flex size-9 shrink-0 items-center justify-center rounded-xl'>
          <ActivityIcon activity={activity} />
        </div>
        <div className='min-w-0'>
          <p className='text-sm font-semibold'>{activity.title}</p>
          <p className='mt-1 line-clamp-2 text-xs text-white/65'>
            {activity.detail || (isWorking ? '请稍候，平台正在处理。' : '状态已更新。')}
          </p>
        </div>
      </div>
      <div className='space-y-2'>
        <div className='flex items-center justify-between text-[11px] text-white/55'>
          <span>{isWorking ? '处理中' : activity.phase === 'success' ? '已完成' : '需要处理'}</span>
          <span className='flex items-center gap-1.5'>
            <span className={`activity-island-dot ${isWorking ? 'is-working' : activity.phase}`} />
            {isWorking ? '自动继续' : '可以继续使用'}
          </span>
        </div>
        <div className='h-1 overflow-hidden rounded-full bg-white/10'>
          <div
            className={`activity-island-progress ${isWorking ? 'is-working' : activity.phase}`}
          />
        </div>
      </div>
    </div>
  );
}

function ActivityIcon({ activity }: { activity: ActiveActivity }) {
  if (activity.phase === 'success')
    return <Icons.circleCheck className='size-4 text-emerald-300' />;
  if (activity.phase === 'error') return <Icons.warning className='size-4 text-amber-300' />;
  return <Icons.refresh className='size-4 animate-spin text-cyan-300' />;
}
