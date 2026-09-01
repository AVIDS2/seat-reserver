'use client';

import Link from 'next/link';
import { Icons } from '@/components/icons';
import { usePlatformSession } from '@/features/auth/platform-session';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';

export function OrgSwitcher() {
  const user = usePlatformSession();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size='lg' tooltip='个人工作区' render={<Link href='/dashboard/workspaces' aria-label='个人工作区' />}>
          <div className='bg-sidebar-primary text-sidebar-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg'><Icons.workspace className='size-4' /></div>
          <div className='grid flex-1 text-left text-sm leading-tight'><span className='truncate font-medium'>{user?.displayName || '个人工作区'}</span><span className='text-muted-foreground truncate text-xs'>{user?.role === 'admin' ? '管理员工作区' : '个人预约工作区'}</span></div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
