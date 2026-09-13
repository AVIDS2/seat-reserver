'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Icons } from '@/components/icons';
import { BrandMark } from '@/components/brand-mark';
import { ProfileAvatar } from '@/components/profile/profile-avatar';
import { navGroups } from '@/config/nav-config';
import { usePlatformSession } from '@/features/auth/platform-session';
import { CampusSwitcher } from '@/features/campus/components/campus-switcher';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail
} from '@/components/ui/sidebar';

export default function AppSidebar() {
  const pathname = usePathname();
  const user = usePlatformSession();
  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.access?.role || item.access.role === user?.role)
    }))
    .filter((group) => group.items.length > 0);

  return (
    <Sidebar collapsible='icon' variant='inset'>
      <SidebarHeader className='group-data-[collapsible=icon]:pt-4'>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size='lg'
              tooltip='席定'
              render={<Link href='/dashboard/overview' aria-label='席定高校座位预约平台' />}
            >
              <BrandMark size={34} priority />
              <div className='grid flex-1 text-left text-sm leading-tight'>
                <span className='truncate font-semibold'>席定</span>
                <span className='text-muted-foreground truncate text-xs'>高校座位预约平台</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <CampusSwitcher />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className='overflow-x-hidden'>
        {visibleGroups.map((group) => (
          <SidebarGroup key={group.label || 'ungrouped'} className='py-0'>
            {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarMenu>
              {group.items.map((item) => {
                const Icon = item.icon ? Icons[item.icon] : Icons.logo;
                const isActive = pathname === item.url || pathname.startsWith(`${item.url}/`);

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={isActive}
                      render={<Link href={item.url} aria-label={item.title} />}
                    >
                      <Icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size='lg'
              tooltip='个人设置'
              render={<Link href='/dashboard/profile' aria-label='个人设置' />}
            >
              <ProfileAvatar
                avatarUrl={user?.avatarUrl}
                name={user?.displayName}
                frameId={user?.profileDecoration?.avatarFrameId}
                size='default'
                className='size-8 rounded-full'
              />
              <div className='grid flex-1 text-left text-sm leading-tight'>
                <span className='truncate font-medium'>{user?.displayName || '个人账户'}</span>
                <span className='text-muted-foreground truncate text-xs'>
                  {user?.profileDecoration?.titleLabel ||
                    (user?.role === 'admin' ? '管理员' : '个人设置')}
                </span>
              </div>
              <Icons.chevronRight className='ml-auto size-4' />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
