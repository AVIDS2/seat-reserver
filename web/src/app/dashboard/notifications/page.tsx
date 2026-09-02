import NotificationsPage from '@/features/notifications/components/notifications-page';
import { getBookingNotifications } from '@/features/booking/api/server-service';

export const metadata = {
  title: '通知中心'
};

export default async function Page() {
  const notifications = await getBookingNotifications();
  return <NotificationsPage initialNotifications={notifications} />;
}
