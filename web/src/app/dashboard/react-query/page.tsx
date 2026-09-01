import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Dashboard: React Query'
};

export default function ReactQueryPage() {
  redirect('/dashboard/overview');
}
