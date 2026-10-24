const { hasColumn } = require('../utils/schemaColumns');

/**
 * Reporting queries — SELECT only.
 * Any LIMIT below is INTERNAL_BATCH_ONLY (memory window for keyset streaming).
 * There is NO product-level row cap.
 */

async function loadFlags(database) {
  const [assignedDate, isDeleted] = await Promise.all([
    hasColumn('tasks', 'assigned_date', database),
    hasColumn('tasks', 'is_deleted', database),
  ]);
  return { assignedDate, isDeleted };
}

function projectWhere(projectScope, alias = 't') {
  if (projectScope.mode === 'all') {
    return { sql: '1=1', params: [] };
  }
  if (!projectScope.ids.length) {
    return { sql: '0=1', params: [] };
  }
  return {
    sql: `${alias}.project_id IN (${projectScope.ids.map(() => '?').join(',')})`,
    params: projectScope.ids.slice(), // ARRAY_COPY
  };
}

function buildTaskFilters(projectScope, filters, flags) {
  const parts = [];
  const params = [];
  const pw = projectWhere(projectScope, 't');
  parts.push(pw.sql);
  params.push(...pw.params);

  if (flags.isDeleted) {
    parts.push('COALESCE(t.is_deleted, 0) = 0');
  }
  if (filters.statuses && filters.statuses.length) {
    parts.push(`t.status IN (${filters.statuses.map(() => '?').join(',')})`);
    params.push(...filters.statuses);
  }
  if (filters.assigneeIds && filters.assigneeIds.length) {
    parts.push(`ta.assignee_id IN (${filters.assigneeIds.map(() => '?').join(',')}) AND ta.assignee_type = 'team'`);
    params.push(...filters.assigneeIds);
  }
  if (filters.grades && filters.grades.length) {
    parts.push(`g.name IN (${filters.grades.map(() => '?').join(',')})`);
    params.push(...filters.grades);
  }
  if (filters.fromDate) {
    parts.push('t.end_date >= ?');
    params.push(filters.fromDate);
  }
  if (filters.toDate) {
    parts.push('t.end_date <= ?');
    params.push(filters.toDate);
  }
  // subjects: NOT AVAILABLE — ignored deliberately
  return { where: parts.join(' AND '), params };
}

function taskSelectSql(flags) {
  const assignedDate = flags.assignedDate ? 't.assigned_date' : 'NULL AS assigned_date';
  return `
    SELECT
      t.id AS task_id,
      t.name AS task_name,
      t.description,
      t.project_id,
      p.name AS project_name,
      cs.name AS stage,
      t.status,
      t.priority,
      t.progress,
      t.estimated_hours,
      t.actual_hours,
      ta.assignee_id AS assignee_member_id,
      COALESCE(tm.name, au.name) AS assignee_name,
      COALESCE(tm.email, au.email) AS assignee_email,
      (
        SELECT te.name FROM team_members_teams tmt
        INNER JOIN teams te ON te.id = tmt.team_id
        WHERE tmt.team_member_id = tm.id AND COALESCE(tmt.is_active, 1) = 1
        ORDER BY tmt.id ASC
        LIMIT 1 /* SINGLE_ROW_LOOKUP */
      ) AS team_name,
      t.grade_id, t.book_id, t.unit_id, t.lesson_id,
      g.name AS grade_name, b.name AS book_name, u.name AS unit_name, l.name AS lesson_name,
      ${assignedDate},
      t.start_date,
      t.end_date AS due_date,
      (
        SELECT MAX(tr.remark_date) FROM task_remarks tr
        WHERE tr.task_id = t.id
          AND tr.remark_type = 'complete'
          AND COALESCE(tr.is_private, 0) = 0
      ) AS submission_date,
      t.created_at,
      t.updated_at,
      t.updated_at AS _cursorUpdatedAt,
      t.id AS _cursorId
    FROM tasks t
    INNER JOIN projects p ON p.id = t.project_id
    LEFT JOIN category_stages cs ON cs.id = t.category_stage_id
    LEFT JOIN grades g ON g.id = t.grade_id
    LEFT JOIN books b ON b.id = t.book_id
    LEFT JOIN units u ON u.id = t.unit_id
    LEFT JOIN lessons l ON l.id = t.lesson_id
    LEFT JOIN task_assignees ta ON ta.id = (
      SELECT ta2.id FROM task_assignees ta2
      WHERE ta2.task_id = t.id
      ORDER BY (ta2.assignee_type = 'team') DESC, ta2.id ASC
      LIMIT 1 /* SINGLE_ROW_LOOKUP */
    )
    LEFT JOIN team_members tm ON ta.assignee_type = 'team' AND tm.id = ta.assignee_id
    LEFT JOIN admin_users au ON ta.assignee_type = 'admin' AND au.id = ta.assignee_id
  `;
}

