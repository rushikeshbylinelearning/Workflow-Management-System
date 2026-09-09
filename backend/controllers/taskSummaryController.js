/**
 * taskSummaryController.js
 *
 * Dedicated endpoint for Admin Kanban Dashboard statistics.
 * Returns only aggregated counts — never returns the full task list.
 *
 * GET /api/tasks/dashboard-summary
 *
 * Query params (all optional):
 *   - project_id: filter by project
 *   - team_id: filter by team
 *   - assignee_id: filter by specific assignee (or 'none')
 *   - assigneeIdIn: comma-separated assignee IDs
 *   - stage_id: filter by category stage
 *   - grade_id, book_id, unit_id, lesson_id: filter by educational hierarchy
 *   - dateRangeStart, dateRangeEnd: filter by end_date range
 *   - search: search in task name/description
 *
 * Response example:
 * {
 *   "success": true,
 *   "data": {
 *     "totalTasks": 18254,
 *     "notStarted": 993,
 *     "inProgress": 385,
 *     "underReview": 262,
 *     "completed": 3945,
 *     "overdue": 1430,
 *     "resubmitted": 74,
 *     "returned": 120
 *   }
 * }
 */

const db = require('../db');
const taskSummaryCache = require('../services/taskSummaryCache');

/**
 * Helper: Builds WHERE clause + params from filters, matching taskController.js logic.
 */
