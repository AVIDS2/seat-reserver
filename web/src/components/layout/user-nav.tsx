'use client';
import { Button } from '@/components/ui/button';
import { ProfileAvatar, ProfileTitlePill } from '@/components/profile/profile-avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { usePlatformSession } from '@/features/auth/platform-session';
import { signOutPlatform } from '@/features/booking/api/service';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { ThemeSelector } from '@/components/themes/theme-selector';

export function UserNav() {
  const user = usePlatformSession();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  if (!user) return null;

  const displayName = user.displayName || user.email;
  const signOut = async () => {
    setSigningOut(true);
    try {
      await signOutPlatform();
      router.push('/');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '退出登录失败');
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant='ghost' className='relative h-8 w-8 rounded-full' />}
        aria-label='打开用户菜单'
      >
        <ProfileAvatar
          avatarUrl={user.avatarUrl}
          name={displayName}
          frameId={user.profileDecoration?.avatarFrameId}
          showStatus
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent className='w-60' align='end' sideOffset={10}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className='font-normal'>
            <div className='flex flex-col gap-1'>
              <p className='text-sm leading-none font-medium'>{displayName}</p>
              <p className='text-muted-foreground text-xs leading-none'>{user.email}</p>
              <div className='mt-2 flex items-center gap-2'>
                <span className='size-2 rounded-full bg-emerald-500' aria-hidden='true' />
                <p className='text-muted-foreground text-xs'>
                  {user.role === 'admin' ? '管理员' : '普通用户'} · 在线
                </p>
              </div>
              {user.profileDecoration && (
                <div className='mt-2 flex flex-wrap gap-1.5'>
                  <ProfileTitlePill
                    title={user.profileDecoration.titleLabel}
                    titleId={user.profileDecoration.titleId}
                  />
                  <Badge variant='outline'>{user.profileDecoration.badgeLabel}</Badge>
                </div>
              )}
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <div className='px-2 py-1.5'>
          <ThemeSelector />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push('/dashboard/profile')}>
            个人设置
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/dashboard/accounts')}>
            账号与授权
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/dashboard/notifications')}>
            通知中心
          </DropdownMenuItem>
          {user.role === 'admin' && (
            <DropdownMenuItem onClick={() => router.push('/dashboard/admin')}>
              管理员工作台
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void signOut()} disabled={signingOut}>
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
