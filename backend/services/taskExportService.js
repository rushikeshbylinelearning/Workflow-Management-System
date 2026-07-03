const ExcelJS = require('exceljs');
const db = require('../db');

/**
 * Task Export Service
 * Handles Excel export with 5 sheets: Task Summary, Remarks, Task History, Assignee Summary, Stage Summary
 * Task Summary has dynamic remark pair columns: Remark N (Assignee) + Remark N (Admin)
 * Supports 50,000+ tasks via streaming and optimized queries
 */

// Helper: Format date to YYYY-MM-DD
const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
};

// Helper: Calculate delay days (overdue)
const calculateDelayDays = (dueDate, status) => {
  if (!dueDate || status === 'completed') return 0;
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - due) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
};

// Helper: Build hierarchy path from task data
const buildHierarchyPath = (task) => {
  const parts = [];
  if (task.grade_name) parts.push(task.grade_name);
  if (task.book_name) parts.push(task.book_name);
  if (task.unit_name) parts.push(task.unit_name);
  if (task.lesson_name) parts.push(task.lesson_name);
  return parts.length > 0 ? parts.join(' > ') : 'Project Level';
};

// Helper: Apply conditional formatting for status
const getStatusColor = (status) => {
  const colors = {
    'completed': '92D050',    // Green
    'in-progress': '00B0F0',  // Blue
    'not-started': 'D9D9D9',  // Gray
    'blocked': 'FF0000',      // Red
    'under-review': 'FFC000'  // Orange
  };
  return colors[status] || 'FFFFFF';
};

// Helper: Apply conditional formatting for priority
const getPriorityColor = (priority) => {
  const colors = {
    'urgent': 'FF0000',    // Red
    'high': 'FFC000',      // Orange
    'medium': 'FFFF00',    // Yellow
    'low': '92D050'        // Green
  };
  return colors[priority] || 'FFFFFF';
};

function appendTeamFilter(conditions, params, teamId) {
  if (teamId && teamId !== 'all') {
    conditions.push(`EXISTS (
      SELECT 1 FROM task_assignees ta_team
      INNER JOIN team_members_teams tmt ON ta_team.assignee_id = tmt.team_member_id
        AND ta_team.assignee_type = 'team'
        AND tmt.is_active = 1
      WHERE ta_team.task_id = t.id AND tmt.team_id = ?
    )`);
    params.push(parseInt(teamId, 10));
  }
}

/**
 * Main export function
 * @param {Object} filters - Filter criteria (status, priority, project_id, stage_id, search, etc.)
 * @param {Object} user - Current user object for authorization
 * @returns {Promise<Buffer>} - Excel file buffer
 */
// Helper function to build WHERE clause without task_assignees references
function buildWhereClauseWithoutAssignee(filters, user) {
  const conditions = [];
  const params = [];

  if (filters.project_id) {
    conditions.push('t.project_id = ?');
    params.push(filters.project_id);
  }
  if (filters.status && filters.status !== 'all') {
    conditions.push('t.status = ?');
    params.push(filters.status);
  }
  if (filters.statusIn && filters.statusIn.length > 0) {
    const placeholders = filters.statusIn.map(() => '?').join(',');
    conditions.push(`t.status IN (${placeholders})`);
    params.push(...filters.statusIn);
  }
  if (filters.priority && filters.priority !== 'all') {
    conditions.push('t.priority = ?');
    params.push(filters.priority);
  }
  if (filters.priorityIn && filters.priorityIn.length > 0) {
    const placeholders = filters.priorityIn.map(() => '?').join(',');
    conditions.push(`t.priority IN (${placeholders})`);
    params.push(...filters.priorityIn);
  }
  if (filters.stage_id && filters.stage_id !== 'all') {
    conditions.push('t.category_stage_id = ?');
    params.push(parseInt(filters.stage_id, 10));
  }
  if (filters.search) {
    conditions.push('(t.name LIKE ? OR t.description LIKE ?)');
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }
  if (filters.dateRangeStart) {
    conditions.push('t.end_date >= ?');
    params.push(filters.dateRangeStart);
  }
  if (filters.dateRangeEnd) {
    conditions.push('t.end_date <= ?');
    params.push(filters.dateRangeEnd);
  }
  if (filters.selectedIds && filters.selectedIds.length > 0) {
    const placeholders = filters.selectedIds.map(() => '?').join(',');
    conditions.push(`t.id IN (${placeholders})`);
    params.push(...filters.selectedIds);
  }
  appendTeamFilter(conditions, params, filters.team_id);

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, params };
}

