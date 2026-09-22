export const BOOKABLE_START_MINUTES = 7 * 60;
export const BOOKABLE_END_MINUTES = 22 * 60;
export const MIN_SUPPORTED_BOOKING_MINUTES = 7 * 60;
export const MAX_SUPPORTED_BOOKING_MINUTES = 23 * 60;
export const LIBRARY_BOOKABLE_START_MINUTES = 7 * 60;
export const LIBRARY_BOOKABLE_END_MINUTES = 23 * 60;
export const STUDY_ROOM_MAX_BOOKING_MINUTES = 8 * 60;
export const LIBRARY_MAX_BOOKING_MINUTES = 4 * 60;

export function bookingWindow(
  serviceType: string,
  schoolCode = 'cczu',
): {
  start: number;
  end: number;
} {
  return serviceType === 'library' && schoolCode === 'njtech'
    ? { start: 8 * 60, end: 22 * 60 }
    : serviceType === 'library'
      ? {
          start: LIBRARY_BOOKABLE_START_MINUTES,
          end: LIBRARY_BOOKABLE_END_MINUTES,
        }
      : { start: BOOKABLE_START_MINUTES, end: BOOKABLE_END_MINUTES };
}

export function maxBookingMinutes(
  serviceType: string,
  schoolCode = 'cczu',
): number {
  if (serviceType === 'library' && schoolCode === 'njtech') return 14 * 60;
  return serviceType === 'library'
    ? LIBRARY_MAX_BOOKING_MINUTES
    : STUDY_ROOM_MAX_BOOKING_MINUTES;
}
