import { Metadata } from 'next';
import SignUpViewPage from '@/features/auth/components/sign-up-view';

export const metadata: Metadata = {
  title: '注册',
  description: '创建一考即过预约控制台账号。'
};

export default function Page() {
  return <SignUpViewPage />;
}
