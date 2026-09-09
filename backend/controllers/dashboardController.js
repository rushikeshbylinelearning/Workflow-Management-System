const db = require('../db');

// Helper: format seconds to "Xh Ym"
const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0 && m === 0) return '0m';
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

/**
 * GET /api/dashboard/summary
 * High-level KPI cards for the PM dashboard
 */
const getSummary = async (req, res) => {
  try {
    // Add logging to help diagnose count issues
    console.log('[Dashboard] getSummary called at', new Date().toISOString());
    
    // Projects overview
    const projectStats = await db.queryFirst(`
      SELECT
        COUNT(*) AS total,
        SUM(status = 'active')    AS active,
        SUM(status = 'completed') AS completed,
        SUM(status = 'on-hold')   AS on_hold,
        SUM(status = 'planning')  AS planning,
        SUM(status = 'cancelled') AS cancelled
      FROM projects
    `);

    // Tasks overview
    const taskStats = await db.queryFirst(`
      SELECT
        COUNT(*) AS total,
        SUM(status = 'not-started')  AS not_started,
        SUM(status = 'in-progress')  AS in_progress,
        SUM(status = 'under-review') AS under_review,
        SUM(status = 'completed')    AS completed,
        SUM(status = 'blocked')      AS blocked,
        SUM(status = 'skipped')      AS skipped,
        SUM(end_date < CURDATE() AND status NOT IN ('completed','skipped','under-review')) AS overdue,
        ROUND(AVG(progress), 1) AS avg_progress
      FROM tasks
    `);

    // Count tasks with no assignees (LEFT JOIN + NULL check)
    const unassignedStats = await db.queryFirst(`
      SELECT COUNT(DISTINCT t.id) AS unassigned
      FROM tasks t
      LEFT JOIN task_assignees ta ON t.id = ta.task_id
      WHERE ta.task_id IS NULL
    `);
    
    console.log('[Dashboard] Task count returned:', taskStats.total);

    // Team overview
    const teamStats = await db.queryFirst(`
      SELECT
        COUNT(*) AS total_members,
        SUM(is_active = 1) AS active_members,
        SUM(role = 'project_manager') AS project_managers,
        SUM(role = 'employee') AS employees
      FROM team_members
    `);

    // Performance flags summary
    const flagStats = await db.queryFirst(`
      SELECT
        COUNT(*) AS total,
        SUM(type = 'red')    AS red,
        SUM(type = 'orange') AS orange,
        SUM(type = 'yellow') AS yellow,
        SUM(type = 'green')  AS green
      FROM performance_flags
    `);

    // Total time tracked (all tasks)
    const timeStats = await db.queryFirst(`
      SELECT
        COALESCE(SUM(duration_seconds), 0) AS total_seconds
      FROM task_time_logs
      WHERE status = 'completed'
    `);

    res.json({
      success: true,
      data: {
        projects: projectStats,
        tasks: { ...taskStats, unassigned: unassignedStats.unassigned || 0 },
        team: teamStats,
        performance_flags: flagStats,
        time_tracked: {
          total_seconds: timeStats.total_seconds,
          total_formatted: formatDuration(timeStats.total_seconds)
        }
      }
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Failed to fetch dashboard summary' } });
  }
};

/**
 * GET /api/dashboard/projects
 * All projects with progress, task counts, team size, overdue tasks
 */
const getProjects = async (req, res) => {
  try {
    const { status, category_id } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    if (status) { where += ' AND p.status = ?'; params.push(status); }
    if (category_id) { where += ' AND p.category_id = ?'; params.push(category_id); }

    const projects = await db.query(`
      SELECT
        p.id,
        p.name,
        p.description,
        p.status,
        p.priority,
        p.start_date,
        p.end_date,
        p.budget,
        p.created_at,
        c.name AS category_name,
        ROUND(COALESCE(AVG(t.progress), 0), 1) AS progress,
        COUNT(DISTINCT t.id) AS total_tasks,
        SUM(t.status = 'completed') AS completed_tasks,
        SUM(t.status = 'in-progress') AS in_progress_tasks,
        SUM(t.status = 'blocked') AS blocked_tasks,
        SUM(t.end_date < CURDATE() AND t.status NOT IN ('completed','skipped','under-review')) AS overdue_tasks,
        COUNT(DISTINCT ta.assignee_id) AS team_size,
        COALESCE(SUM(t.total_time_seconds), 0) AS total_time_seconds
      FROM projects p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN tasks t ON t.project_id = p.id
      LEFT JOIN task_assignees ta ON ta.task_id = t.id
      ${where}
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `, params);

    const result = projects.map(p => ({
      ...p,
      total_time_formatted: formatDuration(p.total_time_seconds)
    }));

    res.json({ success: true, data: result, total: result.length });
  } catch (error) {
    console.error('Dashboard projects error:', error);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Failed to fetch projects' } });
  }
};

/**
 * GET /api/dashboard/tasks
 * Tasks with assignee info, time tracked, overdue flag
 * Query params: project_id, status, priority, assignee_id, overdue (true/false)
 */
const getTasks = async (req, res) => {
  try {
    const { project_id, status, priority, assignee_id, overdue, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = 'WHERE 1=1';
    const params = [];

    if (project_id)  { where += ' AND t.project_id = ?';  params.push(project_id); }
    if (status)      { where += ' AND t.status = ?';       params.push(status); }
    if (priority)    { where += ' AND t.priority = ?';     params.push(priority); }
    if (assignee_id) { where += ' AND ta.assignee_id = ?'; params.push(assignee_id); }
    if (overdue === 'true') { where += ' AND t.end_date < CURDATE() AND t.status NOT IN (\'completed\',\'skipped\',\'under-review\')'; }

    const tasks = await db.query(`
      SELECT
        t.id,
        t.name,
        t.status,
        t.priority,
        t.progress,
        t.start_date,
        t.end_date,
        t.estimated_hours,
        t.actual_hours,
        t.total_time_seconds,
        t.timer_status,
        t.created_at,
        p.id   AS project_id,
        p.name AS project_name,
        (t.end_date < CURDATE() AND t.status NOT IN ('completed','skipped','under-review')) AS is_overdue,
        GROUP_CONCAT(DISTINCT COALESCE(tm.name, au.name) SEPARATOR ', ') AS assignees
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN task_assignees ta ON ta.task_id = t.id
      LEFT JOIN team_members tm ON ta.assignee_id = tm.id AND ta.assignee_type = 'team'
      LEFT JOIN admin_users au ON ta.assignee_id = au.id AND ta.assignee_type = 'admin'
      ${where}
      GROUP BY t.id
      ORDER BY t.end_date ASC, t.priority DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    const countRow = await db.queryFirst(`
      SELECT COUNT(DISTINCT t.id) AS total
      FROM tasks t
      LEFT JOIN task_assignees ta ON ta.task_id = t.id
      ${where}
    `, params);

    const result = tasks.map(t => ({
      ...t,
      total_time_formatted: formatDuration(t.total_time_seconds),
      is_overdue: !!t.is_overdue
    }));

    res.json({ success: true, data: result, total: countRow.total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('Dashboard tasks error:', error);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Failed to fetch tasks' } });
  }
};

/**
 * GET /api/dashboard/team-performance
 * Team members with task stats, time tracked, and performance flags
 */
const getTeamPerformance = async (req, res) => {
  try {
    const members = await db.query(`
      SELECT
        tm.id,
        tm.name,
        tm.email,
        tm.role,
        tm.is_active,
        COUNT(DISTINCT ta.task_id) AS assigned_tasks,
        SUM(t.status = 'completed') AS completed_tasks,
        SUM(t.status = 'in-progress') AS in_progress_tasks,
        SUM(t.status = 'blocked') AS blocked_tasks,
        SUM(t.end_date < CURDATE() AND t.status NOT IN ('completed','skipped','under-review')) AS overdue_tasks,
        ROUND(
          CASE WHEN COUNT(DISTINCT ta.task_id) > 0
            THEN (SUM(t.status = 'completed') / COUNT(DISTINCT ta.task_id)) * 100
            ELSE 0
          END, 1
        ) AS completion_rate,
        COALESCE(SUM(ttl.duration_seconds), 0) AS total_time_seconds,
        SUM(pf.type = 'red')    AS red_flags,
        SUM(pf.type = 'orange') AS orange_flags,
        SUM(pf.type = 'yellow') AS yellow_flags,
        SUM(pf.type = 'green')  AS green_flags
      FROM team_members tm
      LEFT JOIN task_assignees ta ON ta.assignee_id = tm.id AND ta.assignee_type = 'team'
      LEFT JOIN tasks t ON t.id = ta.task_id
      LEFT JOIN task_time_logs ttl ON ttl.user_id = tm.id AND ttl.user_type = 'team' AND ttl.status = 'completed'
      LEFT JOIN performance_flags pf ON pf.team_member_id = tm.id
      WHERE tm.is_active = 1
      GROUP BY tm.id
      ORDER BY completion_rate DESC, tm.name ASC
    `);

    const result = members.map(m => ({
      ...m,
      total_time_formatted: formatDuration(m.total_time_seconds),
      performance_score: Math.max(0,
        (m.green_flags * 10) - (m.red_flags * 15) - (m.orange_flags * 8) - (m.yellow_flags * 3)
      )
    }));

    res.json({ success: true, data: result, total: result.length });
  } catch (error) {
    console.error('Dashboard team performance error:', error);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Failed to fetch team performance' } });
  }
};

/**
 * GET /api/dashboard/workload
 * Current workload per team member (active task count + hours allocated today)
 */
const getWorkload = async (req, res) => {
  try {
    const { date = new Date().toISOString().slice(0, 10) } = req.query;

    const workload = await db.query(`
      SELECT
        tm.id,
        tm.name,
        tm.email,
        tm.role,
        COUNT(DISTINCT ta.task_id) AS active_tasks,
        COALESCE(SUM(alloc.hours_per_day), 0) AS allocated_hours_today,
        CASE
          WHEN COALESCE(SUM(alloc.hours_per_day), 0) = 0 THEN 'available'
          WHEN COALESCE(SUM(alloc.hours_per_day), 0) <= 4  THEN 'normal'
          WHEN COALESCE(SUM(alloc.hours_per_day), 0) <= 7  THEN 'busy'
          ELSE 'overloaded'
        END AS workload_status
      FROM team_members tm
      LEFT JOIN task_assignees ta
        ON ta.assignee_id = tm.id AND ta.assignee_type = 'team'
      LEFT JOIN tasks t
        ON t.id = ta.task_id AND t.status = 'in-progress'
      LEFT JOIN team_allocations alloc
        ON alloc.user_id = tm.id AND alloc.user_type = 'team'
        AND ? BETWEEN alloc.start_date AND alloc.end_date
      WHERE tm.is_active = 1
      GROUP BY tm.id
      ORDER BY allocated_hours_today DESC
    `, [date]);

    res.json({ success: true, data: workload, date, total: workload.length });
  } catch (error) {
    console.error('Dashboard workload error:', error);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Failed to fetch workload' } });
  }
};

/**
 * GET /api/dashboard/time-tracking
 * Time tracking summary per project and per member
 * Query params: project_id, member_id, start_date, end_date
 */
const getTimeTracking = async (req, res) => {
  try {
    const { project_id, member_id, start_date, end_date } = req.query;

    let where = 'WHERE ttl.status = \'completed\'';
    const params = [];

    if (project_id)  { where += ' AND t.project_id = ?'; params.push(project_id); }
    if (member_id)   { where += ' AND ttl.user_id = ? AND ttl.user_type = \'team\''; params.push(member_id); }
    if (start_date)  { where += ' AND DATE(ttl.start_time) >= ?'; params.push(start_date); }
    if (end_date)    { where += ' AND DATE(ttl.end_time) <= ?'; params.push(end_date); }

    // Per-project breakdown
    const byProject = await db.query(`
      SELECT
        p.id AS project_id,
        p.name AS project_name,
        COUNT(DISTINCT ttl.task_id) AS tasks_tracked,
        COUNT(DISTINCT ttl.user_id) AS members_tracked,
        SUM(ttl.duration_seconds) AS total_seconds
      FROM task_time_logs ttl
      JOIN tasks t ON t.id = ttl.task_id
      JOIN projects p ON p.id = t.project_id
      ${where}
      GROUP BY p.id
      ORDER BY total_seconds DESC
    `, params);

    // Per-member breakdown
    const byMember = await db.query(`
      SELECT
        tm.id AS member_id,
        tm.name AS member_name,
        COUNT(DISTINCT ttl.task_id) AS tasks_tracked,
        SUM(ttl.duration_seconds) AS total_seconds
      FROM task_time_logs ttl
      JOIN team_members tm ON tm.id = ttl.user_id AND ttl.user_type = 'team'
      JOIN tasks t ON t.id = ttl.task_id
      ${where}
      GROUP BY tm.id
      ORDER BY total_seconds DESC
    `, params);

    const totalSeconds = byProject.reduce((sum, r) => sum + (r.total_seconds || 0), 0);

    res.json({
      success: true,
      data: {
        total_seconds: totalSeconds,
        total_formatted: formatDuration(totalSeconds),
        by_project: byProject.map(r => ({ ...r, total_formatted: formatDuration(r.total_seconds) })),
        by_member:  byMember.map(r => ({ ...r, total_formatted: formatDuration(r.total_seconds) }))
      }
    });
  } catch (error) {
    console.error('Dashboard time tracking error:', error);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Failed to fetch time tracking data' } });
  }
};

/**
 * GET /api/dashboard/overdue-tasks
 * All overdue tasks grouped by project, with assignees
 */
const getOverdueTasks = async (req, res) => {
  try {
    const tasks = await db.query(`
      SELECT
        t.id,
        t.name,
        t.status,
        t.priority,
        t.end_date,
        t.progress,
        DATEDIFF(CURDATE(), t.end_date) AS days_overdue,
        p.id   AS project_id,
        p.name AS project_name,
        GROUP_CONCAT(DISTINCT COALESCE(tm.name, au.name) SEPARATOR ', ') AS assignees
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      LEFT JOIN task_assignees ta ON ta.task_id = t.id
      LEFT JOIN team_members tm ON ta.assignee_id = tm.id AND ta.assignee_type = 'team'
      LEFT JOIN admin_users au ON ta.assignee_id = au.id AND ta.assignee_type = 'admin'
      WHERE t.end_date < CURDATE()
        AND t.status NOT IN ('completed', 'skipped', 'under-review')
      GROUP BY t.id
      ORDER BY days_overdue DESC
    `);

    res.json({ success: true, data: tasks, total: tasks.length });
  } catch (error) {
    console.error('Dashboard overdue tasks error:', error);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Failed to fetch overdue tasks' } });
  }
};

/**
 * GET /api/dashboard/performance-flags
 * Recent performance flags with member and task context
 * Query params: type (red|orange|yellow|green), member_id, limit
 */
const getPerformanceFlags = async (req, res) => {
  try {
    const { type, member_id, limit = 50 } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    if (type)      { where += ' AND pf.type = ?';              params.push(type); }
    if (member_id) { where += ' AND pf.team_member_id = ?';    params.push(member_id); }

    const flags = await db.query(`
      SELECT
        pf.id,
        pf.type,
        pf.reason,
        pf.created_at,
        tm.id   AS member_id,
        tm.name AS member_name,
        tm.email AS member_email,
        t.id    AS task_id,
        t.name  AS task_name,
        p.id    AS project_id,
        p.name  AS project_name,
        au.name AS added_by
      FROM performance_flags pf
      JOIN team_members tm ON tm.id = pf.team_member_id
      LEFT JOIN tasks t ON t.id = pf.task_id
      LEFT JOIN projects p ON p.id = t.project_id
      LEFT JOIN admin_users au ON au.id = pf.added_by_id
      ${where}
      ORDER BY pf.created_at DESC
      LIMIT ?
    `, [...params, parseInt(limit)]);

    res.json({ success: true, data: flags, total: flags.length });
  } catch (error) {
    console.error('Dashboard performance flags error:', error);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Failed to fetch performance flags' } });
  }
};

const KANBAN_STATUSES = [
  'not-started',
  'in-progress',
  'under-review',
  'blocked',
  'on-hold',
  'returned',
  'redo-requested',
  'resubmitted',
  'completed',
  'skipped',
];

const sanitizeMemberRow = (row) => {
  if (!row) return row;
  const { password, password_hash, passcode, ...safe } = row;
  return safe;
};

/**
 * GET /api/dashboard/employee-analytics
 * Per-employee summary for analytics (admin / PM only via route auth).
 */
const getEmployeeAnalyticsList = async (req, res) => {
  try {
    const members = await db.query(`
      SELECT
        tm.id,
        tm.name,
        tm.email,
        tm.role,
        tm.is_active,
        tm.created_at,
        tm.last_login_at,
        GROUP_CONCAT(DISTINCT s.name ORDER BY s.name SEPARATOR ', ') AS skills,
        GROUP_CONCAT(DISTINCT te.name ORDER BY te.name SEPARATOR ', ') AS team_names,
        COUNT(DISTINCT t.project_id) AS total_projects,
        COUNT(DISTINCT CASE WHEN p.status IN ('active', 'planning') THEN t.project_id END) AS active_projects,
        COUNT(DISTINCT ta.task_id) AS total_tasks,
        COUNT(DISTINCT CASE WHEN t.status NOT IN ('completed', 'skipped') THEN ta.task_id END) AS active_tasks,
        SUM(t.status = 'completed') AS completed_tasks,
        SUM(t.status = 'in-progress') AS in_progress_tasks,
        SUM(t.status = 'under-review' OR t.status = 'resubmitted') AS under_review_tasks,
        SUM(t.end_date < CURDATE() AND t.status NOT IN ('completed', 'skipped', 'under-review')) AS overdue_tasks,
        COALESCE(SUM(ttl.duration_seconds), 0) AS total_time_seconds,
        SUM(pf.type = 'red') AS red_flags,
        SUM(pf.type = 'orange') AS orange_flags,
        SUM(pf.type = 'yellow') AS yellow_flags,
        SUM(pf.type = 'green') AS green_flags
      FROM team_members tm
      LEFT JOIN team_member_skills tms ON tm.id = tms.team_member_id
      LEFT JOIN skills s ON tms.skill_id = s.id
      LEFT JOIN team_members_teams tmt ON tm.id = tmt.team_member_id AND tmt.is_active = 1
      LEFT JOIN teams te ON tmt.team_id = te.id AND te.is_active = 1
      LEFT JOIN task_assignees ta ON ta.assignee_id = tm.id AND ta.assignee_type = 'team'
      LEFT JOIN tasks t ON t.id = ta.task_id
      LEFT JOIN projects p ON p.id = t.project_id
      LEFT JOIN task_time_logs ttl ON ttl.user_id = tm.id AND ttl.user_type = 'team' AND ttl.status = 'completed'
      LEFT JOIN performance_flags pf ON pf.team_member_id = tm.id
      WHERE tm.is_active = 1
      GROUP BY tm.id
      ORDER BY tm.name ASC
    `);

    const result = members.map((m) => ({
      ...sanitizeMemberRow(m),
      skills: m.skills ? m.skills.split(', ') : [],
      team_names: m.team_names ? m.team_names.split(', ') : [],
      total_time_formatted: formatDuration(m.total_time_seconds),
      completion_rate: m.total_tasks > 0
        ? Math.round((Number(m.completed_tasks) / Number(m.total_tasks)) * 1000) / 10
        : 0,
    }));

    res.json({ success: true, data: result, total: result.length });
  } catch (error) {
    console.error('Dashboard employee analytics list error:', error);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Failed to fetch employee analytics' } });
  }
};

/**
 * GET /api/dashboard/employee-analytics/:memberId
 * Full employee profile, project breakdown, and tasks grouped for Kanban.
 */
const getEmployeeAnalyticsDetail = async (req, res) => {
  try {
    const memberId = parseInt(req.params.memberId, 10);
    if (!Number.isFinite(memberId) || memberId <= 0) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid member id' } });
    }

    const memberRows = await db.query(`
      SELECT
        tm.id,
        tm.name,
        tm.email,
        tm.role,
        tm.is_active,
        tm.created_at,
        tm.updated_at,
        tm.last_login_at,
        GROUP_CONCAT(DISTINCT s.name ORDER BY s.name SEPARATOR ', ') AS skills,
        GROUP_CONCAT(DISTINCT te.name ORDER BY te.name SEPARATOR ', ') AS team_names,
        GROUP_CONCAT(DISTINCT te.id ORDER BY te.id SEPARATOR ',') AS team_ids
      FROM team_members tm
      LEFT JOIN team_member_skills tms ON tm.id = tms.team_member_id
      LEFT JOIN skills s ON tms.skill_id = s.id
      LEFT JOIN team_members_teams tmt ON tm.id = tmt.team_member_id AND tmt.is_active = 1
      LEFT JOIN teams te ON tmt.team_id = te.id AND te.is_active = 1
      WHERE tm.id = ? AND tm.is_active = 1
      GROUP BY tm.id
    `, [memberId]);

    if (memberRows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Team member not found' } });
    }

    const memberRaw = memberRows[0];
    const member = {
      ...sanitizeMemberRow(memberRaw),
      skills: memberRaw.skills ? memberRaw.skills.split(', ') : [],
      team_names: memberRaw.team_names ? memberRaw.team_names.split(', ') : [],
      team_ids: memberRaw.team_ids ? memberRaw.team_ids.split(',').map((id) => parseInt(id, 10)) : [],
    };

    const [projectRows, taskRows, flagRows, timeRow, workloadRow] = await Promise.all([
      db.query(`
        SELECT
          p.id,
          p.name,
          p.status,
          p.start_date,
          p.end_date,
          ROUND(COALESCE(p.progress, AVG(t.progress), 0), 1) AS progress,
          COUNT(DISTINCT t.id) AS total_tasks,
          SUM(t.status = 'completed') AS completed_tasks,
          SUM(t.status NOT IN ('completed', 'skipped')) AS active_tasks,
          SUM(t.end_date < CURDATE() AND t.status NOT IN ('completed', 'skipped', 'under-review')) AS overdue_tasks
        FROM projects p
        INNER JOIN tasks t ON t.project_id = p.id
        INNER JOIN task_assignees ta ON ta.task_id = t.id AND ta.assignee_id = ? AND ta.assignee_type = 'team'
        GROUP BY p.id, p.name, p.status, p.start_date, p.end_date, p.progress
        ORDER BY p.status = 'active' DESC, p.name ASC
      `, [memberId]),
      db.query(`
        SELECT
          t.id,
          t.name,
          t.description,
          t.status,
          t.priority,
          t.progress,
          t.start_date,
          t.end_date,
          t.estimated_hours,
          t.actual_hours,
          t.rework_count,
          t.created_at,
          t.updated_at,
          p.id AS project_id,
          p.name AS project_name,
          p.status AS project_status,
          cs.name AS stage_name,
          (t.end_date < CURDATE() AND t.status NOT IN ('completed', 'skipped', 'under-review')) AS is_overdue,
          COALESCE((
            SELECT SUM(ttl.duration_seconds)
            FROM task_time_logs ttl
            WHERE ttl.task_id = t.id AND ttl.user_id = ? AND ttl.user_type = 'team' AND ttl.status = 'completed'
          ), 0) AS total_time_seconds
        FROM tasks t
        INNER JOIN task_assignees ta ON ta.task_id = t.id AND ta.assignee_id = ? AND ta.assignee_type = 'team'
        LEFT JOIN projects p ON p.id = t.project_id
        LEFT JOIN category_stages cs ON cs.id = t.category_stage_id
        ORDER BY
          CASE t.status
            WHEN 'in-progress' THEN 1
            WHEN 'under-review' THEN 2
            WHEN 'resubmitted' THEN 2
            WHEN 'not-started' THEN 3
            WHEN 'blocked' THEN 4
            ELSE 5
          END,
          t.end_date ASC,
          t.priority DESC
      `, [memberId, memberId]),
      db.query(`
        SELECT pf.id, pf.type, pf.reason, pf.created_at, t.id AS task_id, t.name AS task_name, p.name AS project_name
        FROM performance_flags pf
        LEFT JOIN tasks t ON t.id = pf.task_id
        LEFT JOIN projects p ON p.id = t.project_id
        WHERE pf.team_member_id = ?
        ORDER BY pf.created_at DESC
        LIMIT 20
      `, [memberId]),
      db.queryFirst(`
        SELECT COALESCE(SUM(duration_seconds), 0) AS total_seconds
        FROM task_time_logs
        WHERE user_id = ? AND user_type = 'team' AND status = 'completed'
      `, [memberId]),
      db.queryFirst(`
        SELECT
          COUNT(DISTINCT ta.task_id) AS active_tasks,
          COALESCE(SUM(alloc.hours_per_day), 0) AS allocated_hours_today
        FROM team_members tm
        LEFT JOIN task_assignees ta ON ta.assignee_id = tm.id AND ta.assignee_type = 'team'
        LEFT JOIN tasks t ON t.id = ta.task_id AND t.status = 'in-progress'
        LEFT JOIN team_allocations alloc ON alloc.user_id = tm.id AND alloc.user_type = 'team'
          AND CURDATE() BETWEEN alloc.start_date AND alloc.end_date
        WHERE tm.id = ?
        GROUP BY tm.id
      `, [memberId]),
    ]);

    const tasks = taskRows.map((t) => ({
      ...t,
      is_overdue: !!t.is_overdue,
      total_time_formatted: formatDuration(t.total_time_seconds),
    }));

    const kanban = {};
    KANBAN_STATUSES.forEach((status) => { kanban[status] = []; });
    tasks.forEach((task) => {
      const status = KANBAN_STATUSES.includes(task.status) ? task.status : 'not-started';
      kanban[status].push(task);
    });

    const totalProjects = projectRows.length;
    const activeProjects = projectRows.filter((p) => ['active', 'planning'].includes(p.status));
    const currentProjects = projectRows.filter((p) => p.status === 'active');
    const totalTasks = tasks.length;
    const activeTasks = tasks.filter((t) => !['completed', 'skipped'].includes(t.status));
    const completedTasks = tasks.filter((t) => t.status === 'completed');
    const overdueTasks = tasks.filter((t) => t.is_overdue);

    res.json({
      success: true,
      data: {
        member,
        stats: {
          total_projects: totalProjects,
          active_projects: activeProjects.length,
          current_projects: currentProjects.length,
          total_tasks: totalTasks,
          active_tasks: activeTasks.length,
          current_tasks: activeTasks.length,
          completed_tasks: completedTasks.length,
          overdue_tasks: overdueTasks.length,
          in_progress_tasks: tasks.filter((t) => t.status === 'in-progress').length,
          under_review_tasks: tasks.filter((t) => ['under-review', 'resubmitted'].includes(t.status)).length,
          completion_rate: totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 1000) / 10 : 0,
          total_time_seconds: timeRow?.total_seconds || 0,
          total_time_formatted: formatDuration(timeRow?.total_seconds || 0),
          allocated_hours_today: Number(workloadRow?.allocated_hours_today ?? 0),
        },
        projects: projectRows,
        current_projects_list: currentProjects,
        tasks,
        kanban,
        performance_flags: flagRows,
      },
    });
  } catch (error) {
    console.error('Dashboard employee analytics detail error:', error);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Failed to fetch employee analytics detail' } });
  }
};

module.exports = {
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
};
