import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';

const frameClasses: Record<string, string> = {
  plain: 'profile-frame-plain',
  starlight: 'profile-frame-starlight',
  aurora: 'profile-frame-aurora',
  champion: 'profile-frame-champion',
  pro: 'profile-frame-pro'
};

export function profileFrameClass(frameId?: string | null): string {
  return frameClasses[frameId ?? 'plain'] ?? frameClasses.plain;
}

export function ProfileAvatar({
  avatarUrl,
  name,
  frameId,
  size = 'default',
  showStatus = false,
  className
}: {
  avatarUrl?: string | null;
  name?: string | null;
  frameId?: string | null;
  size?: 'default' | 'sm' | 'lg';
  showStatus?: boolean;
  className?: string;
}) {
  const fallback = name?.trim().slice(0, 2) || '席定';
  return (
    <span className={cn('profile-avatar-shell', profileFrameClass(frameId))}>
      <span className='profile-avatar-decor' aria-hidden='true' />
      <Avatar size={size} className={cn('relative z-10', className)}>
        <AvatarImage src={avatarUrl || ''} alt={name || '头像'} />
        <AvatarFallback>{fallback}</AvatarFallback>
        {showStatus && <AvatarBadge className='bg-emerald-500' aria-label='在线' />}
      </Avatar>
    </span>
  );
}

export function ProfileTitlePill({
  title,
  titleId,
  className,
}: {
  title: string;
  titleId?: string | null;
  className?: string;
}) {
  return (
    <span className={cn('profile-title-plaque', titleId && `profile-title-${titleId}`, className)}>
      <Icons.crown aria-hidden='true' />
      {title}
    </span>
  );
}
