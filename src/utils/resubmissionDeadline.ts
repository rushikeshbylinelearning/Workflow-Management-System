import { formatDateTimeIST } from './dateTimeIST';

/** Mirrors backend ENABLE_RESUBMISSION_DEADLINE — set VITE_ENABLE_RESUBMISSION_DEADLINE=true */
export const RESUBMISSION_DEADLINE_ENABLED =
  import.meta.env.VITE_ENABLE_RESUBMISSION_DEADLINE === 'true';

export type ResubmissionQuickOption =
  | 'tomorrow_eod'
  | 'plus_2_days'
  | 'plus_3_days'
  | 'plus_1_week'
  | 'custom';

const MIN_MS = 30 * 60 * 1000;
const MAX_MS = 90 * 24 * 60 * 60 * 1000;

export function getUserTimezoneLabel(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'Local time';
  }
}

/** Default: tomorrow 6:00 PM local */
export function getDefaultResubmissionDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  return d;
}

export function applyQuickOption(option: ResubmissionQuickOption): Date {
  const d = new Date();
  switch (option) {
    case 'tomorrow_eod': {
      const t = new Date();
      t.setDate(t.getDate() + 1);
      t.setHours(18, 0, 0, 0);
      return t;
    }
    case 'plus_2_days':
      d.setDate(d.getDate() + 2);
      d.setHours(18, 0, 0, 0);
      return d;
    case 'plus_3_days':
      d.setDate(d.getDate() + 3);
      d.setHours(18, 0, 0, 0);
      return d;
    case 'plus_1_week':
      d.setDate(d.getDate() + 7);
      d.setHours(18, 0, 0, 0);
      return d;
    default:
      return getDefaultResubmissionDate();
  }
}

export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function validateResubmissionDeadline(date: Date | null): { valid: boolean; message?: string } {
  if (!date) {
    return { valid: false, message: 'Please select a resubmission deadline' };
  }
  const target = date.getTime();
  const now = Date.now();
  if (target <= now + MIN_MS) {
    return { valid: false, message: 'This deadline must be in the future' };
  }
  if (target > now + MAX_MS) {
    return { valid: false, message: 'Deadline cannot be more than 90 days from now' };
  }
  return { valid: true };
}

export function formatResubmissionDisplay(isoOrMysql: string): string {
  return formatDateTimeIST(isoOrMysql);
}

export function formatResubmissionCountdown(isoOrMysql: string): { text: string; overdue: boolean } {
  const target = new Date(isoOrMysql).getTime();
  const diff = target - Date.now();
  if (diff <= 0) {
    const abs = Math.abs(diff);
    const hours = Math.floor(abs / (60 * 60 * 1000));
    const days = Math.floor(hours / 24);
    if (days >= 1) return { text: `Expired ${days} day${days !== 1 ? 's' : ''} ago`, overdue: true };
    if (hours >= 1) return { text: `Expired ${hours} hour${hours !== 1 ? 's' : ''} ago`, overdue: true };
    const mins = Math.max(1, Math.floor(abs / (60 * 1000)));
    return { text: `Expired ${mins} minute${mins !== 1 ? 's' : ''} ago`, overdue: true };
  }
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days >= 1) return { text: `${days} day${days !== 1 ? 's' : ''} left`, overdue: false };
  if (hours >= 1) return { text: `${hours} hour${hours !== 1 ? 's' : ''} left`, overdue: false };
  const mins = Math.max(1, Math.floor(diff / (60 * 1000)));
  return { text: `${mins} minute${mins !== 1 ? 's' : ''} left`, overdue: false };
}
