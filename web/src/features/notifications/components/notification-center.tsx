'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { NotificationCard, type NotificationAction } from '@/components/ui/notification-card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { getClientNotifications, markAllNotificationsRead, markNotificationRead } from '@/features/booking/api/service';
import type { PlatformNotification } from '@/features/booking/types';

const MAX_VISIBLE = 5;

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<PlatformNotification[]>([]);
  const router = useRouter();

  useEffect(() => {
    void getClientNotifications().then(setNotifications).catch(() => undefined);
  }, []);

  const unreadCount = notifications.filter((notification) => notification.status === 'unread').length;
  const markRead = async (id: string) => {
    setNotifications((current) => current.map((notification) => notification.id === id ? { ...notification, status: 'read' } : notification));
    try {
      await markNotificationRead(id);
    } catch {
      toast.error('通知状态更新失败');
    }
  };
  const markAllRead = async () => {
    setNotifications((current) => current.map((notification) => ({ ...notification, status: 'read' })));
    try {
      await markAllNotificationsRead();
    } catch {
      toast.error('通知状态更新失败');
    }
  };

  return (
    <Popover>
      <PopoverTrigger render={<Button variant='ghost' size='icon' className='relative h-8 w-8' />} aria-label='打开通知中心'>
        <Icons.notification className='h-4 w-4' />
        {unreadCount > 0 && <span className='bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium'>{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </PopoverTrigger>
      <PopoverContent align='end' className='w-[calc(100vw-2rem)] p-0 sm:w-[380px]' sideOffset={8}>
        <div className='flex items-center justify-between px-4 pt-3'>
          <Link href='/dashboard/notifications' className='group flex items-center gap-1'><h4 className='text-sm font-semibold group-hover:underline'>通知中心</h4><Icons.chevronRight className='text-muted-foreground h-3.5 w-3.5' /></Link>
          {unreadCount > 0 && <Button variant='ghost' size='sm' className='text-muted-foreground h-auto px-2 py-1 text-xs' onClick={() => void markAllRead()}>全部标为已读</Button>}
        </div>
        <Separator />
        <ScrollArea className='h-[400px]'>
          {notifications.length === 0 ? <div className='flex flex-col items-center justify-center py-12'><Icons.notification className='text-muted-foreground/40 mb-2 h-8 w-8' /><p className='text-muted-foreground text-sm'>暂无通知</p></div> : <div className='flex flex-col gap-1 p-2'>{notifications.slice(0, MAX_VISIBLE).map((notification) => <NotificationCard key={notification.id} id={notification.id} title={notification.title} body={notification.body} status={notification.status} createdAt={notification.createdAt} actions={actionsFor(notification)} onMarkAsRead={(id) => void markRead(id)} onAction={(id, _actionId) => { void markRead(id); const url = notification.actionUrl; if (url) router.push(url); }} />)}</div>}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function actionsFor(notification: PlatformNotification): NotificationAction[] {
  if (!notification.actionUrl) return [];
  return [{ id: 'open', label: '查看详情', type: 'redirect', style: 'primary' }];
}
