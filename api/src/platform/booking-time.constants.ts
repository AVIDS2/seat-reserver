export const BOOKABLE_START_MINUTES = 7 * 60;
export const BOOKABLE_END_MINUTES = 22 * 60;
export const MIN_SUPPORTED_BOOKING_MINUTES = 7 * 60;
export const MAX_SUPPORTED_BOOKING_MINUTES = 23 * 60;
export const LIBRARY_BOOKABLE_START_MINUTES = 7 * 60;
export const LIBRARY_BOOKABLE_END_MINUTES = 23 * 60;
export const STUDY_ROOM_MAX_BOOKING_MINUTES = 8 * 60;
export const LIBRARY_MAX_BOOKING_MINUTES = 4 * 60;

export function bookingWindow(serviceType: string): {
  start: number;
  end: number;
} {
  return serviceType === 'library'
    ? {
        start: LIBRARY_BOOKABLE_START_MINUTES,
        end: LIBRARY_BOOKABLE_END_MINUTES,
      }
    : { start: BOOKABLE_START_MINUTES, end: BOOKABLE_END_MINUTES };
}

export function maxBookingMinutes(serviceType: string): number {
  return serviceType === 'library'
    ? LIBRARY_MAX_BOOKING_MINUTES
    : STUDY_ROOM_MAX_BOOKING_MINUTES;
}
