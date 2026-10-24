/**
 * Centralised business rules for the Reporting API (Spec v2.0).
 * All calendar math uses IST (Asia/Kolkata / UTC+05:30).
 */

const IST_TIMEZONE = 'Asia/Kolkata';

/** Statuses that count as completed for delay / overdue / completionPercent. */
const COMPLETED_STATUSES = Object.freeze(['completed', 'under-review']);

function getCompletedStatuses() {
  return COMPLETED_STATUSES.slice(); // ARRAY_COPY
}

function isCompletedStatus(status) {
  if (status == null) return false;
  return COMPLETED_STATUSES.includes(String(status));
}

function calendarDateIST(instant) {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function parseIsoDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return calendarDateIST(value);
  }
  const match = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})/);
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

function formatIstIsoNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}+05:30`;
}

/**
 * actualCompletionDate = assignee submission timestamp only
 * (complete-remark date). Never use reviewer/manager approval.
 */
function deriveTaskMetrics(input, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const today = calendarDateIST(now);
  const status = input.status == null ? null : String(input.status);
  const completed = isCompletedStatus(status);
  const dueDate = parseIsoDate(input.dueDate);
  // Submission only — ignore tasks.completed_date
  const actualCompletionDate = parseIsoDate(input.submissionDate);

  let delayDays = 0;
  if (dueDate) {
    if (completed) {
      if (actualCompletionDate) {
        delayDays = Math.max(0, daysBetween(actualCompletionDate, dueDate));
      }
    } else if (today && today > dueDate) {
      delayDays = Math.max(0, daysBetween(today, dueDate));
    }
  }

  const overdueFlag = Boolean(dueDate && today && today > dueDate && !completed);

  let completionPercent = 0;
  if (completed) {
    completionPercent = 100;
  } else {
    const raw = input.progress == null || input.progress === '' ? null : Number(input.progress);
    if (Number.isFinite(raw)) {
      completionPercent = Math.max(0, Math.min(100, Math.round(raw)));
    }
  }

  return {
    actualCompletionDate,
    delayDays,
    overdueFlag,
    completionPercent,
    today,
    isCompleted: completed,
  };
}

module.exports = {
  IST_TIMEZONE,
  COMPLETED_STATUSES,
  getCompletedStatuses,
  isCompletedStatus,
  calendarDateIST,
  parseIsoDate,
  daysBetween,
  formatIstIsoNow,
  deriveTaskMetrics,
};
