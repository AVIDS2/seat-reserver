import { cn } from '@/lib/utils';

// Adapted from React Bits ShinyText (MIT + Commons Clause), used as part of this app.
// https://github.com/DavidHDev/react-bits
export function ShinyText({
  text,
  className,
  disabled = false
}: {
  text: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <span className={cn('react-bits-shiny-text', disabled && 'react-bits-shiny-text-disabled', className)}>
      {text}
    </span>
  );
}
