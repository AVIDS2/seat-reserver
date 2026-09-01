import { redirect } from 'next/navigation';

export const metadata = { title: '管理员工作台' };

export default function UsersPage() {
  redirect('/dashboard/admin');
}
