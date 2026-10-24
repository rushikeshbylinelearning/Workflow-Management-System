/**
 * Single place for Power BI derived task fields.
 * "Today" is the calendar date in PROJECT_TIMEZONE (default Asia/Kolkata).
 * Timestamps returned by the API are still UTC; this module only decides the date boundary.
 */

const DEFAULT_TIMEZONE = 'Asia/Kolkata';
const DEFAULT_COMPLETION = ['completed'];

function getProjectTimezone() {
  return process.env.PROJECT_TIMEZONE || DEFAULT_TIMEZONE;
}

function getCompletionStatuses() {
  const raw = process.env.POWERBI_COMPLETION_STATUSES;
  if (!raw || !raw.trim()) return DEFAULT_COMPLETION.slice();
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function calendarDate(instant, timeZone) {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function parseIsoDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const text = String(value).trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function daysBetween(laterDate, earlierDate) {
  if (!laterDate || !earlierDate) return null;
  const [y1, m1, d1] = laterDate.split('-').map(Number);
  const [y2, m2, d2] = earlierDate.split('-').map(Number);
  const later = Date.UTC(y1, m1 - 1, d1);
  const earlier = Date.UTC(y2, m2 - 1, d2);
  return Math.round((later - earlier) / 86400000);
}

function asNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function deriveTaskMetrics(input, options = {}) {
  const timeZone = options.timeZone || getProjectTimezone();
  const completion = options.completionStatuses || getCompletionStatuses();
  const now = options.now instanceof Date ? options.now : new Date();
  const today = calendarDate(now, timeZone);

  const status = input.status == null ? null : String(input.status);
  const isCompleted = status != null && completion.includes(status);
  const dueDate = parseIsoDate(input.dueDate);
  const storedCompleted = parseIsoDate(input.completedDate);
  const completeRemarkDate = parseIsoDate(input.completeRemarkDate);
  const actualCompletionDate = storedCompleted || completeRemarkDate || null;

  const isOverdue = Boolean(dueDate && today && dueDate < today && !isCompleted);

  let delayDays = 0;
  if (dueDate) {
    if (isCompleted) {
      const finishedOn = storedCompleted || actualCompletionDate;
      delayDays = finishedOn ? Math.max(0, daysBetween(finishedOn, dueDate)) : 0;
    } else if (today) {
      delayDays = Math.max(0, daysBetween(today, dueDate));
    }
  }

  const daysUntilDue = !isCompleted && dueDate && today ? daysBetween(dueDate, today) : null;

  const rawProgress = asNumber(input.progress);
  const progressPct = rawProgress == null
    ? 0
    : Math.max(0, Math.min(100, Math.round(rawProgress)));

  const estimated = asNumber(input.estimatedHours);
  const actual = asNumber(input.actualHours);
  const estimatedHours = estimated == null ? 0 : estimated;
  const actualHours = actual == null ? 0 : actual;
  const remainingHours = Math.max(0, estimatedHours - actualHours);

  return {
    is_completed: isCompleted,
    is_overdue: isOverdue,
    delay_days: delayDays,
    days_until_due: daysUntilDue,
    actual_completion_date: actualCompletionDate,
    progress_pct: progressPct,
    progress_raw_pct: rawProgress,
    estimated_hours: estimatedHours,
    actual_hours: actualHours,
    remaining_hours: remainingHours,
    today,
  };
}

module.exports = {
  DEFAULT_TIMEZONE,
  DEFAULT_COMPLETION,
  getProjectTimezone,
  getCompletionStatuses,
  calendarDate,
  parseIsoDate,
  daysBetween,
  deriveTaskMetrics,
};