async function fetchTaskBatch(database, projectScope, filters, cursor, batchSize) {
  const flags = await loadFlags(database);
  const { where, params } = buildTaskFilters(projectScope, filters, flags);
  const cursorSql = cursor.id == null
    ? ''
    : ' AND (t.updated_at > ? OR (t.updated_at = ? AND t.id > ?))';
  const cursorParams = cursor.id == null
    ? []
    : [cursor.updatedAt, cursor.updatedAt, cursor.id];

  // INTERNAL_BATCH_ONLY — memory window for streaming; not a product row cap
  const sql = `
    ${taskSelectSql(flags)}
    WHERE ${where}${cursorSql}
    ORDER BY t.updated_at ASC, t.id ASC
    LIMIT ? /* INTERNAL_BATCH_ONLY */
  `;
  return database.query(sql, [...params, ...cursorParams, batchSize]);
}

async function fetchCommentBatch(database, projectScope, filters, cursor, batchSize) {
  const pw = projectWhere(projectScope, 't');
  const parts = [pw.sql, 'COALESCE(r.is_private, 0) = 0'];
  const params = [...pw.params];
  if (filters.assigneeIds && filters.assigneeIds.length) {
    parts.push(`EXISTS (
      SELECT 1 FROM task_assignees ta
      WHERE ta.task_id = t.id AND ta.assignee_type = 'team'
        AND ta.assignee_id IN (${filters.assigneeIds.map(() => '?').join(',')})
    )`);
    params.push(...filters.assigneeIds);
  }
  const cursorSql = cursor.id == null
    ? ''
    : ' AND (r.id > ?)';
  const cursorParams = cursor.id == null ? [] : [cursor.id];

  // INTERNAL_BATCH_ONLY
  const sql = `
    SELECT
      r.id AS remark_id,
      r.task_id,
      t.project_id,
      p.name AS project_name,
      r.remark_date,
      r.remark_type,
      r.added_by_type,
      r.added_by,
      COALESCE(tm.name, au.name) AS added_by_name,
      r.remark,
      r.is_private,
      r.file_name,
      r.id AS _cursorId,
      r.created_at AS _cursorUpdatedAt
    FROM task_remarks r
    INNER JOIN tasks t ON t.id = r.task_id
    INNER JOIN projects p ON p.id = t.project_id
    LEFT JOIN team_members tm ON r.added_by_type = 'team' AND tm.id = r.added_by
    LEFT JOIN admin_users au ON r.added_by_type = 'admin' AND au.id = r.added_by
    WHERE ${parts.join(' AND ')}${cursorSql}
    ORDER BY r.id ASC
    LIMIT ? /* INTERNAL_BATCH_ONLY */
  `;
  return database.query(sql, [...params, ...cursorParams, batchSize]);
}

async function fetchHistoryBatch(database, projectScope, filters, cursor, batchSize) {
  const exists = await database.query(
    `SELECT 1 AS ok FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'task_history_events' LIMIT 1 /* SINGLE_ROW_LOOKUP */`
  );
  if (!exists.length) return [];

  const pw = projectWhere(projectScope, 't');
  const cursorSql = cursor.id == null ? '' : ' AND (h.id > ?)';
  const cursorParams = cursor.id == null ? [] : [cursor.id];

  // INTERNAL_BATCH_ONLY
  const sql = `
    SELECT
      h.id AS event_id,
      h.task_id,
      t.project_id,
      h.action,
      h.field_name,
      h.old_value,
      h.new_value,
      h.changed_by_id,
      h.changed_by_name,
      h.changed_at,
      h.id AS _cursorId,
      h.changed_at AS _cursorUpdatedAt
    FROM task_history_events h
    INNER JOIN tasks t ON t.id = h.task_id
    WHERE ${pw.sql}${cursorSql}
    ORDER BY h.id ASC
    LIMIT ? /* INTERNAL_BATCH_ONLY */
  `;
  return database.query(sql, [...pw.params, ...cursorParams, batchSize]);
}

async function fetchAttachmentBatch(database, projectScope, cursor, batchSize) {
  const pw = projectWhere(projectScope, 't');
  const cursorSql = cursor.id == null ? '' : ' AND (r.id > ?)';
  const cursorParams = cursor.id == null ? [] : [cursor.id];

  // INTERNAL_BATCH_ONLY
  const sql = `
    SELECT
      r.task_id,
      t.project_id,
      r.file_name,
      r.id AS _cursorId,
      r.created_at AS _cursorUpdatedAt
    FROM task_remarks r
    INNER JOIN tasks t ON t.id = r.task_id
    WHERE ${pw.sql}
      AND r.file_name IS NOT NULL
      AND TRIM(r.file_name) <> ''
      ${cursorSql}
    ORDER BY r.id ASC
    LIMIT ? /* INTERNAL_BATCH_ONLY */
  `;
  return database.query(sql, [...pw.params, ...cursorParams, batchSize]);
}

