/**
 * Single source of truth for Reporting API fields (Spec v2.0).
 * Validation, column selection, metadata, and M-query generators read from here.
 */

const FIELD_GROUPS = Object.freeze([
  'core',
  'hierarchy',
  'dates',
  'derived',
  'effort',
  'org',
  'assignee',
  'comments',
  'history',
  'attachments',
]);

/** Groups granted to new keys by default (sensitive groups omitted). */
const DEFAULT_FIELD_GROUPS = Object.freeze([
  'core',
  'hierarchy',
  'dates',
  'derived',
  'effort',
  'org',
  'assignee',
]);

const SENSITIVE_GROUPS = Object.freeze(['comments', 'history', 'attachments']);

/**
 * @typedef {object} FieldDef
 * @property {string} fieldName
 * @property {string} displayName
 * @property {string} dataType
 * @property {string} group
 * @property {boolean} sensitive
 * @property {boolean} [default]
 * @property {boolean} [available]
 * @property {string} [source]
 */

/** @type {FieldDef[]} */
const TASK_FIELDS = [
  { fieldName: 'projectId', displayName: 'Project ID', dataType: 'integer', group: 'core', sensitive: false, default: true, source: 'tasks.project_id' },
  { fieldName: 'projectName', displayName: 'Project Name', dataType: 'string', group: 'core', sensitive: false, default: true, source: 'projects.name' },
  { fieldName: 'taskId', displayName: 'Task ID', dataType: 'integer', group: 'core', sensitive: false, default: true, source: 'tasks.id' },
  { fieldName: 'taskName', displayName: 'Task Name', dataType: 'string', group: 'core', sensitive: false, default: true, source: 'tasks.name' },
  { fieldName: 'description', displayName: 'Description', dataType: 'string', group: 'core', sensitive: false, default: false, source: 'tasks.description' },
  { fieldName: 'status', displayName: 'Task Status', dataType: 'string', group: 'core', sensitive: false, default: true, source: 'tasks.status' },
  { fieldName: 'stage', displayName: 'Workflow Stage', dataType: 'string', group: 'core', sensitive: false, default: true, source: 'category_stages.name' },
  { fieldName: 'priority', displayName: 'Priority', dataType: 'string', group: 'core', sensitive: false, default: true, source: 'tasks.priority' },
  { fieldName: 'assigneeId', displayName: 'Assignee ID', dataType: 'integer', group: 'assignee', sensitive: false, default: true, source: 'task_assignees.assignee_id' },
  { fieldName: 'assignee', displayName: 'Assignee Name', dataType: 'string', group: 'assignee', sensitive: false, default: true, source: 'team_members.name' },
  { fieldName: 'assigneeEmail', displayName: 'Assignee Email', dataType: 'string', group: 'assignee', sensitive: true, default: false, source: 'team_members.email' },
  { fieldName: 'team', displayName: 'Team', dataType: 'string', group: 'org', sensitive: false, default: false, source: 'teams.name' },
  { fieldName: 'grade', displayName: 'Grade', dataType: 'string', group: 'hierarchy', sensitive: false, default: true, source: 'grades.name' },
  { fieldName: 'book', displayName: 'Book', dataType: 'string', group: 'hierarchy', sensitive: false, default: true, source: 'books.name' },
  { fieldName: 'unit', displayName: 'Unit', dataType: 'string', group: 'hierarchy', sensitive: false, default: true, source: 'units.name' },
  { fieldName: 'lesson', displayName: 'Lesson', dataType: 'string', group: 'hierarchy', sensitive: false, default: true, source: 'lessons.name' },
  { fieldName: 'hierarchyPath', displayName: 'Hierarchy Path', dataType: 'string', group: 'hierarchy', sensitive: false, default: true, source: 'derived' },
  { fieldName: 'startDate', displayName: 'Start Date', dataType: 'date', group: 'dates', sensitive: false, default: true, source: 'tasks.start_date' },
  { fieldName: 'dueDate', displayName: 'Due Date', dataType: 'date', group: 'dates', sensitive: false, default: true, source: 'tasks.end_date' },
  { fieldName: 'assignedDate', displayName: 'Assigned Date', dataType: 'date', group: 'dates', sensitive: false, default: false, source: 'tasks.assigned_date' },
  { fieldName: 'actualCompletionDate', displayName: 'Actual Completion Date', dataType: 'date', group: 'dates', sensitive: false, default: true, source: 'task_remarks.remark_date (complete)' },
  { fieldName: 'delayDays', displayName: 'Delay Days', dataType: 'integer', group: 'derived', sensitive: false, default: true, source: 'derived IST' },
  { fieldName: 'overdueFlag', displayName: 'Overdue Flag', dataType: 'boolean', group: 'derived', sensitive: false, default: true, source: 'derived IST' },
  { fieldName: 'completionPercent', displayName: 'Completion Percent', dataType: 'integer', group: 'derived', sensitive: false, default: true, source: 'tasks.progress / completed rules' },
  { fieldName: 'estimatedHours', displayName: 'Estimated Hours', dataType: 'number', group: 'effort', sensitive: false, default: false, source: 'tasks.estimated_hours' },
  { fieldName: 'actualHours', displayName: 'Actual Hours', dataType: 'number', group: 'effort', sensitive: false, default: false, source: 'tasks.actual_hours' },
  { fieldName: 'createdAt', displayName: 'Created At', dataType: 'datetime', group: 'dates', sensitive: false, default: false, source: 'tasks.created_at' },
  { fieldName: 'updatedAt', displayName: 'Updated At', dataType: 'datetime', group: 'dates', sensitive: false, default: false, source: 'tasks.updated_at' },
];

