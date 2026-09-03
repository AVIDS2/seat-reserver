import { getBookingSnapshot } from '@/features/booking/api/server-service';
import SeatMapPage from '@/features/booking/components/seat-map-page';

export const metadata = {
  title: '座位图'
};

export default async function Page() {
  const snapshot = await getBookingSnapshot();
  return <SeatMapPage initialAccounts={snapshot.accounts} />;
}
