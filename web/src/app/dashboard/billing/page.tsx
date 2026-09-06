import { redirect } from 'next/navigation';

export const metadata = { title: '席定商店' };

export default function BillingPage() {
  redirect('/dashboard/store');
}
