import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Dashboard: Sheet Form'
};

export default function Page() {
  redirect('/dashboard/tasks');
}
