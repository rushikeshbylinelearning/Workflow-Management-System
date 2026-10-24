const TASK_FIELDS = [
  'task_id', 'task_name', 'description', 'project_id', 'project_name', 'stage', 'status',
  'priority', 'progress_pct', 'progress_raw_pct', 'assignee_id', 'assignee_name', 'assignee_email',
  'assigned_by_id', 'assigned_by_name', 'hierarchy_node_id', 'hierarchy_path', 'grade', 'book',
  'unit', 'lesson', 'artefact_code', 'assigned_date', 'start_date', 'due_date', 'completed_date',
  'actual_completion_date', 'is_completed', 'is_overdue', 'delay_days', 'days_until_due',
  'extension_requested_date', 'extension_reason', 'extension_status', 'estimated_hours',
  'actual_hours', 'remaining_hours', 'remark_count', 'last_remark_date', 'server_location',
  'created_at', 'updated_at', 'is_deleted',
];

const REMARK_FIELDS = [
  'remark_id', 'task_id', 'remark_date', 'remark_type', 'author_role', 'added_by_id',
  'added_by_name', 'remark_text', 'remark_html', 'is_private', 'completed_items_count',
  'pending_items_count', 'file_name', 'server_location', 'created_at',
];

const ASSIGNEE_FIELDS = [
  'assignee_id', 'assignee_name', 'assignee_email', 'role', 'team', 'weekly_capacity_hours', 'is_active',
];

const HIERARCHY_FIELDS = [
  'node_id', 'tag_level', 'parent_node_id', 'hierarchy_path', 'grade', 'grade_description',
  'grade_weight', 'book', 'book_type', 'book_description', 'book_weight', 'unit',
  'unit_description', 'unit_weight', 'lesson', 'lesson_description', 'lesson_weight',
  'sort_order', 'is_active', 'updated_at',
];

const HISTORY_FIELDS = [
  'event_id', 'task_id', 'action', 'field_name', 'old_value', 'new_value',
  'changed_by_id', 'changed_by_name', 'changed_at', 'details',
];

const STAGE_FIELDS = ['stage_id', 'stage_name', 'stage_order', 'is_active'];

const GATED_FIELDS = new Set(['server_location', 'file_name']);
const OPT_IN_FIELDS = new Set(['remark_html']);

const STATUS_VALUES = [
  'not-started', 'in-progress', 'under-review', 'completed', 'on-hold', 'returned', 'blocked',
  'skipped', 'redo-requested', 'resubmitted',
];

const PRIORITY_VALUES = ['low', 'medium', 'high', 'critical'];
const TAG_LEVELS = ['grade', 'book', 'unit', 'lesson'];

function knownFields(resource) {
  if (resource === 'tasks') return TASK_FIELDS;
  if (resource === 'remarks') return REMARK_FIELDS;
  if (resource === 'assignees') return ASSIGNEE_FIELDS;
  if (resource === 'hierarchy') return HIERARCHY_FIELDS;
  if (resource === 'history') return HISTORY_FIELDS;
  if (resource === 'stages') return STAGE_FIELDS;
  return [];
}

function outputColumns(resource, exposeFilePaths, requested) {
  const gatedOff = !exposeFilePaths;
  const base = knownFields(resource).filter((field) => {
    if (gatedOff && GATED_FIELDS.has(field)) return false;
    if (OPT_IN_FIELDS.has(field) && !(requested && requested.includes(field))) return false;
    return true;
  });
  if (!requested) return base;
  return requested.filter((field) => base.includes(field) || (!gatedOff && GATED_FIELDS.has(field)));
}

module.exports = {
  TASK_FIELDS,
  REMARK_FIELDS,
  ASSIGNEE_FIELDS,
  HIERARCHY_FIELDS,
  HISTORY_FIELDS,
  STAGE_FIELDS,
  GATED_FIELDS,
  STATUS_VALUES,
  PRIORITY_VALUES,
  TAG_LEVELS,
  knownFields,
  outputColumns,
};
