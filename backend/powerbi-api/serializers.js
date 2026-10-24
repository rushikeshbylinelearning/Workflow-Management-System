const { deriveTaskMetrics } = require('./derived');
const { htmlToText, remarkListCounts } = require('./htmlText');
const { emptyToNull } = require('./validate');
const { getProjectTimezone } = require('./derived');

function text(value) {
  const cleaned = emptyToNull(value);
  return cleaned == null ? null : String(cleaned);
}

function lowerEmail(value) {
  const cleaned = text(value);
  return cleaned == null ? null : cleaned.toLowerCase();
}

function integerOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function numberOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function bool(value) {
  return value === true || value === 1 || value === '1';
}

function isoDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: getProjectTimezone(),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(value);
  }
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function isoTimestamp(value) {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function personId(id) {
  if (id == null || id === '') return null;
  return `u_${Number(id)}`;
}

function priorityValue(value) {
  if (value == null || value === '') return null;
  if (value === 'urgent') return 'critical';
  return String(value);
}

function hierarchyPath(row) {
  const parts = [row.grade_name, row.book_name, row.unit_name, row.lesson_name]
    .map(text)
    .filter(Boolean);
  return parts.length ? parts.join(' > ') : null;
}

function hierarchyNodeId(row) {
  if (row.lesson_id) return `l_${row.lesson_id}`;
  if (row.unit_id) return `u_${row.unit_id}`;
  if (row.book_id) return `b_${row.book_id}`;
  if (row.grade_id) return `g_${row.grade_id}`;
  return null;
}

function serializeTask(row, options = {}) {
  const metrics = deriveTaskMetrics({
    status: row.status,
    dueDate: row.due_date,
    completedDate: row.completed_date,
    completeRemarkDate: row.complete_remark_date,
    progress: row.progress,
    estimatedHours: row.estimated_hours,
    actualHours: row.logged_hours != null && (row.actual_hours == null || Number(row.actual_hours) === 0)
      ? row.logged_hours
      : row.actual_hours,
  }, options);

  const record = {
    task_id: integerOrNull(row.task_id),
    task_name: text(row.task_name),
    description: text(row.description),
    project_id: integerOrNull(row.project_id),
    project_name: text(row.project_name),
    stage: text(row.stage),
    status: text(row.status),
    priority: priorityValue(row.priority),
    progress_pct: metrics.progress_pct,
    progress_raw_pct: metrics.progress_raw_pct,
    assignee_id: personId(row.assignee_member_id),
    assignee_name: text(row.assignee_name),
    assignee_email: lowerEmail(row.assignee_email),
    assigned_by_id: row.assigned_by_member_id == null ? null : personId(row.assigned_by_member_id),
    assigned_by_name: text(row.assigned_by_name),
    hierarchy_node_id: hierarchyNodeId(row),
    hierarchy_path: hierarchyPath(row),
    grade: text(row.grade_name),
    book: text(row.book_name),
    unit: text(row.unit_name),
    lesson: text(row.lesson_name),
    artefact_code: null,
    assigned_date: isoDate(row.assigned_date),
    start_date: isoDate(row.start_date),
    due_date: isoDate(row.due_date),
    completed_date: isoDate(row.completed_date),
    actual_completion_date: metrics.actual_completion_date,
    is_completed: metrics.is_completed,
    is_overdue: metrics.is_overdue,
    delay_days: metrics.delay_days,
    days_until_due: metrics.days_until_due,
    extension_requested_date: isoTimestamp(row.extension_requested_at),
    extension_reason: text(row.extension_reason),
    extension_status: text(row.extension_status) || 'none',
    estimated_hours: metrics.estimated_hours,
    actual_hours: metrics.actual_hours,
    remaining_hours: metrics.remaining_hours,
    remark_count: integerOrNull(row.remark_count) || 0,
    last_remark_date: isoDate(row.last_remark_date),
    server_location: text(row.server_location),
    created_at: isoTimestamp(row.created_at),
    updated_at: isoTimestamp(row.updated_at),
    is_deleted: bool(row.is_deleted),
  };
  return record;
}

function serializeRemark(row) {
  const plain = htmlToText(row.remark);
  const counts = remarkListCounts(plain);
  return {
    remark_id: integerOrNull(row.remark_id),
    task_id: integerOrNull(row.task_id),
    remark_date: isoDate(row.remark_date),
    remark_type: text(row.remark_type),
    author_role: row.added_by_type === 'admin' ? 'admin' : 'assignee',
    added_by_id: personId(row.added_by),
    added_by_name: text(row.added_by_name),
    remark_text: plain,
    remark_html: text(row.remark),
    is_private: bool(row.is_private),
    completed_items_count: counts.completed_items_count,
    pending_items_count: counts.pending_items_count,
    file_name: text(row.file_name),
    server_location: text(row.server_location),
    created_at: isoTimestamp(row.created_at),
  };
}

function serializeAssignee(row) {
  return {
    assignee_id: personId(row.member_id),
    assignee_name: text(row.assignee_name),
    assignee_email: lowerEmail(row.assignee_email),
    role: text(row.role),
    team: text(row.team),
    weekly_capacity_hours: null,
    is_active: bool(row.is_active),
  };
}

function serializeHierarchy(row) {
  return {
    node_id: text(row.node_id),
    tag_level: text(row.tag_level),
    parent_node_id: text(row.parent_node_id),
    hierarchy_path: text(row.hierarchy_path),
    grade: text(row.grade),
    grade_description: text(row.grade_description),
    grade_weight: numberOrNull(row.grade_weight),
    book: text(row.book),
    book_type: text(row.book_type),
    book_description: text(row.book_description),
    book_weight: numberOrNull(row.book_weight),
    unit: text(row.unit),
    unit_description: text(row.unit_description),
    unit_weight: numberOrNull(row.unit_weight),
    lesson: text(row.lesson),
    lesson_description: text(row.lesson_description),
    lesson_weight: numberOrNull(row.lesson_weight),
    sort_order: integerOrNull(row.sort_order),
    is_active: row.is_active == null ? true : bool(row.is_active),
    updated_at: isoTimestamp(row.updated_at),
  };
}

function serializeHistory(row) {
  return {
    event_id: integerOrNull(row.event_id),
    task_id: integerOrNull(row.task_id),
    action: text(row.action),
    field_name: text(row.field_name),
    old_value: text(row.old_value),
    new_value: text(row.new_value),
    changed_by_id: row.changed_by_id == null ? null : personId(row.changed_by_id),
    changed_by_name: text(row.changed_by_name),
    changed_at: isoTimestamp(row.changed_at),
    details: text(row.details),
  };
}

function serializeStage(row) {
  return {
    stage_id: integerOrNull(row.stage_id),
    stage_name: text(row.stage_name),
    stage_order: integerOrNull(row.stage_order) || 0,
    is_active: row.is_active == null ? true : bool(row.is_active),
  };
}

function projectRow(row, columns) {
  const out = {};
  for (const column of columns) {
    if (Object.prototype.hasOwnProperty.call(row, column)) out[column] = row[column];
  }
  return out;
}

module.exports = {
  serializeTask,
  serializeRemark,
  serializeAssignee,
  serializeHierarchy,
  serializeHistory,
  serializeStage,
  projectRow,
  isoTimestamp,
};