function buildWhereClause(filters, userType, userId) {
  const conditions = [];
  const params = [];

  const {
    project_id,
    team_id,
    assignee_id,
    assigneeIdIn,
    stage_id,
    grade_id,
    book_id,
    unit_id,
    lesson_id,
    dateRangeStart,
    dateRangeEnd,
    search,
    priority,
    priorityIn,
  } = filters;

  // Team members can only see their own tasks
  const effectiveAssigneeId = userType === 'team' ? String(userId) : assignee_id;
  const effectiveAssigneeIdIn = userType === 'team'
    ? []
    : (assigneeIdIn ? assigneeIdIn.split(',').map((s) => s.trim()).filter(Boolean) : []);

  // Projects
  if (project_id) {
    conditions.push('t.project_id = ?');
    params.push(project_id);
  }

  // Stage
  if (stage_id && stage_id !== 'all') {
    conditions.push('t.category_stage_id = ?');
    params.push(parseInt(stage_id, 10));
  }

  // Educational hierarchy
  if (grade_id) {
    conditions.push('t.grade_id = ?');
    params.push(parseInt(grade_id, 10));
  }
  if (book_id) {
    conditions.push('t.book_id = ?');
    params.push(parseInt(book_id, 10));
  }
  if (unit_id) {
    conditions.push('t.unit_id = ?');
    params.push(parseInt(unit_id, 10));
  }
  if (lesson_id && lesson_id !== 'null') {
    conditions.push('t.lesson_id = ?');
    params.push(parseInt(lesson_id, 10));
  } else if (lesson_id === 'null') {
    conditions.push('t.lesson_id IS NULL');
  }

  // Priority
  if (priority) {
    conditions.push('t.priority = ?');
    params.push(priority);
  }
  if (priorityIn) {
    const priorityList = priorityIn.split(',').map((s) => s.trim()).filter(Boolean);
    if (priorityList.length > 0) {
      const placeholders = priorityList.map(() => '?').join(',');
      conditions.push(`t.priority IN (${placeholders})`);
      params.push(...priorityList);
    }
  }

  // Date range
  if (dateRangeStart) {
    conditions.push('t.end_date >= ?');
    params.push(dateRangeStart);
  }
  if (dateRangeEnd) {
    conditions.push('t.end_date <= ?');
    params.push(dateRangeEnd);
  }

  // Search
  if (search) {
    conditions.push('(t.name LIKE ? OR t.description LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  // Assignee
  const needsAssigneeJoin = !!(effectiveAssigneeId || effectiveAssigneeIdIn.length > 0 || team_id);

  if (effectiveAssigneeId === 'none') {
    conditions.push('ta.task_id IS NULL');
  } else if (effectiveAssigneeId) {
    conditions.push('ta.assignee_id = ?');
    params.push(effectiveAssigneeId);
  }

  if (effectiveAssigneeIdIn.length > 0) {
    const placeholders = effectiveAssigneeIdIn.map(() => '?').join(',');
    conditions.push(`ta.assignee_id IN (${placeholders})`);
    params.push(...effectiveAssigneeIdIn);
  }

  // Team filter (tasks assigned to members of a specific team)
  if (team_id && team_id !== 'all') {
    const teamFilterSQL = `EXISTS (
      SELECT 1 FROM task_assignees ta_team
      INNER JOIN team_members_teams tmt ON ta_team.assignee_id = tmt.team_member_id
        AND ta_team.assignee_type = 'team'
        AND tmt.is_active = 1
      WHERE ta_team.task_id = t.id AND tmt.team_id = ?
    )`;
    conditions.push(teamFilterSQL);
    params.push(parseInt(team_id, 10));
  }

  return { conditions, params, needsAssigneeJoin };
}

/**
 * GET /api/tasks/dashboard-summary
 */
const getDashboardSummary = async (req, res) => {
  try {
    const userType = req.user?.type || 'team';
    const userId = req.user?.id || req.teamMember?.id || null;

    // Build cache key from query + user scope
    const cacheKey = taskSummaryCache.buildSummaryKey(req.query, userId, userType);

    // Check cache
    const cached = taskSummaryCache.get(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached, cached: true });
    }

    const { conditions, params, needsAssigneeJoin } = buildWhereClause(req.query, userType, userId);

    // Join clause
    let joinClause = 'FROM tasks t LEFT JOIN projects p ON t.project_id = p.id';
    if (needsAssigneeJoin) {
      joinClause += ` LEFT JOIN task_assignees ta ON t.id = ta.task_id
        LEFT JOIN admin_users au ON ta.assignee_id = au.id AND ta.assignee_type = 'admin'
        LEFT JOIN team_members tm ON ta.assignee_id = tm.id AND ta.assignee_type = 'team'`;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const groupByClause = needsAssigneeJoin ? 'GROUP BY t.id' : '';

    // Single SQL query that counts all status buckets at once using SUM(status = 'value').
    // We also compute overdue (due date < today AND status NOT IN (...)) as a derived column.
    const summaryQuery = `
      SELECT
        COUNT(DISTINCT t.id) AS totalTasks,
        SUM(t.status = 'not-started') AS notStarted,
        SUM(t.status = 'in-progress') AS inProgress,
        SUM(t.status = 'under-review') AS underReview,
        SUM(t.status = 'completed') AS completed,
        SUM(t.status = 'resubmitted') AS resubmitted,
        SUM(t.status = 'returned' OR t.status = 'redo-requested') AS returned,
        SUM(
          t.end_date < CURDATE()
          AND t.status NOT IN ('completed', 'skipped', 'under-review', 'resubmitted')
        ) AS overdue
      FROM (
        SELECT DISTINCT t.id, t.status, t.end_date
        ${joinClause}
        ${whereClause}
        ${groupByClause}
      ) AS t
    `;

    const result = await db.queryFirst(summaryQuery, params);

    const summary = {
      totalTasks: Number(result?.totalTasks || 0),
      notStarted: Number(result?.notStarted || 0),
      inProgress: Number(result?.inProgress || 0),
      underReview: Number(result?.underReview || 0),
      completed: Number(result?.completed || 0),
      overdue: Number(result?.overdue || 0),
      resubmitted: Number(result?.resubmitted || 0),
      returned: Number(result?.returned || 0),
    };

    // Cache the result
    taskSummaryCache.set(cacheKey, summary);

    res.json({ success: true, data: summary, cached: false });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch dashboard summary',
      },
    });
  }
};

module.exports = { getDashboardSummary };
