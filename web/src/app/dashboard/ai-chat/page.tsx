import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Dashboard: AI Chat'
};

export default function Page() {
  redirect('/dashboard/overview');
}
