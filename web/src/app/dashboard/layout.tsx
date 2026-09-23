import KBar from '@/components/kbar';
import { getPlatformUserServer } from '@/features/booking/api/server-service';
import { PlatformSessionProvider } from '@/features/auth/platform-session';
import { PlatformOnboarding } from '@/features/onboarding/components/platform-onboarding';
import { CampusWorkspaceProvider } from '@/features/campus/campus-workspace';
import AppSidebar from '@/components/layout/app-sidebar';
import Header from '@/components/layout/header';
import { InfoSidebar } from '@/components/layout/info-sidebar';
import { InfobarProvider } from '@/components/ui/infobar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const CAMPUS_CODES = new Set(['all', 'cczu', 'njtech', 'jou']);

export const metadata: Metadata = {
  title: '预约控制台',
  description: '席定高校座位预约平台',
  robots: {
    index: false,
    follow: false
  }
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const user = await getPlatformUserServer();
  if (!user) redirect('/auth/sign-in');

  // Persisting the sidebar state in the cookie.
  const defaultOpen = cookieStore.get('sidebar_state')?.value === 'true';
  const savedCampus = cookieStore.get('active_campus')?.value;
  const initialCampus = CAMPUS_CODES.has(savedCampus || '')
    ? (savedCampus as 'all' | 'cczu' | 'njtech' | 'jou')
    : 'cczu';
  return (
    <PlatformSessionProvider initialUser={user}>
      <CampusWorkspaceProvider initialCampus={initialCampus}>
        <PlatformOnboarding>
          <KBar>
            <SidebarProvider defaultOpen={defaultOpen}>
              <a
                href='#main-content'
                className='bg-background ring-ring sr-only rounded-md px-3 py-2 text-sm font-medium shadow focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:z-50 focus:ring-2'
              >
                Skip to content
              </a>
              <AppSidebar />
              <SidebarInset id='main-content' tabIndex={-1} className='scroll-mt-16'>
                <Header />
                <InfobarProvider defaultOpen={false}>
                  {children}
                  <InfoSidebar side='right' />
                </InfobarProvider>
              </SidebarInset>
            </SidebarProvider>
          </KBar>
        </PlatformOnboarding>
      </CampusWorkspaceProvider>
    </PlatformSessionProvider>
  );
}
