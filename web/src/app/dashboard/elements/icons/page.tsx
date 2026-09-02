import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Dashboard : Icons'
};

export default function Page() {
  redirect('/dashboard/overview');
}
