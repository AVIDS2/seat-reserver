import BookingTasksPage from '@/features/booking/components/booking-tasks';
import { getBookingSnapshot } from '@/features/booking/api/server-service';
import type { BookingTaskDraft, VenueType } from '@/features/booking/types';

export const metadata = {
  title: '预约任务'
};

export default async function Page({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const snapshot = await getBookingSnapshot();
  const params = searchParams ? await searchParams : {};
  const draft = parseTaskDraft(params);
  return (
    <BookingTasksPage
      initialTasks={snapshot.tasks}
      initialAccounts={snapshot.accounts}
      initialTaskDraft={draft}
    />
  );
}

function parseTaskDraft(
  params: Record<string, string | string[] | undefined>
): BookingTaskDraft | undefined {
  const accountId = stringParam(params.accountId);
  const venueType = stringParam(params.serviceType);
  const buildingId = stringParam(params.buildingId);
  const roomId = stringParam(params.roomId);
  const seatIds = stringParam(params.seatIds)
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (!accountId && !venueType && !buildingId && !roomId && !seatIds?.length) return undefined;
  return {
    accountId,
    venueType:
      venueType === 'library' || venueType === 'study_room' ? (venueType as VenueType) : undefined,
    buildingId,
    roomId,
    seatIds
  };
}

function stringParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
