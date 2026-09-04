import { redirect } from 'next/navigation';

export const metadata = { title: '会员与邀请' };

export default function BillingPage() {
  redirect('/dashboard/membership');
}
