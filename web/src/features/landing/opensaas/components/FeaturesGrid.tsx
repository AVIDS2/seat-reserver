import React from 'react';
import { Card, CardContent, CardDescription, CardTitle } from './opensaas-card';
import { cn } from '@/lib/utils';
import { SectionTitle } from './SectionTitle';

export interface GridFeature {
  name?: string;
  description: string;
  href?: string;
  icon?: React.ReactNode;
  emoji?: string;
  direction?: 'col' | 'row' | 'col-reverse' | 'row-reverse';
  align?: 'center' | 'left';
  size: 'small' | 'medium' | 'large';
  fullWidthIcon?: boolean;
  highlight?: boolean;
}

interface FeaturesGridProps {
  features: GridFeature[];
  className?: string;
}

export function FeaturesGrid({ features, className = '' }: FeaturesGridProps) {
  return (
    <div className='mx-auto my-16 flex max-w-7xl flex-col gap-4 md:my-24 lg:my-40' id='features'>
      <SectionTitle
        title='产品能力'
        description='把授权、策略、执行和结果放在同一套清晰的工作流里。'
      />
      <div
        className={cn(
          'mx-4 grid auto-rows-[minmax(140px,auto)] grid-cols-2 gap-4 md:mx-6 md:grid-cols-4 lg:mx-8 lg:grid-cols-6',
          className
        )}
      >
        {features.map((feature) => (
          <FeaturesGridItem key={feature.name + feature.description} {...feature} />
        ))}
      </div>
    </div>
  );
}

function FeaturesGridItem({
  name,
  description,
  icon,
  emoji,
  href,
  direction = 'col',
  align = 'center',
  size = 'medium',
  fullWidthIcon = false,
  highlight = false
}: GridFeature) {
  const gridFeatureSizeToClasses: Record<GridFeature['size'], string> = {
    small: 'col-span-1',
    medium: 'col-span-2 md:col-span-2 lg:col-span-2',
    large: 'col-span-2 md:col-span-2 lg:col-span-2 row-span-2'
  };

  const directionToClass: Record<NonNullable<GridFeature['direction']>, string> = {
    col: 'flex-col',
    row: 'flex-row',
    'row-reverse': 'flex-row-reverse',
    'col-reverse': 'flex-col-reverse'
  };

  const mobileOrderClass = highlight ? 'order-last md:order-none' : '';

  const gridFeatureCard = (
    <Card
      className={cn(
        'h-full min-h-[140px] cursor-pointer transition-all duration-300 hover:shadow-lg',
        gridFeatureSizeToClasses[size],
        mobileOrderClass,
        highlight && 'bg-radial-gradient'
      )}
      variant={highlight ? 'bentoHighlight' : 'bento'}
    >
      <CardContent
        className={cn(
          'flex h-full flex-col items-center justify-center px-4 py-8',
          fullWidthIcon && direction === 'col-reverse'
            ? 'justify-end p-0 pb-0 pt-8'
            : fullWidthIcon && 'justify-start p-0 pb-8 pt-0'
        )}
      >
        {fullWidthIcon && (icon || emoji) ? (
          <div className='flex w-full flex-col'>
            <div
              className={cn(
                'flex w-full items-center justify-center',
                direction === 'col-reverse' ? 'order-2 mt-6' : 'order-1'
              )}
            >
              {icon ? (
                <div className='flex w-full justify-center'>{icon}</div>
              ) : emoji ? (
                <span className='text-4xl'>{emoji}</span>
              ) : null}
            </div>
            {fullWidthIcon && (icon || emoji) && (
              <CardTitle
                className={cn(
                  'text-center text-2xl',
                  direction === 'col-reverse' ? 'order-1' : 'order-2'
                )}
              >
                {name}
              </CardTitle>
            )}
            <CardDescription
              className={cn(
                'px-8 text-xs leading-relaxed',
                'text-center',
                direction === 'col-reverse' ? 'order-1' : 'order-2'
              )}
            >
              {description}
            </CardDescription>
          </div>
        ) : (
          <div
            className={cn(
              'flex items-center',
              (icon || emoji) && 'gap-3',
              directionToClass[direction],
              align === 'center' ? 'items-center justify-center' : 'justify-start'
            )}
          >
            {(icon || emoji) && (
              <div className='flex h-10 w-10 items-center justify-center rounded-lg'>
                {icon ? icon : <span className='text-2xl'>{emoji}</span>}
              </div>
            )}
            <CardTitle
              className={cn(
                highlight ? 'text-4xl font-bold' : 'text-lg',
                align === 'center' ? 'text-center' : 'text-left'
              )}
            >
              {name}
            </CardTitle>
          </div>
        )}
        {!fullWidthIcon && (
          <CardDescription
            className={cn(
              'px-8 text-xs leading-relaxed',
              direction === 'col' || align === 'center' ? 'text-center' : 'text-left'
            )}
          >
            {description}
          </CardDescription>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <a
        href={href}
        target={href.startsWith('http') ? '_blank' : undefined}
        rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
        className={cn(gridFeatureSizeToClasses[size], mobileOrderClass)}
      >
        {gridFeatureCard}
      </a>
    );
  }

  return gridFeatureCard;
}
