import BookingTasksPage from '@/features/booking/components/booking-tasks';
import { getBookingSnapshot } from '@/features/booking/api/server-service';

export const metadata = {
  title: '预约任务'
};

export default async function Page() {
  const snapshot = await getBookingSnapshot();
  return <BookingTasksPage initialTasks={snapshot.tasks} initialAccounts={snapshot.accounts} />;
}
