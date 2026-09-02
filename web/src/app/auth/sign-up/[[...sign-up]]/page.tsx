import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import SignUpViewPage from '@/features/auth/components/sign-up-view';
import { getPlatformUserServer } from '@/features/booking/api/server-service';

export const metadata: Metadata = {
  title: '注册',
  description: '创建一考即过预约控制台账号。'
};

export default async function Page() {
  if (await getPlatformUserServer()) redirect('/dashboard/overview');
  return <SignUpViewPage />;
}
