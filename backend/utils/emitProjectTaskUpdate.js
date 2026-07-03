/**
 * Push a project-task-updated SSE event so clients refresh project views (timeline, tasks).
 */
function emitProjectTaskUpdate(projectId, taskId = null, action = 'updated') {
  if (!projectId || !global.notificationServer?.notifyProjectTaskUpdate) return;

  try {
    global.notificationServer.notifyProjectTaskUpdate({
      project_id: Number(projectId),
      task_id: taskId != null ? Number(taskId) : null,
      action,
    });
  } catch (error) {
    console.error('emitProjectTaskUpdate error:', error);
  }
}

module.exports = { emitProjectTaskUpdate };
