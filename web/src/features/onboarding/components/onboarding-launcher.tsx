'use client';

import { useNextStep } from 'nextstepjs';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { PLATFORM_TOUR_NAME } from './platform-onboarding';

export function OnboardingLauncher() {
  const { startNextStep } = useNextStep();

  return (
    <Button
      variant='ghost'
      size='icon'
      className='size-8'
      onClick={() => startNextStep(PLATFORM_TOUR_NAME)}
      aria-label='重新查看使用引导'
      title='重新查看使用引导'
    >
      <Icons.help />
    </Button>
  );
}
