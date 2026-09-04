import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import SignInViewPage from '@/features/auth/components/sign-in-view';
import { getPlatformUserServer } from '@/features/booking/api/server-service';

export const metadata: Metadata = {
  title: '登录',
  description: '登录席定高校座位预约平台。'
};

export default async function Page() {
  if (await getPlatformUserServer()) redirect('/dashboard/overview');
  return <SignInViewPage />;
}
