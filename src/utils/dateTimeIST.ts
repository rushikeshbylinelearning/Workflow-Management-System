/** India Standard Time — used for all user-facing dates in workflow UI */
export const IST_TIMEZONE = 'Asia/Kolkata';

const IST_DATE_FMT = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const IST_TIME_FMT = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST_TIMEZONE,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/**
 * Parse API / MySQL timestamps. ISO strings with Z are UTC; bare "YYYY-MM-DD HH:mm:ss"
 * from MySQL (session TZ +05:30) is treated as IST wall time.
 */
export function parseApiDateTime(dateString: string): Date {
  if (!dateString) return new Date(NaN);
  const trimmed = String(dateString).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(trimmed)) {
    const iso = trimmed.replace(' ', 'T');
    const withTz = `${iso}+05:30`;
    const d = new Date(withTz);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date(trimmed);
}

/** DD/MM/YYYY in IST */
export function formatDateIST(dateString: string): string {
  const d = parseApiDateTime(dateString);
  if (Number.isNaN(d.getTime())) return '';
  return IST_DATE_FMT.format(d);
}

/** hh:mm AM/PM in IST */
export function formatTimeIST(dateString: string): string {
  const d = parseApiDateTime(dateString);
  if (Number.isNaN(d.getTime())) return '';
  return IST_TIME_FMT.format(d);
}

/** DD/MM/YYYY • hh:mm AM/PM in IST */
export function formatDateTimeIST(dateString: string): string {
  const datePart = formatDateIST(dateString);
  const timePart = formatTimeIST(dateString);
  if (!datePart) return '';
  return timePart ? `${datePart} • ${timePart}` : datePart;
}
