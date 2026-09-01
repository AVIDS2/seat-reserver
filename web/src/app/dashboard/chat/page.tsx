import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Dashboard: Chat'
};

export default function Page() {
  redirect('/dashboard/overview');
}
