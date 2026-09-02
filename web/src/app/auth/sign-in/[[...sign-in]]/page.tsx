import { Metadata } from 'next';
import SignInViewPage from '@/features/auth/components/sign-in-view';

export const metadata: Metadata = {
  title: '登录',
  description: '登录一考即过预约控制台。'
};

export default async function Page() {
  return <SignInViewPage />;
}
