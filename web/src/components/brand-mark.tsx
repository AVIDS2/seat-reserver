import Image from 'next/image';

import { cn } from '@/lib/utils';

export function BrandMark({
  size = 32,
  className,
  priority = false
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src='/brand/WUDlogo.svg'
      alt=''
      width={size}
      height={size}
      priority={priority}
      aria-hidden='true'
      className={cn('shrink-0 object-contain', className)}
    />
  );
}
