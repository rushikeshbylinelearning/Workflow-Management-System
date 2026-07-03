const db = require('../db');
const { sanitizeRemarkText } = require('../utils/sanitizeRemark');
const { assertTaskAccess } = require('../utils/taskAccess');

const ACTION_TYPES = {
  TASK_CREATED: 'task_created',
  SUBMITTED: 'submitted',
  REMARK_ADDED: 'remark_added',
  APPROVED: 'approved',
  DENIED: 'denied',
  REOPENED: 'reopened',
  COMPLETED: 'completed',
  STATUS_UPDATED: 'status_updated',
  RETURNED_FOR_REWORK: 'returned_for_rework',
};

const PAGE_SIZE_DEFAULT = 20;

function mapUserRole(userType) {
  return userType === 'admin' ? 'admin' : 'assignee';
}

function mapStatusChangeAction(previousStatus, newStatus) {
  if (newStatus === 'under-review') return ACTION_TYPES.SUBMITTED;
  if (newStatus === 'completed' && previousStatus === 'under-review') return ACTION_TYPES.COMPLETED;
  if (newStatus === 'in-progress' && previousStatus === 'under-review') return ACTION_TYPES.REOPENED;
  if (newStatus === 'returned' && previousStatus === 'under-review') return ACTION_TYPES.RETURNED_FOR_REWORK;
  if (newStatus === 'completed') return ACTION_TYPES.COMPLETED;
  return ACTION_TYPES.STATUS_UPDATED;
}

async function connQuery(conn, sql, params = []) {
  const [rows] = await conn.execute(sql, params);
  return rows;
}

async function connInsert(conn, sql, params = []) {
  const [result] = await conn.execute(sql, params);
  return result;
}

async function runInTransaction(work) {
  const conn = await db.getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * Append an immutable history row (optionally within an open transaction connection).
 */
async function addEntry(params, conn = null) {
  const {
    taskId,
    userId,
    userRole,
    actionType,
    remarkText = null,
    previousStatus = null,
    newStatus = null,
    reworkCount = null,
  } = params;

  const safeRemark = remarkText != null ? sanitizeRemarkText(remarkText) : null;
  const sql = `INSERT INTO task_remark_history
    (task_id, user_id, user_role, action_type, remark_text, previous_status, new_status, rework_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`;
  const insertParams = [
    taskId,
    userId,
    userRole,
    actionType,
    safeRemark,
    previousStatus,
    newStatus,
    reworkCount,
  ];

  if (conn) {
    const result = await connInsert(conn, sql, insertParams);
    return result.insertId;
  }

  const result = await db.insert(sql, insertParams);
  return result.insertId;
}

async function createSystemEvent(taskId, actionType, remarkText, statusSnapshot = null) {
  return addEntry({
    taskId,
    userId: 0,
    userRole: 'admin',
    actionType,
    remarkText,
    previousStatus: null,
    newStatus: statusSnapshot,
  });
}

async function getTaskTimeline(taskId, { page = 1, limit = PAGE_SIZE_DEFAULT } = {}) {
  const taskIdNum = parseInt(taskId, 10);
  if (!Number.isFinite(taskIdNum) || taskIdNum < 1) {
    return { timeline: [], pagination: { page: 1, limit: PAGE_SIZE_DEFAULT, total: 0, hasMore: false } };
  }

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || PAGE_SIZE_DEFAULT, 1), 50);
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  const countRows = await db.query(
    'SELECT COUNT(*) AS total FROM task_remark_history WHERE task_id = ?',
    [taskIdNum]
  );
  const total = Number(countRows[0]?.total) || 0;

  // LIMIT/OFFSET must be literals — mysql2 prepared LIMIT ? OFFSET ? causes ER_WRONG_ARGUMENTS on many servers
  const rows = await db.query(
    `SELECT
      h.id,
      h.task_id,
      h.user_id,
      h.user_role,
      h.action_type,
      h.remark_text,
      h.previous_status,
      h.new_status,
      h.rework_count,
      h.created_at,
      CASE
        WHEN h.user_id = 0 THEN 'System'
        WHEN h.user_role = 'admin' THEN COALESCE(au.name, 'Admin')
        ELSE COALESCE(tm.name, 'Assignee')
      END AS user_name
    FROM task_remark_history h
    LEFT JOIN admin_users au ON h.user_role = 'admin' AND h.user_id = au.id AND h.user_id > 0
    LEFT JOIN team_members tm ON h.user_role = 'assignee' AND h.user_id = tm.id
    WHERE h.task_id = ?
    ORDER BY h.created_at ASC, h.id ASC
    LIMIT ${safeLimit} OFFSET ${offset}`,
    [taskIdNum]
  );

  const timeline = rows.map((row) => ({
    id: String(row.id),
    user: row.user_name,
    role: row.user_role === 'admin' ? 'Admin' : 'Assignee',
    action: formatActionLabel(row.action_type),
    action_type: row.action_type,
    remark: row.remark_text || '',
    previous_status: row.previous_status,
    new_status: row.new_status,
    rework_count: row.rework_count != null ? Number(row.rework_count) : null,
    timestamp: row.created_at,
  }));

  return {
    timeline,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      hasMore: offset + rows.length < total,
    },
  };
}