// Helper function to build WHERE clause with task_assignees references
function buildWhereClauseWithAssignee(filters, user) {
  const conditions = [];
  const params = [];

  if (filters.project_id) {
    conditions.push('t.project_id = ?');
    params.push(filters.project_id);
  }
  if (filters.status && filters.status !== 'all') {
    conditions.push('t.status = ?');
    params.push(filters.status);
  }
  if (filters.statusIn && filters.statusIn.length > 0) {
    const placeholders = filters.statusIn.map(() => '?').join(',');
    conditions.push(`t.status IN (${placeholders})`);
    params.push(...filters.statusIn);
  }
  if (filters.priority && filters.priority !== 'all') {
    conditions.push('t.priority = ?');
    params.push(filters.priority);
  }
  if (filters.priorityIn && filters.priorityIn.length > 0) {
    const placeholders = filters.priorityIn.map(() => '?').join(',');
    conditions.push(`t.priority IN (${placeholders})`);
    params.push(...filters.priorityIn);
  }
  if (filters.stage_id && filters.stage_id !== 'all') {
    conditions.push('t.category_stage_id = ?');
    params.push(parseInt(filters.stage_id, 10));
  }
  if (filters.assignee_id && filters.assignee_id !== 'all') {
    if (filters.assignee_id === 'none') {
      conditions.push('ta.task_id IS NULL');
    } else {
      conditions.push('ta.assignee_id = ?');
      params.push(filters.assignee_id);
    }
  }
  if (filters.assigneeIdIn && filters.assigneeIdIn.length > 0) {
    const placeholders = filters.assigneeIdIn.map(() => '?').join(',');
    conditions.push(`ta.assignee_id IN (${placeholders})`);
    params.push(...filters.assigneeIdIn);
  }
  if (filters.search) {
    conditions.push('(t.name LIKE ? OR t.description LIKE ?)');
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }
  if (filters.dateRangeStart) {
    conditions.push('t.end_date >= ?');
    params.push(filters.dateRangeStart);
  }
  if (filters.dateRangeEnd) {
    conditions.push('t.end_date <= ?');
    params.push(filters.dateRangeEnd);
  }
  if (filters.selectedIds && filters.selectedIds.length > 0) {
    const placeholders = filters.selectedIds.map(() => '?').join(',');
    conditions.push(`t.id IN (${placeholders})`);
    params.push(...filters.selectedIds);
  }
  if (user && user.type === 'team') {
    conditions.push('ta.assignee_id = ? AND ta.assignee_type = "team"');
    params.push(user.id);
  }
  appendTeamFilter(conditions, params, filters.team_id);

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, params };
}

// Keep the original buildWhereClause for backward compatibility
function buildWhereClause(filters, user) {
  return buildWhereClauseWithAssignee(filters, user);
}

/** @typedef {{ remark: string, created_at: string|Date }} RemarkEntry */

/**
 * Merge remark lists chronologically; drop duplicate text per task.
 * @param  {...RemarkEntry[]} lists
 * @returns {string[]}
 */
function mergeRemarkTexts(...lists) {
  const entries = [];
  for (const list of lists) {
    for (const item of list) {
      const text = item?.remark != null ? String(item.remark).trim() : '';
      if (!text) continue;
      const ts = item.created_at ? new Date(item.created_at).getTime() : 0;
      entries.push({ text, ts: Number.isFinite(ts) ? ts : 0 });
    }
  }
  entries.sort((a, b) => a.ts - b.ts || a.text.localeCompare(b.text));
  const seen = new Set();
  const result = [];
  for (const entry of entries) {
    if (seen.has(entry.text)) continue;
    seen.add(entry.text);
    result.push(entry.text);
  }
  return result;
}

