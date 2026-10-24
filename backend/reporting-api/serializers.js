const { deriveTaskMetrics, parseIsoDate } = require('./reportingRules');
const { sanitizeString } = require('./sanitize');

function text(value) {
  if (value == null || value === '') return null;
  return sanitizeString(String(value));
}

function intOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function numOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function bool(value) {
  return value === true || value === 1 || value === '1';
}

function isoDate(value) {
  return parseIsoDate(value);
}

function isoTimestamp(value) {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  // Emit with +05:30 for Spec IST preference when wall time is IST session
  const offsetMs = 5.5 * 60 * 60 * 1000;
  const ist = new Date(date.getTime() + offsetMs);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ist.getUTCDate()).padStart(2, '0');
  const hh = String(ist.getUTCHours()).padStart(2, '0');
  const mm = String(ist.getUTCMinutes()).padStart(2, '0');
  const ss = String(ist.getUTCSeconds()).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}+05:30`;
}

function hierarchyPath(row) {
  const parts = [row.grade_name, row.book_name, row.unit_name, row.lesson_name]
    .map((v) => (v == null || v === '' ? null : String(v)))
    .filter(Boolean);
  return parts.length ? parts.join(' > ') : null;
}

function stripHtml(html) {
  if (html == null) return null;
  return sanitizeString(String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()) || null;
}

function pick(fields, record) {
  const out = {};
  for (const name of fields) {
    if (Object.prototype.hasOwnProperty.call(record, name)) {
      out[name] = record[name];
    }
  }
  return out;
}

function serializeTask(row, fields, options = {}) {
  const metrics = deriveTaskMetrics({
    status: row.status,
    dueDate: row.due_date,
    submissionDate: row.submission_date,
    progress: row.progress,
  }, options);

  const full = {
    projectId: intOrNull(row.project_id),
    projectName: text(row.project_name),
    taskId: intOrNull(row.task_id),
    taskName: text(row.task_name),
    description: text(row.description),
    status: text(row.status),
    stage: text(row.stage),
    priority: text(row.priority),
    assigneeId: intOrNull(row.assignee_member_id),
    assignee: text(row.assignee_name),
    assigneeEmail: text(row.assignee_email ? String(row.assignee_email).toLowerCase() : null),
    team: text(row.team_name),
    grade: text(row.grade_name),
    book: text(row.book_name),
    unit: text(row.unit_name),
    lesson: text(row.lesson_name),
    hierarchyPath: hierarchyPath(row),
    startDate: isoDate(row.start_date),
    dueDate: isoDate(row.due_date),
    assignedDate: isoDate(row.assigned_date),
    actualCompletionDate: metrics.actualCompletionDate,
    delayDays: metrics.delayDays,
    overdueFlag: metrics.overdueFlag,
    completionPercent: metrics.completionPercent,
    estimatedHours: numOrNull(row.estimated_hours),
    actualHours: numOrNull(row.actual_hours),
    createdAt: isoTimestamp(row.created_at),
    updatedAt: isoTimestamp(row.updated_at),
  };
  return pick(fields, full);
}

function serializeComment(row, fields) {
  const full = {
    remarkId: intOrNull(row.remark_id),
    taskId: intOrNull(row.task_id),
    projectId: intOrNull(row.project_id),
    projectName: text(row.project_name),
    remarkDate: isoDate(row.remark_date),
    remarkType: text(row.remark_type),
    authorRole: row.added_by_type === 'admin' ? 'admin' : 'assignee',
    addedById: intOrNull(row.added_by),
    addedByName: text(row.added_by_name),
    remarkText: stripHtml(row.remark),
    isPrivate: bool(row.is_private),
    fileName: text(row.file_name),
  };
  return pick(fields, full);
}

function serializeHistory(row, fields) {
  const full = {
    eventId: intOrNull(row.event_id),
    taskId: intOrNull(row.task_id),
    projectId: intOrNull(row.project_id),
    action: text(row.action),
    fieldName: text(row.field_name),
    oldValue: text(row.old_value),
    newValue: text(row.new_value),
    changedById: intOrNull(row.changed_by_id),
    changedByName: text(row.changed_by_name),
    changedAt: isoTimestamp(row.changed_at),
  };
  return pick(fields, full);
}

function serializeAttachment(row, fields) {
  const full = {
    taskId: intOrNull(row.task_id),
    projectId: intOrNull(row.project_id),
    fileName: text(row.file_name),
    hasFile: Boolean(row.file_name),
  };
  return pick(fields, full);
}

module.exports = {
  serializeTask,
  serializeComment,
  serializeHistory,
  serializeAttachment,
  stripHtml,
  text,
  isoDate,
  isoTimestamp,
};
