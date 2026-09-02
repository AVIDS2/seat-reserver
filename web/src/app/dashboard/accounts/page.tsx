import BookingAccountsPage from '@/features/booking/components/booking-accounts';
import { getBookingSnapshot } from '@/features/booking/api/server-service';

export const metadata = {
  title: '账号与授权'
};

export default async function Page() {
  const snapshot = await getBookingSnapshot();
  return <BookingAccountsPage initialAccounts={snapshot.accounts} />;
}
