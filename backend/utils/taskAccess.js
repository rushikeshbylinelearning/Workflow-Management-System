const db = require('../db');

/**
 * Ensure the authenticated user may access the task (admin or assigned assignee).
 */
async function assertTaskAccess(taskId, user) {
  const tasks = await db.query('SELECT id FROM tasks WHERE id = ?', [taskId]);
  if (tasks.length === 0) {
    const err = new Error('Task not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (!user) {
    const err = new Error('Authentication required');
    err.statusCode = 401;
    err.code = 'UNAUTHORIZED';
    throw err;
  }

  if (user.type === 'admin') {
    return true;
  }

  if (user.type === 'team') {
    const rows = await db.query(
      `SELECT 1 FROM task_assignees
       WHERE task_id = ? AND assignee_id = ? AND assignee_type = 'team'
       LIMIT 1`,
      [taskId, user.id]
    );
    if (rows.length > 0) return true;
  }

  const err = new Error('You do not have access to this task');
  err.statusCode = 403;
  err.code = 'FORBIDDEN';
  throw err;
}

/**
 * Admin portal users and project managers may create, edit, delete, and export tasks.
 */
function canManageTasks(user) {
  if (!user) return false;
  if (user.type === 'admin') return true;
  if (user.type === 'team' && user.role === 'project_manager') return true;
  return false;
}

function assertCanManageTasks(user) {
  if (!canManageTasks(user)) {
    const err = new Error('Admin or Project Manager access required');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }
}

module.exports = { assertTaskAccess, canManageTasks, assertCanManageTasks };
