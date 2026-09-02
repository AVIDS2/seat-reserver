import BookingRunsPage from '@/features/booking/components/booking-runs';
import { getBookingSnapshot } from '@/features/booking/api/server-service';

export const metadata = {
  title: '运行记录'
};

export default async function Page() {
  const snapshot = await getBookingSnapshot();
  return <BookingRunsPage initialRuns={snapshot.runs} />;
}
