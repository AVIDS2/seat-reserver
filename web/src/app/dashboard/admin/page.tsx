import AdminDashboard from '@/features/admin/components/admin-dashboard';
import { getAdminSnapshot, getPlatformUserServer } from '@/features/booking/api/server-service';
import { redirect } from 'next/navigation';

export const metadata = {
  title: '管理员工作台'
};

export default async function Page() {
  const user = await getPlatformUserServer();
  if (user?.role !== 'admin') redirect('/dashboard/overview');
  const snapshot = await getAdminSnapshot();
  return <AdminDashboard initialData={snapshot} />;
}
