import { formatDateTimeIST } from './dateTimeIST';

/** DD/MM/YYYY • hh:mm AM/PM in IST */
export function formatTimelineTimestamp(dateString: string): string {
  return formatDateTimeIST(dateString);
}
