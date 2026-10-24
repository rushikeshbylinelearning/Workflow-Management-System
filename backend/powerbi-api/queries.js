const { hasColumn } = require('../utils/schemaColumns');

const REMARK_AGG = `
  LEFT JOIN (
    SELECT task_id,
           SUM(CASE WHEN COALESCE(is_private, 0) = 0 THEN 1 ELSE 0 END) AS remark_count,
           MAX(CASE WHEN COALESCE(is_private, 0) = 0 THEN remark_date END) AS last_remark_date,
           MAX(CASE WHEN COALESCE(is_private, 0) = 0 AND remark_type = 'complete' THEN remark_date END) AS complete_remark_date
    FROM task_remarks
    WHERE task_id IN (SELECT id FROM tasks WHERE project_id = ?)
    GROUP BY task_id
  ) rr ON rr.task_id = t.id
`;

const TIME_AGG = `
  LEFT JOIN (
    SELECT task_id, ROUND(SUM(duration_seconds) / 3600, 2) AS logged_hours
    FROM task_time_logs
    WHERE status = 'completed'
      AND task_id IN (SELECT id FROM tasks WHERE project_id = ?)
    GROUP BY task_id
  ) tl ON tl.task_id = t.id
`;

function taskFrom(flags) {
  const deleted = flags.isDeleted ? 't.is_deleted' : '0 AS is_deleted';
  const completed = flags.completedDate ? 't.completed_date' : 'NULL AS completed_date';
  const assignedDate = flags.assignedDate ? 't.assigned_date' : 'NULL AS assigned_date';
  const assignedBy = flags.assignedBy
    ? 't.assigned_by_id AS assigned_by_member_id, ab.name AS assigned_by_name'
    : 'NULL AS assigned_by_member_id, NULL AS assigned_by_name';
  const assignedJoin = flags.assignedBy ? 'LEFT JOIN admin_users ab ON ab.id = t.assigned_by_id' : '';
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
      tl.logged_hours,
      ta.assignee_id AS assignee_member_id,
      COALESCE(tm.name, au.name) AS assignee_name,
      COALESCE(tm.email, au.email) AS assignee_email,
      ${assignedBy},
      t.grade_id, t.book_id, t.unit_id, t.lesson_id,
      g.name AS grade_name, b.name AS book_name, u.name AS unit_name, l.name AS lesson_name,
      ${assignedDate},
      t.start_date,
      t.end_date AS due_date,
      ${completed},
      ext.created_at AS extension_requested_at,
      ext.reason AS extension_reason,
      ext.status AS extension_status,
      COALESCE(rr.remark_count, 0) AS remark_count,
      rr.last_remark_date,
      rr.complete_remark_date,
      t.server_location,
      t.created_at,
      t.updated_at,
      ${deleted}
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
      ORDER BY (ta2.assignee_type = 'team') DESC, ta2.id DESC
      LIMIT 1
    )
    LEFT JOIN team_members tm ON ta.assignee_type = 'team' AND tm.id = ta.assignee_id
    LEFT JOIN admin_users au ON ta.assignee_type = 'admin' AND au.id = ta.assignee_id
    ${assignedJoin}
    ${REMARK_AGG}
    ${TIME_AGG}
    LEFT JOIN active_extension_requests ext ON ext.id = (
      SELECT e2.id FROM active_extension_requests e2
      WHERE e2.task_id = t.id
      ORDER BY e2.id DESC
      LIMIT 1
    )
  `;
}

async function loadFlags(database) {
  const [isDeleted, completedDate, assignedDate, assignedBy] = await Promise.all([
    hasColumn('tasks', 'is_deleted', database),
    hasColumn('tasks', 'completed_date', database),
    hasColumn('tasks', 'assigned_date', database),
    hasColumn('tasks', 'assigned_by_id', database),
  ]);
  return { isDeleted, completedDate, assignedDate, assignedBy };
}

function taskFilters(projectId, filters, flags) {
  const where = ['t.project_id = ?'];
  const params = [projectId];
  if (filters.status && filters.status.length) {
    const prioritySwap = filters.status.map((status) => status);
    where.push(`t.status IN (${prioritySwap.map(() => '?').join(',')})`);
    params.push(...prioritySwap);
  }
  if (filters.stage) {
    where.push('cs.name = ?');
    params.push(filters.stage);
  }
  if (filters.priority) {
    if (filters.priority === 'critical') where.push(`t.priority IN ('critical', 'urgent')`);
    else {
      where.push('t.priority = ?');
      params.push(filters.priority);
    }
  }
  if (filters.assigneeId) {
    where.push('ta.assignee_id = ? AND ta.assignee_type = \'team\'');
    params.push(filters.assigneeId);
  }
  if (filters.dueFrom) {
    where.push('t.end_date >= ?');
    params.push(filters.dueFrom);
  }
  if (filters.dueTo) {
    where.push('t.end_date <= ?');
    params.push(filters.dueTo);
  }
  if (filters.updatedSince) {
    where.push('t.updated_at >= ?');
    params.push(filters.updatedSince);
  }
  if (!filters.updatedSince && flags.isDeleted) {
    /* Full reload includes soft-deleted rows. Incremental refresh includes them too. */
  }
  return { where: where.join(' AND '), params };
}

async function queryTasks(database, projectId, filters, page, pageSize) {
  const flags = await loadFlags(database);
  const { where, params } = taskFilters(projectId, filters, flags);
  const from = taskFrom(flags);
  const countParams = [projectId, projectId, ...params];
  const countRows = await database.query(
    `SELECT COUNT(*) AS total_rows ${from.slice(from.indexOf('FROM tasks t'))} WHERE ${where}`,
    countParams
  );
  const total = Number(countRows[0] ? countRows[0].total_rows : 0);
  const offset = (page - 1) * pageSize;
  const rows = await database.query(
    `${from} WHERE ${where} ORDER BY t.updated_at ASC, t.id ASC LIMIT ? OFFSET ?`,
    [projectId, projectId, ...params, pageSize, offset]
  );
  return { total, rows };
}

async function queryRemarks(database, projectId, filters, page, pageSize) {
  const where = ['t.project_id = ?'];
  const params = [projectId];
  if (!filters.includePrivate) where.push('COALESCE(r.is_private, 0) = 0');
  if (filters.assigneeId) {
    where.push(`EXISTS (
      SELECT 1 FROM task_assignees ta
      WHERE ta.task_id = t.id AND ta.assignee_id = ? AND ta.assignee_type = 'team'
    )`);
    params.push(filters.assigneeId);
  }
  if (filters.updatedSince) {
    where.push('r.updated_at >= ?');
    params.push(filters.updatedSince);
  }
  const whereSql = where.join(' AND ');
  const base = `
    FROM task_remarks r
    INNER JOIN tasks t ON t.id = r.task_id
    LEFT JOIN team_members tm ON r.added_by_type = 'team' AND tm.id = r.added_by
    LEFT JOIN admin_users au ON r.added_by_type = 'admin' AND au.id = r.added_by
  `;
  const countRows = await database.query(
    `SELECT COUNT(*) AS total_rows ${base} WHERE ${whereSql}`,
    params
  );
  const total = Number(countRows[0] ? countRows[0].total_rows : 0);
  const rows = await database.query(
    `SELECT r.id AS remark_id, r.task_id, r.remark_date, r.remark_type, r.added_by_type,
            r.added_by, COALESCE(tm.name, au.name) AS added_by_name, r.remark, r.is_private,
            r.file_name, r.server_location, r.created_at
     ${base}
     WHERE ${whereSql}
     ORDER BY r.updated_at ASC, r.id ASC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize]
  );
  return { total, rows };
}

