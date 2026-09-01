import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Dashboard: Basic Form'
};

export default function Page() {
  redirect('/dashboard/tasks');
}