async function listProjectsInScope(database, projectScope) {
  if (projectScope.mode === 'all') {
    return database.query('SELECT id AS projectId, name AS projectName, status, start_date AS startDate, end_date AS endDate FROM projects ORDER BY id ASC');
  }
  if (!projectScope.ids.length) return [];
  return database.query(
    `SELECT id AS projectId, name AS projectName, status, start_date AS startDate, end_date AS endDate
     FROM projects WHERE id IN (${projectScope.ids.map(() => '?').join(',')}) ORDER BY id ASC`,
    projectScope.ids
  );
}

async function listUsersInScope(database, projectScope) {
  const pw = projectWhere(projectScope, 't');
  return database.query(
    `SELECT DISTINCT tm.id AS userId, tm.name AS name, tm.email AS email, tm.role AS role, tm.is_active AS isActive
     FROM team_members tm
     INNER JOIN task_assignees ta ON ta.assignee_id = tm.id AND ta.assignee_type = 'team'
     INNER JOIN tasks t ON t.id = ta.task_id
     WHERE ${pw.sql}
     ORDER BY tm.id ASC`,
    pw.params
  );
}

async function listHierarchyInScope(database, projectScope) {
  // grades use project_id
  const gradeWhere = projectScope.mode === 'all'
    ? '1=1'
    : (projectScope.ids.length
      ? `g.project_id IN (${projectScope.ids.map(() => '?').join(',')})`
      : '0=1');
  const params = projectScope.mode === 'all' ? [] : projectScope.ids.slice(); // ARRAY_COPY

  const grades = await database.query(
    `SELECT g.id, g.project_id AS projectId, p.name AS projectName, g.name AS grade, g.order_index AS sortOrder
     FROM grades g INNER JOIN projects p ON p.id = g.project_id
     WHERE ${gradeWhere} ORDER BY g.project_id, g.order_index, g.id`,
    params
  );
  const books = await database.query(
    `SELECT b.id, g.project_id AS projectId, g.name AS grade, b.name AS book, b.type AS bookType, b.order_index AS sortOrder
     FROM books b INNER JOIN grades g ON g.id = b.grade_id
     WHERE ${gradeWhere} ORDER BY g.project_id, b.order_index, b.id`,
    params
  );
  const units = await database.query(
    `SELECT u.id, g.project_id AS projectId, g.name AS grade, b.name AS book, u.name AS unit, u.order_index AS sortOrder
     FROM units u
     INNER JOIN books b ON b.id = u.book_id
     INNER JOIN grades g ON g.id = b.grade_id
     WHERE ${gradeWhere} ORDER BY g.project_id, u.order_index, u.id`,
    params
  );
  const lessons = await database.query(
    `SELECT l.id, g.project_id AS projectId, g.name AS grade, b.name AS book, u.name AS unit, l.name AS lesson, l.order_index AS sortOrder
     FROM lessons l
     INNER JOIN units u ON u.id = l.unit_id
     INNER JOIN books b ON b.id = u.book_id
     INNER JOIN grades g ON g.id = b.grade_id
     WHERE ${gradeWhere} ORDER BY g.project_id, l.order_index, l.id`,
    params
  );
  return { grades, books, units, lessons };
}

async function metadataStatuses() {
  const { STATUS_VALUES } = require('./fields');
  return STATUS_VALUES.slice(); // ARRAY_COPY
}

async function metadataPriorities() {
  const { PRIORITY_VALUES } = require('./fields');
  return PRIORITY_VALUES.slice(); // ARRAY_COPY
}

async function metadataStages(database, projectScope) {
  // Stages are global catalog; filter by usage in scoped projects when possible
  const pw = projectWhere(projectScope, 't');
  return database.query(
    `SELECT DISTINCT cs.id AS stageId, cs.name AS stageName, cs.order_index AS stageOrder
     FROM category_stages cs
     INNER JOIN tasks t ON t.category_stage_id = cs.id
     WHERE ${pw.sql}
     ORDER BY cs.order_index, cs.id`,
    pw.params
  );
}

async function metadataGrades(database, projectScope) {
  const gradeWhere = projectScope.mode === 'all'
    ? '1=1'
    : (projectScope.ids.length
      ? `project_id IN (${projectScope.ids.map(() => '?').join(',')})`
      : '0=1');
  const params = projectScope.mode === 'all' ? [] : projectScope.ids.slice(); // ARRAY_COPY
  return database.query(
    `SELECT DISTINCT name AS grade FROM grades WHERE ${gradeWhere} ORDER BY name`,
    params
  );
}

module.exports = {
  loadFlags,
  projectWhere,
  fetchTaskBatch,
  fetchCommentBatch,
  fetchHistoryBatch,
  fetchAttachmentBatch,
  listProjectsInScope,
  listUsersInScope,
  listHierarchyInScope,
  metadataStatuses,
  metadataPriorities,
  metadataStages,
  metadataGrades,
};
