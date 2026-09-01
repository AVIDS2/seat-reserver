import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Dashboard: Advanced Form Patterns'
};

export default function Page() {
  redirect('/dashboard/tasks');
}