/**
 * Admin review notes (approve/deny/return) are stored in task_remark_history;
 * manual admin notes may also exist in task_remarks.
 */
const ADMIN_HISTORY_ACTION_TYPES = [
  'remark_added',
  'approved',
  'denied',
  'returned_for_rework',
  'reopened',
  'completed',
];

async function exportTasksToExcel(filters = {}, user = null) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Workflow LMS';
  workbook.created = new Date();

  // Build WHERE clause for filtering
  const { whereClause, params } = buildWhereClause(filters, user);

  // ========== SHEET 1: Task Summary ==========
  const taskSheet = workbook.addWorksheet('Task Summary');

  // ------------------------------------------------------------------
  // STEP A: Fetch all remarks for the filtered task set in one query.
  // Ordered oldest-first so index 0 = first remark chronologically.
  // We need this BEFORE defining columns so we know how many remark
  // pair columns to create.
  // ------------------------------------------------------------------
  // Build WHERE clause for all remarks (with assignee support)
  const { whereClause: allRemarksWhereClause, params: allRemarksParams } = buildWhereClauseWithAssignee(filters, user);
  const allRemarksQuery = `
    SELECT DISTINCT
      tr.id,
      tr.task_id,
      tr.added_by_type,
      tr.remark,
      tr.created_at
    FROM task_remarks tr
    JOIN tasks t ON tr.task_id = t.id
    LEFT JOIN task_assignees ta ON t.id = ta.task_id
    ${allRemarksWhereClause}
    ORDER BY tr.task_id ASC, tr.created_at ASC
  `;
  const allRemarks = await db.query(allRemarksQuery, allRemarksParams);

  const adminHistoryPlaceholders = ADMIN_HISTORY_ACTION_TYPES.map(() => '?').join(',');
  const adminHistoryQuery = `
    SELECT DISTINCT
      h.id,
      h.task_id,
      h.remark_text AS remark,
      h.created_at
    FROM task_remark_history h
    JOIN tasks t ON h.task_id = t.id
    LEFT JOIN task_assignees ta ON t.id = ta.task_id
    ${allRemarksWhereClause}
      ${allRemarksWhereClause ? 'AND' : 'WHERE'} h.user_role = 'admin'
      AND h.user_id > 0
      AND h.remark_text IS NOT NULL
      AND TRIM(h.remark_text) != ''
      AND h.action_type IN (${adminHistoryPlaceholders})
    ORDER BY h.task_id ASC, h.created_at ASC
  `;
  const adminHistoryRemarks = await db.query(
    adminHistoryQuery,
    [...allRemarksParams, ...ADMIN_HISTORY_ACTION_TYPES]
  );

  // Group by task_id, split into team (assignee) and admin lists
  const remarksByTask = {};
  const pushRemark = (taskId, bucket, remark, created_at) => {
    if (!remarksByTask[taskId]) {
      remarksByTask[taskId] = { team: [], admin: [] };
    }
    remarksByTask[taskId][bucket].push({ remark, created_at });
  };

  for (const r of allRemarks) {
    const addedByType = String(r.added_by_type || '').toLowerCase();
    if (addedByType === 'team') {
      pushRemark(r.task_id, 'team', r.remark, r.created_at);
    } else if (addedByType === 'admin') {
      pushRemark(r.task_id, 'admin', r.remark, r.created_at);
    }
  }

  for (const r of adminHistoryRemarks) {
    pushRemark(r.task_id, 'admin', r.remark, r.created_at);
  }

  // Max pairs = max(team.length, admin.length) across all tasks
  // Always at least 1 pair so the columns always appear
  let maxRemarkPairs = 1;
  for (const taskId of Object.keys(remarksByTask)) {
    const { team, admin } = remarksByTask[taskId];
    const mergedAdmin = mergeRemarkTexts(admin);
    const pairs = Math.max(team.length, mergedAdmin.length);
    if (pairs > maxRemarkPairs) maxRemarkPairs = pairs;
  }

  // ------------------------------------------------------------------
  // STEP B: Build static + dynamic remark pair columns
  // ------------------------------------------------------------------
  const staticColumns = [
    { header: 'Task ID',                   key: 'id',                  width: 10 },
    { header: 'Assignee Name',             key: 'assignee_name',       width: 25 },
    { header: 'Assignee Email',            key: 'assignee_email',      width: 30 },
    { header: 'Task Name',                 key: 'name',                width: 30 },
    { header: 'Description',              key: 'description',         width: 40 },
    { header: 'Project',                  key: 'project_name',        width: 20 },
    { header: 'Stage',                    key: 'stage_name',          width: 20 },
    { header: 'Status',                   key: 'status',              width: 15 },
    { header: 'Priority',                 key: 'priority',            width: 12 },
    { header: 'Progress (%)',             key: 'progress',            width: 12 },
    { header: 'Hierarchy Path',           key: 'hierarchy_path',      width: 50 },
    { header: 'Level 1 (Grade)',          key: 'grade_name',          width: 20 },
    { header: 'Level 2 (Book)',           key: 'book_name',           width: 20 },
    { header: 'Level 3 (Unit)',           key: 'unit_name',           width: 20 },
    { header: 'Level 4 (Lesson)',         key: 'lesson_name',         width: 20 },
    { header: 'Assigned By',             key: 'assigned_by',         width: 25 },
    { header: 'Assigned Date',           key: 'assigned_date',       width: 15 },
    { header: 'Start Date',              key: 'start_date',          width: 15 },
    { header: 'Due Date',                key: 'end_date',            width: 15 },
    { header: 'Completed Date',          key: 'completed_date',      width: 15 },
    { header: 'Delay Days',              key: 'delay_days',          width: 12 },
    { header: 'Overdue',                 key: 'is_overdue',          width: 10 },
    { header: 'Estimated Hours',         key: 'estimated_hours',     width: 15 },
    { header: 'Actual Hours',            key: 'actual_hours',        width: 15 },
    { header: 'Remaining Hours',         key: 'remaining_hours',     width: 15 },
    { header: 'Extension Requested Date',key: 'ext_requested_date',  width: 22 },
    { header: 'Extension Reason',        key: 'ext_reason',          width: 45 },
    { header: 'Extension Status',        key: 'ext_status',          width: 18 },
  ];

  // Dynamic remark pair columns interleaved:
  // Remark 1 (Assignee), Remark 1 (Admin), Remark 2 (Assignee), Remark 2 (Admin), ...
  const remarkColumns = [];
  for (let i = 1; i <= maxRemarkPairs; i++) {
    remarkColumns.push({ header: `Remark ${i} (Assignee)`, key: `remark_team_${i}`,  width: 50 });
    remarkColumns.push({ header: `Remark ${i} (Admin)`,    key: `remark_admin_${i}`, width: 50 });
  }

  taskSheet.columns = [
    ...staticColumns,
    ...remarkColumns,
    { header: 'Server Location', key: 'server_location', width: 45 }
  ];

  // Style header row — blue for static cols, dark-green for remark cols
  const headerRow = taskSheet.getRow(1);
  headerRow.font      = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height    = 20;

  const remarkStartCol = staticColumns.length + 1;
  const remarkEndCol   = staticColumns.length + remarkColumns.length;
  for (let c = remarkStartCol; c <= remarkEndCol; c++) {
    headerRow.getCell(c).fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: 'FF217346' }  // dark green — visually distinct
    };
  }

  taskSheet.autoFilter = {
    from: { row: 1, column: 1 },
    to:   { row: 1, column: taskSheet.columns.length }
  };
  taskSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  // ------------------------------------------------------------------
  // STEP C: Fetch main task data (remarks handled separately above)
  // ------------------------------------------------------------------
  const { whereClause: tasksWhereClause, params: tasksParams } = buildWhereClause(filters, user);
  const tasksQuery = `
    SELECT
      t.id, t.name, t.description, t.status, t.priority, t.progress,
      t.start_date, t.end_date, t.estimated_hours, t.actual_hours,
      COALESCE(NULLIF(t.server_location, ''), latest_remark.server_location) AS server_location,
      p.name  AS project_name,
      cs.name AS stage_name,
      g.name  AS grade_name,
      b.name  AS book_name,
      u.name  AS unit_name,
      l.name  AS lesson_name,
      COALESCE(tm.name,  au.name)  AS assignee_name,
      COALESCE(tm.email, au.email) AS assignee_email,
      latest_ext.requested_due_date AS ext_requested_date,
      latest_ext.reason             AS ext_reason,
      latest_ext.status             AS ext_status
    FROM tasks t
    LEFT JOIN projects p         ON t.project_id         = p.id
    LEFT JOIN category_stages cs ON t.category_stage_id  = cs.id
    LEFT JOIN grades g           ON t.grade_id            = g.id
    LEFT JOIN books b            ON t.book_id             = b.id
    LEFT JOIN units u            ON t.unit_id             = u.id
    LEFT JOIN lessons l          ON t.lesson_id           = l.id
    INNER JOIN task_assignees ta ON t.id = ta.task_id
    LEFT JOIN team_members tm    ON ta.assignee_id = tm.id  AND ta.assignee_type = 'team'
    LEFT JOIN admin_users au     ON ta.assignee_id = au.id  AND ta.assignee_type = 'admin'
    LEFT JOIN (
      SELECT task_id, server_location
      FROM task_remarks
      WHERE server_location IS NOT NULL AND server_location != ''
      ORDER BY created_at DESC
    ) latest_remark ON latest_remark.task_id = t.id
    LEFT JOIN (
      SELECT te1.task_id, te1.requested_due_date, te1.reason, te1.status
      FROM task_extensions te1
      INNER JOIN (
        SELECT task_id, MAX(created_at) AS max_created_at
        FROM task_extensions
        GROUP BY task_id
      ) te2 ON te1.task_id = te2.task_id AND te1.created_at = te2.max_created_at
    ) latest_ext ON latest_ext.task_id = t.id
    ${tasksWhereClause}
    ORDER BY assignee_name ASC, t.id ASC
  `;

  const tasks = await db.query(tasksQuery, tasksParams);

  // ------------------------------------------------------------------
  // STEP D: Write rows — merge static data with dynamic remark columns
  // ------------------------------------------------------------------
  tasks.forEach(task => {
    const delayDays     = calculateDelayDays(task.end_date, task.status);
    const isOverdue     = delayDays > 0 ? 'Yes' : 'No';
    const remainingHours = Math.max(0, (task.estimated_hours || 0) - (task.actual_hours || 0));

    // Pull this task's remark lists (default empty)
    const taskRemarks = remarksByTask[task.id] || { team: [], admin: [] };
    const teamRemarkTexts = taskRemarks.team.map((e) => e.remark);
    const adminRemarkTexts = mergeRemarkTexts(taskRemarks.admin);

    // Build dynamic remark fields: remark_team_1, remark_admin_1, remark_team_2, ...
    const remarkFields = {};
    for (let i = 1; i <= maxRemarkPairs; i++) {
      remarkFields[`remark_team_${i}`]  = teamRemarkTexts[i - 1]  || '';
      remarkFields[`remark_admin_${i}`] = adminRemarkTexts[i - 1] || '';
    }

    const row = taskSheet.addRow({
      id:                 task.id,
      assignee_name:      task.assignee_name  || 'Unassigned',
      assignee_email:     task.assignee_email || '',
      name:               task.name,
      description:        task.description   || '',
      project_name:       task.project_name  || '',
      stage_name:         task.stage_name    || '',
      status:             task.status,
      priority:           task.priority,
      progress:           task.progress,
      hierarchy_path:     buildHierarchyPath(task),
      grade_name:         task.grade_name    || '',
      book_name:          task.book_name     || '',
      unit_name:          task.unit_name     || '',
      lesson_name:        task.lesson_name   || '',
      assigned_by:        '',
      assigned_date:      '',
      start_date:         formatDate(task.start_date),
      end_date:           formatDate(task.end_date),
      completed_date:     task.status === 'completed' ? formatDate(task.updated_at) : '',
      delay_days:         delayDays,
      is_overdue:         isOverdue,
      estimated_hours:    task.estimated_hours || 0,
      actual_hours:       task.actual_hours    || 0,
      remaining_hours:    remainingHours,
      ext_requested_date: task.ext_requested_date ? formatDate(task.ext_requested_date) : '',
      ext_reason:         task.ext_reason  || '',
      ext_status:         task.ext_status  || '',
      ...remarkFields,
      server_location:    task.server_location || ''
    });

    // Status conditional colour
    row.getCell('status').fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: `FF${getStatusColor(task.status)}` }
    };

    // Priority conditional colour
    row.getCell('priority').fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: `FF${getPriorityColor(task.priority)}` }
    };

    // Progress as percentage
    row.getCell('progress').numFmt = '0"%"';

    // Pale yellow for assignee remark cells with content,
    // pale blue for admin remark cells with content
    for (let i = 1; i <= maxRemarkPairs; i++) {
      const teamCell  = row.getCell(`remark_team_${i}`);
      const adminCell = row.getCell(`remark_admin_${i}`);
      if (teamCell.value) {
        teamCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
      }
      if (adminCell.value) {
        adminCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDAE8FC' } };
      }
    }
  });

  // ========== SHEET 2: Remarks ==========
  const remarksSheet = workbook.addWorksheet('Remarks');
  remarksSheet.columns = [
    { header: 'Task ID', key: 'task_id', width: 10 },
    { header: 'Task Name', key: 'task_name', width: 30 },
    { header: 'Remark Date', key: 'remark_date', width: 15 },
    { header: 'Remark', key: 'remark', width: 50 },
    { header: 'Remark Type', key: 'remark_type', width: 15 },
    { header: 'Added By', key: 'added_by', width: 25 },
    { header: 'Is Private', key: 'is_private', width: 12 },
    { header: 'Server Location', key: 'server_location', width: 40 },
    { header: 'File Name', key: 'file_name', width: 30 },
    { header: 'Created At', key: 'created_at', width: 20 }
  ];

  const remarksHeaderRow = remarksSheet.getRow(1);
  remarksHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  remarksHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
  remarksHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };
  remarksSheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: remarksSheet.columns.length } };
  remarksSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  // Build WHERE clause for remarks (with assignee support)
  const { whereClause: remarksExportWhereClause, params: remarksExportParams } = buildWhereClauseWithAssignee(filters, user);
  const remarksHistoryPlaceholders = ADMIN_HISTORY_ACTION_TYPES.map(() => '?').join(',');
  const remarksQuery = `
    SELECT task_id, task_name, remark_date, remark, remark_type, is_private,
           server_location, file_name, created_at, added_by, added_by_type
    FROM (
      SELECT
        tr.task_id,
        t.name AS task_name,
        tr.remark_date,
        tr.remark,
        tr.remark_type,
        tr.is_private,
        tr.server_location,
        tr.file_name,
        tr.created_at,
        COALESCE(tm.name, au.name) AS added_by,
        tr.added_by_type
      FROM task_remarks tr
      JOIN tasks t ON tr.task_id = t.id
      INNER JOIN task_assignees ta ON t.id = ta.task_id
      LEFT JOIN team_members tm ON tr.added_by = tm.id AND tr.added_by_type = 'team'
      LEFT JOIN admin_users au ON tr.added_by = au.id AND tr.added_by_type = 'admin'
      ${remarksExportWhereClause}
      UNION ALL
      SELECT
        h.task_id,
        t.name AS task_name,
        DATE(h.created_at) AS remark_date,
        h.remark_text AS remark,
        h.action_type AS remark_type,
        0 AS is_private,
        NULL AS server_location,
        NULL AS file_name,
        h.created_at,
        COALESCE(au.name, 'Admin') AS added_by,
        'admin' AS added_by_type
      FROM task_remark_history h
      JOIN tasks t ON h.task_id = t.id
      INNER JOIN task_assignees ta ON t.id = ta.task_id
      LEFT JOIN admin_users au ON h.user_id = au.id AND h.user_role = 'admin'
      ${remarksExportWhereClause}
        ${remarksExportWhereClause ? 'AND' : 'WHERE'} h.user_role = 'admin'
        AND h.user_id > 0
        AND h.remark_text IS NOT NULL
        AND TRIM(h.remark_text) != ''
        AND h.action_type IN (${remarksHistoryPlaceholders})
    ) combined_remarks
    ORDER BY task_id, created_at DESC
  `;

  const remarks = await db.query(remarksQuery, [
    ...remarksExportParams,
    ...remarksExportParams,
    ...ADMIN_HISTORY_ACTION_TYPES,
  ]);
  const seenRemarkSheetKeys = new Set();
  remarks.forEach(remark => {
    const dedupeKey = `${remark.task_id}|${remark.created_at}|${remark.remark}`;
    if (seenRemarkSheetKeys.has(dedupeKey)) return;
    seenRemarkSheetKeys.add(dedupeKey);

    remarksSheet.addRow({
      task_id: remark.task_id,
      task_name: remark.task_name,
      remark_date: formatDate(remark.remark_date),
      remark: remark.remark,
      remark_type: remark.remark_type || 'general',
      added_by: remark.added_by,
      is_private: remark.is_private ? 'Yes' : 'No',
      server_location: remark.server_location || '',
      file_name: remark.file_name || '',
      created_at: formatDate(remark.created_at)
    });
  });

  // ========== SHEET 3: Task History (Audit Log) ==========
  const historySheet = workbook.addWorksheet('Task History');
  historySheet.columns = [
    { header: 'Task ID', key: 'task_id', width: 10 },
    { header: 'Task Name', key: 'task_name', width: 30 },
    { header: 'Action', key: 'action', width: 20 },
    { header: 'Changed By', key: 'changed_by', width: 25 },
    { header: 'Changed At', key: 'changed_at', width: 20 },
    { header: 'Details', key: 'details', width: 50 }
  ];

  const historyHeaderRow = historySheet.getRow(1);
  historyHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  historyHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
  historyHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };
  historySheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: historySheet.columns.length } };
  historySheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  // Note: This requires an activity_logs table or similar audit trail
  // For now, we'll add a placeholder row
  historySheet.addRow({
    task_id: '',
    task_name: '',
    action: 'Audit logging not yet implemented',
    changed_by: '',
    changed_at: '',
    details: 'This sheet will contain task change history once audit logging is enabled'
  });

  // ========== SHEET 5: Assignee Summary ==========
  const assigneeSheet = workbook.addWorksheet('Assignee Summary');
  assigneeSheet.columns = [
    { header: 'Assignee Name', key: 'assignee_name', width: 25 },
    { header: 'Assignee Email', key: 'assignee_email', width: 30 },
    { header: 'Total Tasks', key: 'total_tasks', width: 12 },
    { header: 'Not Started', key: 'not_started', width: 12 },
    { header: 'In Progress', key: 'in_progress', width: 12 },
    { header: 'Under Review', key: 'under_review', width: 12 },
    { header: 'Completed', key: 'completed', width: 12 },
    { header: 'Blocked', key: 'blocked', width: 12 },
    { header: 'Overdue Tasks', key: 'overdue', width: 12 },
    { header: 'Total Estimated Hours', key: 'total_estimated', width: 18 },
    { header: 'Total Actual Hours', key: 'total_actual', width: 18 },
    { header: 'Avg Progress (%)', key: 'avg_progress', width: 15 }
  ];

  const assigneeHeaderRow = assigneeSheet.getRow(1);
  assigneeHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  assigneeHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
  assigneeHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };
  assigneeSheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: assigneeSheet.columns.length } };
  assigneeSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  const { whereClause: assigneeSummaryWhereClause, params: assigneeSummaryParams } = buildWhereClause(filters, user);
  const assigneeSummaryQuery = `
    SELECT 
      COALESCE(tm.name, au.name) as assignee_name,
      COALESCE(tm.email, au.email) as assignee_email,
      COUNT(t.id) as total_tasks,
      SUM(CASE WHEN t.status = 'not-started' THEN 1 ELSE 0 END) as not_started,
      SUM(CASE WHEN t.status = 'in-progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN t.status = 'under-review' THEN 1 ELSE 0 END) as under_review,
      SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN t.status = 'blocked' THEN 1 ELSE 0 END) as blocked,
      SUM(CASE WHEN t.end_date < CURDATE() AND t.status != 'completed' THEN 1 ELSE 0 END) as overdue,
      SUM(t.estimated_hours) as total_estimated,
      SUM(t.actual_hours) as total_actual,
      AVG(t.progress) as avg_progress
    FROM tasks t
    JOIN task_assignees ta ON t.id = ta.task_id
    LEFT JOIN team_members tm ON ta.assignee_id = tm.id AND ta.assignee_type = 'team'
    LEFT JOIN admin_users au ON ta.assignee_id = au.id AND ta.assignee_type = 'admin'
    ${assigneeSummaryWhereClause}
    GROUP BY assignee_name, assignee_email
    ORDER BY total_tasks DESC
  `;

  const assigneeSummary = await db.query(assigneeSummaryQuery, assigneeSummaryParams);
  assigneeSummary.forEach(assignee => {
    assigneeSheet.addRow({
      assignee_name: assignee.assignee_name,
      assignee_email: assignee.assignee_email,
      total_tasks: assignee.total_tasks,
      not_started: assignee.not_started,
      in_progress: assignee.in_progress,
      under_review: assignee.under_review,
      completed: assignee.completed,
      blocked: assignee.blocked,
      overdue: assignee.overdue,
      total_estimated: assignee.total_estimated || 0,
      total_actual: assignee.total_actual || 0,
      avg_progress: Math.round(assignee.avg_progress || 0)
    });
  });

  // ========== SHEET 6: Stage Summary ==========
  const stageSheet = workbook.addWorksheet('Stage Summary');
  stageSheet.columns = [
    { header: 'Project', key: 'project_name', width: 25 },
    { header: 'Stage', key: 'stage_name', width: 25 },
    { header: 'Total Tasks', key: 'total_tasks', width: 12 },
    { header: 'Not Started', key: 'not_started', width: 12 },
    { header: 'In Progress', key: 'in_progress', width: 12 },
    { header: 'Under Review', key: 'under_review', width: 12 },
    { header: 'Completed', key: 'completed', width: 12 },
    { header: 'Blocked', key: 'blocked', width: 12 },
    { header: 'Overdue Tasks', key: 'overdue', width: 12 },
    { header: 'Avg Progress (%)', key: 'avg_progress', width: 15 }
  ];

  const stageHeaderRow = stageSheet.getRow(1);
  stageHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  stageHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
  stageHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };
  stageSheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: stageSheet.columns.length } };
  stageSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  const { whereClause: stageSummaryWhereClause, params: stageSummaryParams } = buildWhereClause(filters, user);
  const stageSummaryQuery = `
    SELECT 
      p.name as project_name,
      cs.name as stage_name,
      COUNT(t.id) as total_tasks,
      SUM(CASE WHEN t.status = 'not-started' THEN 1 ELSE 0 END) as not_started,
      SUM(CASE WHEN t.status = 'in-progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN t.status = 'under-review' THEN 1 ELSE 0 END) as under_review,
      SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN t.status = 'blocked' THEN 1 ELSE 0 END) as blocked,
      SUM(CASE WHEN t.end_date < CURDATE() AND t.status != 'completed' THEN 1 ELSE 0 END) as overdue,
      AVG(t.progress) as avg_progress
    FROM tasks t
    JOIN projects p ON t.project_id = p.id
    LEFT JOIN category_stages cs ON t.category_stage_id = cs.id
    LEFT JOIN task_assignees ta ON t.id = ta.task_id
    ${stageSummaryWhereClause}
    GROUP BY p.name, cs.name
    ORDER BY p.name, cs.name
  `;

  const stageSummary = await db.query(stageSummaryQuery, stageSummaryParams);
  stageSummary.forEach(stage => {
    stageSheet.addRow({
      project_name: stage.project_name,
      stage_name: stage.stage_name || 'No Stage',
      total_tasks: stage.total_tasks,
      not_started: stage.not_started,
      in_progress: stage.in_progress,
      under_review: stage.under_review,
      completed: stage.completed,
      blocked: stage.blocked,
      overdue: stage.overdue,
      avg_progress: Math.round(stage.avg_progress || 0)
    });
  });

  // Generate Excel file buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

module.exports = {
  exportTasksToExcel
};
