import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const frameClasses: Record<string, string> = {
  plain: 'ring-2 ring-border',
  starlight:
    'ring-[3px] ring-sky-400 shadow-[0_0_0_3px_color-mix(in_srgb,#38bdf8_24%,transparent),0_0_20px_color-mix(in_srgb,#a78bfa_55%,transparent)]',
  aurora:
    'ring-[3px] ring-fuchsia-400 shadow-[0_0_0_3px_color-mix(in_srgb,#34d399_30%,transparent),0_0_24px_color-mix(in_srgb,#e879f9_55%,transparent)]',
  champion:
    'ring-[3px] ring-amber-400 shadow-[0_0_0_3px_color-mix(in_srgb,#fbbf24_30%,transparent),0_0_24px_color-mix(in_srgb,#fb7185_50%,transparent)]',
  pro: 'ring-[3px] ring-primary shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_28%,transparent),0_0_22px_color-mix(in_srgb,var(--primary)_55%,transparent)]'
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
    <Avatar size={size} className={cn(profileFrameClass(frameId), className)}>
      <AvatarImage src={avatarUrl || ''} alt={name || '头像'} />
      <AvatarFallback>{fallback}</AvatarFallback>
      {showStatus && <AvatarBadge className='bg-emerald-500' aria-label='在线' />}
    </Avatar>
  );
}