async function queryAssignees(database, projectId) {
  const rows = await database.query(
    `SELECT tm.id AS member_id, tm.name AS assignee_name, tm.email AS assignee_email,
            tm.role, tm.is_active,
            (
              SELECT teams.name FROM team_members_teams tmt
              INNER JOIN teams ON teams.id = tmt.team_id
              WHERE tmt.team_member_id = tm.id AND tmt.is_active = 1
              ORDER BY teams.name ASC
              LIMIT 1
            ) AS team
     FROM team_members tm
     WHERE tm.id IN (
       SELECT DISTINCT ta.assignee_id
       FROM task_assignees ta
       INNER JOIN tasks t ON t.id = ta.task_id
       WHERE t.project_id = ? AND ta.assignee_type = 'team'
     )
     ORDER BY tm.id ASC`,
    [projectId]
  );
  return rows;
}

function hierarchySql(level) {
  if (level === 'grade') {
    return `
      SELECT CONCAT('g_', g.id) AS node_id, 'grade' AS tag_level, NULL AS parent_node_id,
             g.name AS hierarchy_path, g.name AS grade, g.description AS grade_description, g.weight AS grade_weight,
             NULL AS book, NULL AS book_type, NULL AS book_description, NULL AS book_weight,
             NULL AS unit, NULL AS unit_description, NULL AS unit_weight,
             NULL AS lesson, NULL AS lesson_description, NULL AS lesson_weight,
             g.order_index AS sort_order, 1 AS is_active, g.updated_at, g.id AS raw_id
      FROM grades g
      WHERE g.project_id = ?
    `;
  }
  if (level === 'book') {
    return `
      SELECT CONCAT('b_', b.id) AS node_id, 'book' AS tag_level, CONCAT('g_', g.id) AS parent_node_id,
             CONCAT(g.name, ' > ', b.name) AS hierarchy_path,
             g.name AS grade, g.description AS grade_description, g.weight AS grade_weight,
             b.name AS book, b.type AS book_type, b.description AS book_description, b.weight AS book_weight,
             NULL AS unit, NULL AS unit_description, NULL AS unit_weight,
             NULL AS lesson, NULL AS lesson_description, NULL AS lesson_weight,
             b.order_index AS sort_order, 1 AS is_active, b.updated_at, b.id AS raw_id
      FROM books b
      INNER JOIN grades g ON g.id = b.grade_id
      WHERE g.project_id = ?
    `;
  }
  if (level === 'unit') {
    return `
      SELECT CONCAT('u_', u.id) AS node_id, 'unit' AS tag_level, CONCAT('b_', b.id) AS parent_node_id,
             CONCAT(g.name, ' > ', b.name, ' > ', u.name) AS hierarchy_path,
             g.name AS grade, g.description AS grade_description, g.weight AS grade_weight,
             b.name AS book, b.type AS book_type, b.description AS book_description, b.weight AS book_weight,
             u.name AS unit, u.description AS unit_description, u.weight AS unit_weight,
             NULL AS lesson, NULL AS lesson_description, NULL AS lesson_weight,
             u.order_index AS sort_order, 1 AS is_active, u.updated_at, u.id AS raw_id
      FROM units u
      INNER JOIN books b ON b.id = u.book_id
      INNER JOIN grades g ON g.id = b.grade_id
      WHERE g.project_id = ?
    `;
  }
  return `
    SELECT CONCAT('l_', l.id) AS node_id, 'lesson' AS tag_level, CONCAT('u_', u.id) AS parent_node_id,
           CONCAT(g.name, ' > ', b.name, ' > ', u.name, ' > ', l.name) AS hierarchy_path,
           g.name AS grade, g.description AS grade_description, g.weight AS grade_weight,
           b.name AS book, b.type AS book_type, b.description AS book_description, b.weight AS book_weight,
           u.name AS unit, u.description AS unit_description, u.weight AS unit_weight,
           l.name AS lesson, l.description AS lesson_description, l.weight AS lesson_weight,
           l.order_index AS sort_order, 1 AS is_active, l.updated_at, l.id AS raw_id
    FROM lessons l
    INNER JOIN units u ON u.id = l.unit_id
    INNER JOIN books b ON b.id = u.book_id
    INNER JOIN grades g ON g.id = b.grade_id
    WHERE g.project_id = ?
  `;
}

