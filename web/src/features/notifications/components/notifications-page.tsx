'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { NotificationCard, type NotificationAction } from '@/components/ui/notification-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { markAllNotificationsRead, markNotificationRead } from '@/features/booking/api/service';
import type { PlatformNotification } from '@/features/booking/types';

export default function NotificationsPage({ initialNotifications }: { initialNotifications: PlatformNotification[] }) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const router = useRouter();
  const unread = useMemo(() => notifications.filter((notification) => notification.status === 'unread'), [notifications]);
  const read = useMemo(() => notifications.filter((notification) => notification.status === 'read'), [notifications]);

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

  const renderList = (items: PlatformNotification[]) => {
    if (items.length === 0) return <div className='flex flex-col items-center justify-center py-16'><Icons.notification className='text-muted-foreground/40 mb-3 h-10 w-10' /><p className='text-muted-foreground text-sm'>暂无通知</p></div>;
    return <div className='flex flex-col gap-2'>{items.map((notification) => <NotificationCard key={notification.id} id={notification.id} title={notification.title} body={notification.body} status={notification.status} createdAt={notification.createdAt} actions={actionsFor(notification)} onMarkAsRead={(id) => void markRead(id)} onAction={(id) => { void markRead(id); if (notification.actionUrl) router.push(notification.actionUrl); }} />)}</div>;
  };

  return (
    <PageContainer pageTitle='通知中心' pageDescription='查看预约任务、账号授权和系统运行的重要状态.' pageHeaderAction={unread.length > 0 ? <Button variant='outline' size='sm' onClick={() => void markAllRead()}><Icons.checks data-icon='inline-start' />全部标为已读</Button> : undefined}>
      <Tabs defaultValue='all'>
        <TabsList><TabsTrigger value='all'>全部 ({notifications.length})</TabsTrigger><TabsTrigger value='unread'>未读 ({unread.length})</TabsTrigger><TabsTrigger value='read'>已读 ({read.length})</TabsTrigger></TabsList>
        <TabsContent value='all' className='mt-4'>{renderList(notifications)}</TabsContent>
        <TabsContent value='unread' className='mt-4'>{renderList(unread)}</TabsContent>
        <TabsContent value='read' className='mt-4'>{renderList(read)}</TabsContent>
      </Tabs>
    </PageContainer>
  );
}

function actionsFor(notification: PlatformNotification): NotificationAction[] {
  if (!notification.actionUrl) return [];
  return [{ id: 'open', label: '查看详情', type: 'redirect', style: 'primary' }];
}
