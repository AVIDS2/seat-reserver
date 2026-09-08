import BookingDashboard from '@/features/booking/components/booking-dashboard';
import {
  getBookingSnapshot,
  getRewardsSnapshotServer
} from '@/features/booking/api/server-service';

export const metadata = {
  title: '总览'
};

export default async function Page() {
  const [snapshot, rewards] = await Promise.all([
    getBookingSnapshot(),
    getRewardsSnapshotServer()
  ]);
  return <BookingDashboard initialData={snapshot} initialRewards={rewards} />;
}
