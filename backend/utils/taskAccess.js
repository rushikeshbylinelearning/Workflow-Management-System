const db = require('../db');
const {
  canManageTasks,
  getTaskListScope,
} = require('./accessPermissions');

/**
 * Ensure the authenticated user may access the task (admin, assigned, or granted team scope).
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
    const scope = getTaskListScope(user);
    if (scope.type === 'all') return true;

    const rows = await db.query(
      `SELECT 1 FROM task_assignees
       WHERE task_id = ? AND assignee_id = ? AND assignee_type = 'team'
       LIMIT 1`,
      [taskId, user.id]
    );
    if (rows.length > 0) return true;

    if (scope.type === 'teams' && scope.teamIds.length > 0) {
      const placeholders = scope.teamIds.map(() => '?').join(',');
      const teamRows = await db.query(
        `SELECT 1 FROM task_assignees ta
         INNER JOIN team_members_teams tmt
           ON ta.assignee_id = tmt.team_member_id
          AND ta.assignee_type = 'team'
          AND tmt.is_active = 1
         WHERE ta.task_id = ? AND tmt.team_id IN (${placeholders})
         LIMIT 1`,
        [taskId, ...scope.teamIds]
      );
      if (teamRows.length > 0) return true;
    }
  }

  const err = new Error('You do not have access to this task');
  err.statusCode = 403;
  err.code = 'FORBIDDEN';
  throw err;
}

function assertCanManageTasks(user) {
  if (!canManageTasks(user)) {
    const err = new Error('Full write access is required for this action');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }
}

module.exports = { assertTaskAccess, canManageTasks, assertCanManageTasks };