async function queryHierarchy(database, projectId, filters, page, pageSize) {
  const levels = filters.tagLevel ? [filters.tagLevel] : ['grade', 'book', 'unit', 'lesson'];
  const parts = levels.map((level) => `(${hierarchySql(level)})`);
  const params = levels.map(() => projectId);
  let updated = '';
  if (filters.updatedSince) {
    updated = ' WHERE updated_at >= ?';
    params.push(filters.updatedSince);
  }
  const union = parts.join(' UNION ALL ');
  const countRows = await database.query(
    `SELECT COUNT(*) AS total_rows FROM (${union}) nodes${updated}`,
    params
  );
  const total = Number(countRows[0] ? countRows[0].total_rows : 0);
  const rows = await database.query(
    `SELECT * FROM (${union}) nodes${updated}
     ORDER BY updated_at ASC, tag_level ASC, raw_id ASC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize]
  );
  return { total, rows };
}

async function queryHistory(database, projectId, filters, page, pageSize) {
  const table = await database.query(
    `SELECT 1 AS ok FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'task_history_events' LIMIT 1`
  );
  if (table.length === 0) return { total: 0, rows: [] };
  const where = ['t.project_id = ?'];
  const params = [projectId];
  if (filters.updatedSince) {
    where.push('e.changed_at >= ?');
    params.push(filters.updatedSince);
  }
  const whereSql = where.join(' AND ');
  const base = `
    FROM task_history_events e
    INNER JOIN tasks t ON t.id = e.task_id
  `;
  const countRows = await database.query(
    `SELECT COUNT(*) AS total_rows ${base} WHERE ${whereSql}`,
    params
  );
  const total = Number(countRows[0] ? countRows[0].total_rows : 0);
  const rows = await database.query(
    `SELECT e.id AS event_id, e.task_id, e.action, e.field_name, e.old_value, e.new_value,
            e.changed_by_id, e.changed_by_name, e.changed_at, e.details
     ${base}
     WHERE ${whereSql}
     ORDER BY e.changed_at ASC, e.id ASC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize]
  );
  return { total, rows };
}

