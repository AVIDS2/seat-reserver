import React from 'react';
import { SidebarTrigger } from '../ui/sidebar';
import { Separator } from '../ui/separator';
import { Breadcrumbs } from '../breadcrumbs';
import SearchInput from '../search-input';
import { ThemeModeToggle } from '../themes/theme-mode-toggle';
import { NotificationCenter } from '@/features/notifications/components/notification-center';
import { UserNav } from './user-nav';

export default function Header() {
  return (
    <header className='bg-background/60 sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-2 backdrop-blur-md md:h-14'>
      <div className='flex min-w-0 flex-1 items-center gap-2 px-4'>
        <SidebarTrigger className='-ml-1' />
        <Separator orientation='vertical' className='mr-2 h-4 data-vertical:self-center' />
        <div className='min-w-0 truncate'>
          <Breadcrumbs />
        </div>
      </div>

      <div className='flex shrink-0 items-center gap-2 px-4'>
        <div className='text-muted-foreground hidden items-center gap-2 text-xs lg:flex'>
          <span className='bg-emerald-500 size-1.5 rounded-full' aria-hidden='true' />
          系统在线
        </div>
        <div className='hidden md:flex'>
          <SearchInput />
        </div>
        <ThemeModeToggle />
        <NotificationCenter />
        <UserNav />
      </div>
    </header>
  );
}
