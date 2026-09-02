import BookingDashboard from '@/features/booking/components/booking-dashboard';
import { getBookingSnapshot } from '@/features/booking/api/server-service';

export const metadata = {
  title: '总览'
};

export default async function Page() {
  const snapshot = await getBookingSnapshot();
  return <BookingDashboard initialData={snapshot} />;
}
