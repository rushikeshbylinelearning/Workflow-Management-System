const express = require('express');
const router = express.Router();
const { requireApiKeyOrAuth } = require('../middleware/auth');
const {
  getSummary,
  getProjects,
  getTasks,
  getTeamPerformance,
  getWorkload,
  getTimeTracking,
  getOverdueTasks,
  getPerformanceFlags,
  getEmployeeAnalyticsList,
  getEmployeeAnalyticsDetail,
} = require('../controllers/dashboardController');

// Middleware to prevent caching of dashboard data
const noCacheMiddleware = (req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  });
  next();
};

// Dashboard routes accept: API key (X-API-Key header or ?api_key=) OR admin/PM JWT
router.use(requireApiKeyOrAuth);
router.use(noCacheMiddleware);

/**
 * GET /api/dashboard/summary
 * KPI cards: project counts, task counts, team size, flag totals, total time tracked
 */
router.get('/summary', getSummary);

/**
 * GET /api/dashboard/projects
 * Projects with progress, task counts, team size, overdue tasks
 * Query: ?status=active&category_id=1
 */
router.get('/projects', getProjects);

/**
 * GET /api/dashboard/tasks
 * Tasks with assignees, time tracked, overdue flag
 * Query: ?project_id=1&status=in-progress&priority=high&assignee_id=2&overdue=true&page=1&limit=50
 */
router.get('/tasks', getTasks);

/**
 * GET /api/dashboard/team-performance
 * Team members with task stats, completion rate, time tracked, performance flags
 */
router.get('/team-performance', getTeamPerformance);

/**
 * GET /api/dashboard/workload
 * Current workload per team member (active tasks + allocated hours)
 * Query: ?date=2025-04-14
 */
router.get('/workload', getWorkload);

/**
 * GET /api/dashboard/time-tracking
 * Time tracking breakdown by project and by member
 * Query: ?project_id=1&member_id=2&start_date=2025-04-01&end_date=2025-04-14
 */
router.get('/time-tracking', getTimeTracking);

/**
 * GET /api/dashboard/overdue-tasks
 * All overdue tasks with days overdue, assignees, project context
 */
router.get('/overdue-tasks', getOverdueTasks);

/**
 * GET /api/dashboard/performance-flags
 * Recent performance flags with member and task context
 * Query: ?type=red&member_id=2&limit=50
 */
router.get('/performance-flags', getPerformanceFlags);

/**
 * GET /api/dashboard/employee-analytics
 * Per-employee summary stats for the analytics employee view
 */
router.get('/employee-analytics', getEmployeeAnalyticsList);

/**
 * GET /api/dashboard/employee-analytics/:memberId
 * Full employee profile, projects, and Kanban-grouped tasks
 */
router.get('/employee-analytics/:memberId', getEmployeeAnalyticsDetail);

module.exports = router;
