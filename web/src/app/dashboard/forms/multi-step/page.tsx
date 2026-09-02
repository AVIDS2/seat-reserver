import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Dashboard: Multi-Step Form'
};

export default function Page() {
  redirect('/dashboard/tasks');
}