const COMMENT_FIELDS = [
  { fieldName: 'remarkId', displayName: 'Remark ID', dataType: 'integer', group: 'comments', sensitive: true, default: true, source: 'task_remarks.id' },
  { fieldName: 'taskId', displayName: 'Task ID', dataType: 'integer', group: 'comments', sensitive: true, default: true, source: 'task_remarks.task_id' },
  { fieldName: 'projectId', displayName: 'Project ID', dataType: 'integer', group: 'comments', sensitive: true, default: true, source: 'tasks.project_id' },
  { fieldName: 'projectName', displayName: 'Project Name', dataType: 'string', group: 'comments', sensitive: true, default: true, source: 'projects.name' },
  { fieldName: 'remarkDate', displayName: 'Remark Date', dataType: 'date', group: 'comments', sensitive: true, default: true, source: 'task_remarks.remark_date' },
  { fieldName: 'remarkType', displayName: 'Remark Type', dataType: 'string', group: 'comments', sensitive: true, default: true, source: 'task_remarks.remark_type' },
  { fieldName: 'authorRole', displayName: 'Author Role', dataType: 'string', group: 'comments', sensitive: true, default: true, source: 'task_remarks.added_by_type' },
  { fieldName: 'addedById', displayName: 'Added By ID', dataType: 'integer', group: 'comments', sensitive: true, default: true, source: 'task_remarks.added_by' },
  { fieldName: 'addedByName', displayName: 'Added By Name', dataType: 'string', group: 'comments', sensitive: true, default: true, source: 'team_members/admin_users.name' },
  { fieldName: 'remarkText', displayName: 'Remark Text', dataType: 'string', group: 'comments', sensitive: true, default: true, source: 'task_remarks.remark' },
  { fieldName: 'isPrivate', displayName: 'Private Remark', dataType: 'boolean', group: 'comments', sensitive: true, default: true, source: 'task_remarks.is_private' },
  { fieldName: 'fileName', displayName: 'File Name', dataType: 'string', group: 'attachments', sensitive: true, default: false, source: 'task_remarks.file_name' },
];

