'use client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { UserAvatarProfile } from '@/components/user-avatar-profile';
import { usePlatformSession } from '@/features/auth/platform-session';
import { signOutPlatform } from '@/features/booking/api/service';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

export function UserNav() {
  const user = usePlatformSession();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  if (!user) return null;

  const displayName = user.displayName || user.email;
  const profileUser = {
    imageUrl: '',
    fullName: displayName,
    emailAddresses: [{ emailAddress: user.email }]
  };

  const signOut = async () => {
    setSigningOut(true);
    try {
      await signOutPlatform();
      router.push('/auth/sign-in');
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
        <UserAvatarProfile user={profileUser} />
      </DropdownMenuTrigger>
      <DropdownMenuContent className='w-60' align='end' sideOffset={10}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className='font-normal'>
            <div className='flex flex-col gap-1'>
              <p className='text-sm leading-none font-medium'>{displayName}</p>
              <p className='text-muted-foreground text-xs leading-none'>{user.email}</p>
              <p className='text-muted-foreground mt-1 text-xs'>
                {user.role === 'admin' ? '管理员' : '普通用户'}
              </p>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
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