async function queryStages(database, projectId) {
  const rows = await database.query(
    `SELECT cs.id AS stage_id, cs.name AS stage_name, cs.order_index AS stage_order, cs.is_active
     FROM category_stages cs
     WHERE cs.id IN (SELECT DISTINCT category_stage_id FROM tasks WHERE project_id = ? AND category_stage_id IS NOT NULL)
     ORDER BY cs.order_index ASC, cs.id ASC`,
    [projectId]
  );
  return rows;
}

async function queryMeta(database, projectId) {
  const rows = await database.query(
    `SELECT p.id AS project_id, p.name AS project_name,
            (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS total_tasks,
            (SELECT COUNT(*) FROM task_remarks r INNER JOIN tasks t ON t.id = r.task_id WHERE t.project_id = p.id) AS total_remarks,
            (
              (SELECT COUNT(*) FROM grades g WHERE g.project_id = p.id)
              + (SELECT COUNT(*) FROM books b INNER JOIN grades g ON g.id = b.grade_id WHERE g.project_id = p.id)
              + (SELECT COUNT(*) FROM units u INNER JOIN books b ON b.id = u.book_id INNER JOIN grades g ON g.id = b.grade_id WHERE g.project_id = p.id)
              + (SELECT COUNT(*) FROM lessons l INNER JOIN units u ON u.id = l.unit_id INNER JOIN books b ON b.id = u.book_id INNER JOIN grades g ON g.id = b.grade_id WHERE g.project_id = p.id)
            ) AS total_hierarchy_nodes,
            (SELECT MAX(t.updated_at) FROM tasks t WHERE t.project_id = p.id) AS last_updated_at
     FROM projects p
     WHERE p.id = ?`,
    [projectId]
  );
  return rows[0] || null;
}

async function projectExists(database, projectId) {
  const rows = await database.query('SELECT id, name FROM projects WHERE id = ? LIMIT 1', [projectId]);
  return rows[0] || null;
}

module.exports = {
  queryTasks,
  queryRemarks,
  queryAssignees,
  queryHierarchy,
  queryHistory,
  queryStages,
  queryMeta,
  projectExists,
  taskFrom,
};