const HISTORY_FIELDS = [
  { fieldName: 'eventId', displayName: 'Event ID', dataType: 'integer', group: 'history', sensitive: true, default: true, source: 'task_history_events.id' },
  { fieldName: 'taskId', displayName: 'Task ID', dataType: 'integer', group: 'history', sensitive: true, default: true, source: 'task_history_events.task_id' },
  { fieldName: 'projectId', displayName: 'Project ID', dataType: 'integer', group: 'history', sensitive: true, default: true, source: 'tasks.project_id' },
  { fieldName: 'action', displayName: 'Action', dataType: 'string', group: 'history', sensitive: true, default: true, source: 'task_history_events.action' },
  { fieldName: 'fieldName', displayName: 'Field Name', dataType: 'string', group: 'history', sensitive: true, default: true, source: 'task_history_events.field_name' },
  { fieldName: 'oldValue', displayName: 'Old Value', dataType: 'string', group: 'history', sensitive: true, default: true, source: 'task_history_events.old_value' },
  { fieldName: 'newValue', displayName: 'New Value', dataType: 'string', group: 'history', sensitive: true, default: true, source: 'task_history_events.new_value' },
  { fieldName: 'changedById', displayName: 'Changed By ID', dataType: 'integer', group: 'history', sensitive: true, default: true, source: 'task_history_events.changed_by_id' },
  { fieldName: 'changedByName', displayName: 'Changed By Name', dataType: 'string', group: 'history', sensitive: true, default: true, source: 'task_history_events.changed_by_name' },
  { fieldName: 'changedAt', displayName: 'Changed At', dataType: 'datetime', group: 'history', sensitive: true, default: true, source: 'task_history_events.changed_at' },
];

const ATTACHMENT_FIELDS = [
  { fieldName: 'taskId', displayName: 'Task ID', dataType: 'integer', group: 'attachments', sensitive: true, default: true, source: 'task_remarks.task_id' },
  { fieldName: 'projectId', displayName: 'Project ID', dataType: 'integer', group: 'attachments', sensitive: true, default: true, source: 'tasks.project_id' },
  { fieldName: 'fileName', displayName: 'File Name', dataType: 'string', group: 'attachments', sensitive: true, default: true, source: 'task_remarks.file_name' },
  { fieldName: 'hasFile', displayName: 'Has File', dataType: 'boolean', group: 'attachments', sensitive: true, default: true, source: 'derived' },
];

const STATUS_VALUES = [
  'not-started', 'in-progress', 'under-review', 'completed', 'on-hold', 'returned',
  'blocked', 'skipped', 'redo-requested', 'resubmitted',
];

const PRIORITY_VALUES = ['low', 'medium', 'high', 'urgent'];

function registryFor(resource) {
  if (resource === 'tasks') return TASK_FIELDS;
  if (resource === 'comments') return COMMENT_FIELDS;
  if (resource === 'history') return HISTORY_FIELDS;
  if (resource === 'attachments') return ATTACHMENT_FIELDS;
  return [];
}

function fieldMap(resource) {
  const map = new Map();
  for (const field of registryFor(resource)) map.set(field.fieldName, field);
  return map;
}

function defaultFieldNames(resource) {
  return registryFor(resource).filter((f) => f.default !== false && f.available !== false).map((f) => f.fieldName);
}

function metadataFields() {
  return TASK_FIELDS.filter((f) => f.available !== false).map((f) => ({
    fieldName: f.fieldName,
    displayName: f.displayName,
    dataType: f.dataType,
    group: f.group,
    sensitive: !!f.sensitive,
    default: f.default !== false,
    source: f.source || null,
  }));
}

function projectIdAlwaysAllowed(fields) {
  const set = new Set(fields);
  set.add('projectId');
  set.add('projectName');
  return [...set];
}

module.exports = {
  FIELD_GROUPS,
  DEFAULT_FIELD_GROUPS,
  SENSITIVE_GROUPS,
  TASK_FIELDS,
  COMMENT_FIELDS,
  HISTORY_FIELDS,
  ATTACHMENT_FIELDS,
  STATUS_VALUES,
  PRIORITY_VALUES,
  registryFor,
  fieldMap,
  defaultFieldNames,
  metadataFields,
  projectIdAlwaysAllowed,
};
