import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const cardVariants = cva('rounded-xl border shadow transition-all duration-300', {
  variants: {
    variant: {
      default: 'border-border bg-card text-card-foreground hover:shadow-lg',
      faded: 'border-border text-muted-foreground scale-95 opacity-50',
      bento: 'border-none bg-muted/40 text-foreground shadow-none hover:scale-[1.02]',
      bentoHighlight:
        'border-none bg-primary text-primary-foreground shadow-none hover:scale-[1.02]'
    }
  },
  defaultVariants: {
    variant: 'default'
  }
});

function Card({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof cardVariants>) {
  return (
    <div data-slot='landing-card' className={cn(cardVariants({ variant, className }))} {...props} />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='landing-card-header'
      className={cn('flex flex-col gap-1.5 p-6', className)}
      {...props}
    />
  );
}

function CardTitle({ className, children, ...props }: React.ComponentProps<'h3'>) {
  return (
    <h3
      data-slot='landing-card-title'
      className={cn('font-semibold leading-none tracking-tight', className)}
      {...props}
    >
      {children}
    </h3>
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='landing-card-description'
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot='landing-card-content' className={cn('p-6 pt-0', className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='landing-card-footer'
      className={cn('flex items-center p-6 pt-0', className)}
      {...props}
    />
  );
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
