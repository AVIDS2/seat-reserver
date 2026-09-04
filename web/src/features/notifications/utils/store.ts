import { create } from 'zustand';
// import { persist } from 'zustand/middleware';
import type { NotificationStatus, NotificationAction } from '@/components/ui/notification-card';

export type Notification = {
  id: string;
  title: string;
  body: string;
  status: NotificationStatus;
  createdAt: string;
  actions?: NotificationAction[];
};

type NotificationState = {
  notifications: Notification[];
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  addNotification: (notification: Omit<Notification, 'status'>) => void;
  unreadCount: () => number;
};

const mockNotifications: Notification[] = [
  {
    id: '1',
    title: '明早预约已排程',
    body: '2 个任务将在下一次开放窗口自动执行，账号会提前完成连接检查。',
    status: 'unread',
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    actions: [
      {
        id: 'view',
        label: '查看任务',
        type: 'redirect',
        style: 'primary'
      }
    ]
  },
  {
    id: '2',
    title: '授权链路正常',
    body: '我的账号和朋友账号最近一次 Token 验证均已通过。',
    status: 'unread',
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    actions: [
      {
        id: 'view-product',
        label: '查看账号',
        type: 'redirect',
        style: 'primary'
      }
    ]
  },
  {
    id: '3',
    title: '上次运行未抢到',
    body: '8 月 31 日的预约窗口已结束，详细响应和尝试次数可以在运行记录中查看。',
    status: 'unread',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    actions: [
      {
        id: 'billing',
        label: '查看记录',
        type: 'redirect',
        style: 'primary'
      }
    ]
  },
  {
    id: '4',
    title: '账号预热完成',
    body: '今天的两个账号都在预约前完成了 Token 刷新。',
    status: 'read',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    actions: [
      {
        id: 'open',
        label: '查看运行',
        type: 'redirect',
        style: 'primary'
      }
    ]
  },
  {
    id: '5',
    title: '候选策略待优化',
    body: '最近 7 日成功率为 86%，可以在任务页调整座位和时间候选。',
    status: 'read',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    actions: [
      {
        id: 'open-chat',
        label: '调整任务',
        type: 'redirect',
        style: 'primary'
      }
    ]
  }
];

export const useNotificationStore = create<NotificationState>()(
  // To enable persistence across refreshes, uncomment the persist wrapper below:
  // persist(
  (set, get) => ({
    notifications: mockNotifications,

    markAsRead: (id) =>
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, status: 'read' as const } : n
        )
      })),

    markAllAsRead: () =>
      set((state) => ({
        notifications: state.notifications.map((n) => ({
          ...n,
          status: 'read' as const
        }))
      })),

    removeNotification: (id) =>
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id)
      })),

    addNotification: (notification) =>
      set((state) => ({
        notifications: [{ ...notification, status: 'unread' as const }, ...state.notifications]
      })),

    unreadCount: () => get().notifications.filter((n) => n.status === 'unread').length
  })
  //   ,
  //   { name: 'notifications' }
  // )
);
