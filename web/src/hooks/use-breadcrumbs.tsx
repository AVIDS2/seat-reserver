'use client';

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

type BreadcrumbItem = {
  title: string;
  link: string;
};

// This allows to add custom title as well
const routeMapping: Record<string, BreadcrumbItem[]> = {
  '/dashboard': [{ title: '总览', link: '/dashboard/overview' }],
  '/dashboard/overview': [{ title: '总览', link: '/dashboard/overview' }],
  '/dashboard/tasks': [{ title: '预约任务', link: '/dashboard/tasks' }],
  '/dashboard/accounts': [{ title: '账号与授权', link: '/dashboard/accounts' }],
  '/dashboard/profile': [{ title: '个人设置', link: '/dashboard/profile' }],
  '/dashboard/seats': [{ title: '座位图', link: '/dashboard/seats' }],
  '/dashboard/store': [{ title: '席定商店', link: '/dashboard/store' }],
  '/dashboard/store/recharge': [{ title: '充值席定币', link: '/dashboard/store/recharge' }],
  '/dashboard/membership': [{ title: '会员与邀请', link: '/dashboard/membership' }],
  '/dashboard/reservations': [{ title: '我的预约', link: '/dashboard/reservations' }],
  '/dashboard/attendance': [{ title: '签到保护', link: '/dashboard/attendance' }],
  '/dashboard/runs': [{ title: '运行记录', link: '/dashboard/runs' }],
  '/dashboard/notifications': [{ title: '通知中心', link: '/dashboard/notifications' }]
};

export function useBreadcrumbs() {
  const pathname = usePathname();

  const breadcrumbs = useMemo(() => {
    // Check if we have a custom mapping for this exact path
    if (routeMapping[pathname]) {
      return routeMapping[pathname];
    }

    // If no exact match, fall back to generating breadcrumbs from the path
    const segments = pathname.split('/').filter(Boolean);
    return segments.map((segment, index) => {
      const path = `/${segments.slice(0, index + 1).join('/')}`;
      const titleMap: Record<string, string> = {
        dashboard: '工作台',
        overview: '总览',
        tasks: '预约任务',
        accounts: '账号与授权',
        profile: '个人设置',
        seats: '座位图',
        store: '席定商店',
        recharge: '充值席定币',
        membership: '会员与邀请',
        reservations: '我的预约',
        attendance: '签到保护',
        runs: '运行记录',
        notifications: '通知中心'
      };
      return {
        title: titleMap[segment] ?? segment,
        link: path
      };
    });
  }, [pathname]);

  return breadcrumbs;
}
