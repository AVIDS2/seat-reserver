import { getBookingSnapshot } from '@/features/booking/api/server-service';
import BookingReservationsPage from '@/features/booking/components/booking-reservations';

export const metadata = {
  title: '我的预约'
};

export default async function Page() {
  const snapshot = await getBookingSnapshot();
  return <BookingReservationsPage initialAccounts={snapshot.accounts} />;
}
