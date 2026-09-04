import { getBookingSnapshot } from '@/features/booking/api/server-service';
import SeatMapPage from '@/features/booking/components/seat-map-page';
import type { SeatMapDraft, VenueType } from '@/features/booking/types';

export const metadata = {
  title: '座位图'
};

export default async function Page({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const snapshot = await getBookingSnapshot();
  const params = searchParams ? await searchParams : {};
  return <SeatMapPage initialAccounts={snapshot.accounts} initialDraft={parseDraft(params)} />;
}

function parseDraft(
  params: Record<string, string | string[] | undefined>
): SeatMapDraft | undefined {
  const serviceType = stringParam(params.serviceType);
  const draft: SeatMapDraft = {
    accountId: stringParam(params.accountId),
    venueType:
      serviceType === 'library' || serviceType === 'study_room'
        ? (serviceType as VenueType)
        : undefined,
    buildingId: stringParam(params.buildingId),
    roomId: stringParam(params.roomId),
    seatId: stringParam(params.seatId),
    startTime: numberParam(params.startTime),
    endTime: numberParam(params.endTime),
    openBooking: stringParam(params.book) === '1'
  };
  return Object.values(draft).some((value) => value !== undefined && value !== false)
    ? draft
    : undefined;
}

function stringParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function numberParam(value: string | string[] | undefined): number | undefined {
  const parsed = Number(stringParam(value));
  return Number.isInteger(parsed) ? parsed : undefined;
}
