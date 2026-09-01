import type { NavGroup } from '@/types';

export const navGroups: NavGroup[] = [
  {
    label: '工作台',
    items: [
      {
        title: '总览',
        url: '/dashboard/overview',
        icon: 'dashboard',
        shortcut: ['d', 'd'],
        items: []
      },
      {
        title: '预约任务',
        url: '/dashboard/tasks',
        icon: 'target',
        shortcut: ['t', 't'],
        items: []
      },
      {
        title: '账号与授权',
        url: '/dashboard/accounts',
        icon: 'shield',
        shortcut: ['a', 'a'],
        items: []
      },
      {
        title: '运行记录',
        url: '/dashboard/runs',
        icon: 'history',
        shortcut: ['r', 'r'],
        items: []
      }
    ]
  },
  {
    label: '系统',
    items: [
      {
        title: '通知中心',
        url: '/dashboard/notifications',
        icon: 'notification',
        shortcut: ['n', 'n'],
        items: []
      }
    ]
  },
  {
    label: '管理',
    items: [
      {
        title: '管理员工作台',
        url: '/dashboard/admin',
        icon: 'teams',
        access: { role: 'admin' },
        shortcut: ['a', 'd'],
        items: []
      }
    ]
  }
];
