const { exportTasksToExcel } = require('../services/taskExportService');

/**
 * Generate filename with timestamp: tasks_export_YYYY_MM_DD_HH_MM.xlsx
 */
const generateFilename = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  return `tasks_export_${yyyy}_${mm}_${dd}_${hh}_${min}.xlsx`;
};

/**
 * GET /api/tasks/export
 * Export all tasks or filtered tasks based on query params
 */
const exportTasks = async (req, res) => {
  try {
    const {
      status, priority, project_id, stage_id,
      assignee_id, search, due_date,
      statusIn, priorityIn, assigneeIdIn,
      dateRangeStart, dateRangeEnd, team_id
    } = req.query;

    const filters = {};
    if (status && status !== 'all') filters.status = status;
    if (priority && priority !== 'all') filters.priority = priority;
    if (project_id) filters.project_id = project_id;
    if (stage_id && stage_id !== 'all') filters.stage_id = stage_id;
    if (assignee_id && assignee_id !== 'all') filters.assignee_id = assignee_id;
    if (search) filters.search = search;
    if (due_date && due_date !== 'all') filters.due_date = due_date;
    
    // Parse IN filters (comma-separated values)
    if (statusIn) {
      filters.statusIn = statusIn.split(',').filter(s => s.trim());
    }
    if (priorityIn) {
      filters.priorityIn = priorityIn.split(',').filter(s => s.trim());
    }
    if (assigneeIdIn) {
      filters.assigneeIdIn = assigneeIdIn.split(',').filter(s => s.trim());
    }
    
    // Parse date range filters
    if (dateRangeStart) filters.dateRangeStart = dateRangeStart;
    if (dateRangeEnd) filters.dateRangeEnd = dateRangeEnd;
    if (team_id && team_id !== 'all') filters.team_id = team_id;

    const buffer = await exportTasksToExcel(filters, req.user);

    const filename = generateFilename();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error) {
    console.error('Export tasks error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'EXPORT_ERROR', message: 'Failed to export tasks', details: error.message }
    });
  }
};

/**
 * POST /api/tasks/export/selected
 * Export only the selected task IDs
 */
const exportSelectedTasks = async (req, res) => {
  try {
    const { taskIds } = req.body;

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'taskIds must be a non-empty array' }
      });
    }

    const numericIds = taskIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id) && id > 0);
    if (numericIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'No valid task IDs provided' }
      });
    }

    // Pass selected IDs as a special filter
    const filters = { selectedIds: numericIds };
    const buffer = await exportTasksToExcel(filters, req.user);

    const filename = generateFilename();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error) {
    console.error('Export selected tasks error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'EXPORT_ERROR', message: 'Failed to export selected tasks', details: error.message }
    });
  }
};

module.exports = { exportTasks, exportSelectedTasks };
