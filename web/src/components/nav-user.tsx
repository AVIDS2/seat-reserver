'use client';

import Link from 'next/link';
import { Icons } from '@/components/icons';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function NavUser({ user }: { user: { name: string; email: string; avatar: string } }) {
  return (
    <Link href='/dashboard/profile' className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'w-full justify-start gap-2')}>
      <div className='bg-muted flex size-7 items-center justify-center rounded-lg text-xs font-semibold'>{user.name.slice(0, 1)}</div>
      <span className='truncate'>{user.name}</span>
      <Icons.chevronRight className='ml-auto size-4' />
    </Link>
  );
}
