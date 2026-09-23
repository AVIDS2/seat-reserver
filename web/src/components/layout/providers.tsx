'use client';
import React from 'react';
import { ActiveThemeProvider } from '../themes/active-theme';
import QueryProvider from './query-provider';
import { ActivityIslandProvider } from '@/components/activity/activity-island-provider';

export default function Providers({
  activeThemeValue,
  children
}: {
  activeThemeValue: string;
  children: React.ReactNode;
}) {
  return (
    <ActivityIslandProvider>
      <ActiveThemeProvider initialTheme={activeThemeValue}>
        <QueryProvider>{children}</QueryProvider>
      </ActiveThemeProvider>
    </ActivityIslandProvider>
  );
}
