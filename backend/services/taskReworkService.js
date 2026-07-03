const remarkHistory = require('./taskRemarkHistoryService');
const resubmissionDeadline = require('./resubmissionDeadlineService');

const SUBMITTED_STATUSES = new Set(['under-review', 'submitted']);

function isEnabled() {
  return process.env.ENABLE_REWORK_HIGHLIGHT === 'true';
}

function getReworkSeverity(reworkCount) {
  const count = Number(reworkCount) || 0;
  if (count <= 0) return null;
  if (count >= 3) return 'red';
  if (count === 2) return 'orange';
  return 'yellow';
}

function attachReworkFields(task) {
  const count = Number(task.rework_count) || 0;
  const severity = count > 0 ? getReworkSeverity(count) : null;
  return {
    ...task,
    rework_count: count,
    reworkCount: count,
    reworkSeverity: severity,
  };
}

function attachReworkFieldsBatch(tasks) {
  if (!tasks || tasks.length === 0) return tasks;
  return tasks.map(attachReworkFields);
}

/**
 * Increment rework when admin returns a submitted (under-review) task to assignee.
 * Uses conditional UPDATE so retries after success do not double-increment.
 */
async function incrementRework(conn, { taskId, adminUser, previousStatus, reviewNotes, mysqlDeadline = null, resubmissionSetBy = null }) {
  const setDeadline = mysqlDeadline
    ? `, resubmission_deadline = ?, resubmission_set_by = ?, resubmission_set_at = CURRENT_TIMESTAMP`
    : `, resubmission_deadline = NULL, resubmission_set_by = NULL, resubmission_set_at = NULL`;
  const deadlineParams = mysqlDeadline ? [mysqlDeadline, resubmissionSetBy ?? adminUser?.id ?? null] : [];

  const [updateResult] = await conn.execute(
    `UPDATE tasks
     SET rework_count = rework_count + 1,
         status = 'returned',
         progress = 50,
         updated_at = CURRENT_TIMESTAMP
         ${setDeadline}
     WHERE id = ? AND status IN ('under-review', 'submitted')`,
    [...deadlineParams, taskId]
  );

  if (!updateResult.affectedRows) {
    return { incremented: false, reworkCount: null };
  }

  const [rows] = await conn.execute('SELECT rework_count, status FROM tasks WHERE id = ?', [taskId]);
  const reworkCount = rows[0]?.rework_count ?? 0;
  const newStatus = rows[0]?.status ?? 'in-progress';

  const timelineRemark = mysqlDeadline
    ? resubmissionDeadline.buildTimelineRemark(reviewNotes, mysqlDeadline)
    : reviewNotes;

  await remarkHistory.logReturnedForRework(
    adminUser,
    taskId,
    timelineRemark,
    previousStatus,
    newStatus,
    reworkCount,
    conn
  );

  return {
    incremented: true,
    reworkCount,
    newStatus,
    resubmissionDeadline: mysqlDeadline,
  };
}

async function resetRework(conn, taskId) {
  await conn.execute(
    `UPDATE tasks SET rework_count = 0,
      resubmission_deadline = NULL,
      resubmission_set_by = NULL,
      resubmission_set_at = NULL,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [taskId]
  );
}

function isSubmittedStatus(status) {
  return SUBMITTED_STATUSES.has(status);
}

module.exports = {
  isEnabled,
  getReworkSeverity,
  attachReworkFields,
  attachReworkFieldsBatch,
  incrementRework,
  resetRework,
  isSubmittedStatus,
};