function formatActionLabel(actionType) {
  const labels = {
    task_created: 'Task Created',
    submitted: 'Submitted',
    remark_added: 'Remark Added',
    approved: 'Approved',
    denied: 'Denied',
    reopened: 'Reopened',
    completed: 'Completed',
    status_updated: 'Status Updated',
    returned_for_rework: 'Task returned for redo',
  };
  return labels[actionType] || actionType;
}

async function logRemarkAdded(user, taskId, remarkText, remarkType, previousStatus, newStatus, conn) {
  let actionType = ACTION_TYPES.REMARK_ADDED;
  if (remarkType === 'complete') actionType = ACTION_TYPES.SUBMITTED;
  else if (remarkType === 'skipped') actionType = ACTION_TYPES.STATUS_UPDATED;

  return logFromUser(user, taskId, actionType, remarkText, previousStatus, newStatus, conn);
}

async function logReturnedForRework(user, taskId, reviewNotes, previousStatus, newStatus, reworkCount, conn) {
  const remark =
    reviewNotes?.trim() ||
    `Task returned for redo (review round ${reworkCount}).`;
  return logFromUser(
    user,
    taskId,
    ACTION_TYPES.RETURNED_FOR_REWORK,
    remark,
    previousStatus,
    newStatus,
    conn,
    reworkCount
  );
}

async function logFromUser(user, taskId, actionType, remarkText, previousStatus, newStatus, conn = null, reworkCount = null) {
  if (!user || user.id == null) return null;
  return addEntry(
    {
      taskId,
      userId: user.id,
      userRole: mapUserRole(user.type),
      actionType,
      remarkText,
      previousStatus,
      newStatus,
      reworkCount,
    },
    conn
  );
}

async function logReview(user, taskId, action, reviewNotes, previousStatus, newStatus, conn) {
  const actionType = action === 'approve' ? ACTION_TYPES.APPROVED : ACTION_TYPES.DENIED;
  const defaultRemark =
    action === 'approve' ? 'Task approved.' : 'Task denied and returned to in-progress.';
  return logFromUser(
    user,
    taskId,
    actionType,
    reviewNotes?.trim() || defaultRemark,
    previousStatus,
    newStatus,
    conn
  );
}

async function logStatusChange(user, taskId, previousStatus, newStatus, conn) {
  if (!newStatus || previousStatus === newStatus) return null;
  const actionType = mapStatusChangeAction(previousStatus, newStatus);
  const remark =
    actionType === ACTION_TYPES.SUBMITTED
      ? 'Task submitted for review.'
      : actionType === ACTION_TYPES.REOPENED
        ? 'Task reopened for further work.'
        : actionType === ACTION_TYPES.COMPLETED
          ? 'Task marked as completed.'
          : `Status changed from ${previousStatus || 'none'} to ${newStatus}.`;

  return logFromUser(user, taskId, actionType, remark, previousStatus, newStatus, conn);
}

async function logTaskCreated(user, taskId, status, conn) {
  return logFromUser(user, taskId, ACTION_TYPES.TASK_CREATED, 'Task created', null, status, conn);
}

module.exports = {
  ACTION_TYPES,
  addEntry,
  createSystemEvent,
  getTaskTimeline,
  runInTransaction,
  logRemarkAdded,
  logReview,
  logReturnedForRework,
  logStatusChange,
  logTaskCreated,
  mapUserRole,
};
