import { getBookingSnapshot } from '@/features/booking/api/server-service';
import AttendanceProtectionPage from '@/features/booking/components/attendance-protection-page';

export const metadata = {
  title: '签到保护'
};

export default async function Page() {
  const snapshot = await getBookingSnapshot();
  return <AttendanceProtectionPage initialAccounts={snapshot.accounts} />;
}
