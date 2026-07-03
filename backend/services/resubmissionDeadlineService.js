const MIN_MS = 30 * 60 * 1000;
const MAX_MS = 90 * 24 * 60 * 60 * 1000;

function isEnabled() {
  return process.env.ENABLE_RESUBMISSION_DEADLINE === 'true';
}

function toMysqlDatetime(date) {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Validate client-provided ISO/local datetime. Uses server clock only.
 */
function validateDeadline(input) {
  if (!isEnabled()) {
    return { valid: true, deadline: null, mysqlDatetime: null };
  }

  if (input == null || String(input).trim() === '') {
    return { valid: false, code: 'REQUIRED', message: 'Please select a resubmission deadline' };
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return { valid: false, code: 'INVALID', message: 'This deadline must be in the future' };
  }

  const now = Date.now();
  const target = parsed.getTime();

  if (target <= now + MIN_MS) {
    return { valid: false, code: 'PAST', message: 'This deadline must be in the future' };
  }

  if (target > now + MAX_MS) {
    return { valid: false, code: 'MAX', message: 'Deadline cannot be more than 90 days from now' };
  }

  return {
    valid: true,
    deadline: parsed,
    mysqlDatetime: toMysqlDatetime(parsed),
  };
}

function formatDisplayLabel(mysqlOrIso) {
  if (!mysqlOrIso) return '';
  const d = new Date(mysqlOrIso);
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const time = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${day}/${month}/${year} • ${time}`;
}

function formatRemainingTime(mysqlOrIso) {
  if (!mysqlOrIso) return { text: '', overdue: false };
  const target = new Date(mysqlOrIso).getTime();
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

function buildTimelineRemark(baseRemark, mysqlDatetime) {
  const trimmed = (baseRemark || '').trim();
  const dueLine = formatDisplayLabel(mysqlDatetime);
  const blocks = [
    trimmed || 'Complete corrections and resubmit.',
    dueLine ? `Resubmit by: ${dueLine}` : '',
  ].filter(Boolean);
  return blocks.join('\n\n');
}

function attachResubmissionFields(task) {
  if (!task) return task;
  const raw = task.resubmission_deadline;
  if (!raw) {
    return {
      ...task,
      resubmissionDeadline: null,
      remainingTime: null,
      resubmissionOverdue: false,
    };
  }
  const remaining = formatRemainingTime(raw);
  return {
    ...task,
    resubmission_deadline: raw,
    resubmissionDeadline: raw,
    resubmission_set_by: task.resubmission_set_by ?? null,
    resubmission_set_at: task.resubmission_set_at ?? null,
    remainingTime: remaining.text,
    resubmissionOverdue: remaining.overdue,
  };
}

function attachResubmissionFieldsBatch(tasks) {
  if (!tasks?.length) return tasks;
  return tasks.map(attachResubmissionFields);
}

module.exports = {
  isEnabled,
  validateDeadline,
  toMysqlDatetime,
  formatDisplayLabel,
  formatRemainingTime,
  buildTimelineRemark,
  attachResubmissionFields,
  attachResubmissionFieldsBatch,
};
