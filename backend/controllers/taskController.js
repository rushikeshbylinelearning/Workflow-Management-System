const db = require('../db');
const remarkHistory = require('../services/taskRemarkHistoryService');
const reworkService = require('../services/taskReworkService');
const resubmissionDeadline = require('../services/resubmissionDeadlineService');
const { assertTaskAccess, assertCanManageTasks, canManageTasks } = require('../utils/taskAccess');
const { ensureTeamMembersOnProject } = require('../utils/projectMembership');
const { emitProjectTaskUpdate } = require('../utils/emitProjectTaskUpdate');
const { resolveHierarchyIds, resolveHierarchyUpdateIds } = require('../utils/bulkUploadHierarchy');

const TEAM_ASSIGNEE_UPDATE_FIELDS = new Set(['status', 'progress']);

// Helper function to convert date to IST and format as YYYY-MM-DD
const formatDateIST = (dateInput) => {
  if (!dateInput) return null;
  
  // If it's already a YYYY-MM-DD string, parse it as local date
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput;
  }
  
  // For other date inputs, convert to IST
  const date = new Date(dateInput);
  
  // Convert to IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
  const istDate = new Date(date.getTime() + istOffset);
  
  // Extract YYYY-MM-DD from IST date
  return istDate.toISOString().split('T')[0];
};

// Helper function to get today's date in IST
const getTodayIST = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  return istDate.toISOString().split('T')[0];
};

// Helper function to calculate task progress based on status
const calculateTaskProgress = (status) => {
  switch (status) {
    case 'not-started': return 0;
    case 'in-progress': return 50;
    case 'under-review': return 90;
    case 'completed': return 100;
    case 'blocked': return 25;
    case 'on-hold': return null;
    case 'skipped': return 0;
    case 'returned':
    case 'redo-requested':
      return 50;
    case 'resubmitted':
      return 90;
    default: return 0;
  }
};

// Helper function to recalculate project progress
const recalculateProjectProgress = async (projectId) => {
  try {
    const result = await db.query(
      'SELECT COUNT(*) as total_tasks, AVG(progress) as avg_progress FROM tasks WHERE project_id = ?',
      [projectId]
    );
    const calculatedProgress = result.length > 0 && result[0].total_tasks > 0
      ? Math.round(result[0].avg_progress || 0)
      : 0;
    await db.query('UPDATE projects SET progress = ? WHERE id = ?', [calculatedProgress, projectId]);
    return calculatedProgress;
  } catch (error) {
    console.error('Error recalculating project progress:', error);
    return 0;
  }
};

// =====================================================
// BATCH FETCH: Get assignees + skills for multiple tasks in 2 queries
// This eliminates the N+1 query problem
// =====================================================
const enrichTasksBatch = async (tasks) => {
  if (!tasks || tasks.length === 0) return tasks;

  const taskIds = tasks.map(t => t.id);
  const placeholders = taskIds.map(() => '?').join(',');

  // Single query for all assignees
  const assigneesQuery = `
    SELECT ta.task_id, ta.assignee_id, ta.assignee_type,
           tm.name as team_name, tm.email as team_email,
           au.name as admin_name, au.email as admin_email
    FROM task_assignees ta
    LEFT JOIN team_members tm ON ta.assignee_id = tm.id AND ta.assignee_type = 'team'
    LEFT JOIN admin_users au ON ta.assignee_id = au.id AND ta.assignee_type = 'admin'
    WHERE ta.task_id IN (${placeholders})
  `;

  // Single query for all skills
  const skillsQuery = `
    SELECT ts.task_id, s.*
    FROM task_skills ts
    JOIN skills s ON ts.skill_id = s.id
    WHERE ts.task_id IN (${placeholders})
  `;

  // Latest performance flag for each assignee
  const flagsQuery = `
    SELECT pf.team_member_id, pf.type, pf.reason
    FROM performance_flags pf
    INNER JOIN (
      SELECT team_member_id, MAX(created_at) as max_created_at
      FROM performance_flags
      WHERE team_member_id IN (
        SELECT assignee_id FROM task_assignees WHERE task_id IN (${placeholders}) AND assignee_type = 'team'
      )
      GROUP BY team_member_id
    ) latest ON pf.team_member_id = latest.team_member_id AND pf.created_at = latest.max_created_at
  `;

  const [allAssignees, allSkills, allFlags] = await Promise.all([
    db.query(assigneesQuery, taskIds),
    db.query(skillsQuery, taskIds),
    db.query(flagsQuery, taskIds),
  ]);

  // Group by task_id for O(1) lookup
  const assigneesByTask = {};
  const skillsByTask = {};

  for (const a of allAssignees) {
    if (!assigneesByTask[a.task_id]) assigneesByTask[a.task_id] = [];
    assigneesByTask[a.task_id].push(a);
  }
  for (const s of allSkills) {
    if (!skillsByTask[s.task_id]) skillsByTask[s.task_id] = [];
    skillsByTask[s.task_id].push(s);
  }

  const flagsByMember = {};
  for (const f of allFlags) {
    flagsByMember[f.team_member_id] = f;
  }

  const enriched = tasks.map(task => {
    const assignees = assigneesByTask[task.id] || [];
    const skills = skillsByTask[task.id] || [];
    return {
      ...task,
      assignees: assignees.map(a => a.assignee_id),
      assigneeDetails: assignees.map(a => ({
        id: a.assignee_id,
        type: a.assignee_type,
        name: a.assignee_type === 'team' ? a.team_name : a.admin_name,
        email: a.assignee_type === 'team' ? a.team_email : a.admin_email,
        performance_flag: a.assignee_type === 'team' ? flagsByMember[a.assignee_id] : null,
      })),
      teamAssignees: assignees.filter(a => a.assignee_type === 'team').map(a => a.assignee_id),
      skills,
    };
  });
  return resubmissionDeadline.attachResubmissionFieldsBatch(reworkService.attachReworkFieldsBatch(enriched));
};

// Helper: filter tasks assigned to members of a specific team
const TEAM_TASK_FILTER_SQL = `EXISTS (
  SELECT 1 FROM task_assignees ta_team
  INNER JOIN team_members_teams tmt ON ta_team.assignee_id = tmt.team_member_id
    AND ta_team.assignee_type = 'team'
    AND tmt.is_active = 1
  WHERE ta_team.task_id = t.id AND tmt.team_id = ?
)`;

// Helper: build WHERE clause from filters (shared between data & count queries)
const buildTaskFilters = ({
  project_id, status, priority, stage_id, grade_id, book_id, unit_id, lesson_id,
  search, assignee_id, assigneeIdIn, priorityIn, dateRangeStart, dateRangeEnd, team_id
}) => {
  const conditions = [];
  const params = [];

  if (project_id) { conditions.push('t.project_id = ?'); params.push(project_id); }
  if (status) { conditions.push('t.status = ?'); params.push(status); }
  if (priority) { conditions.push('t.priority = ?'); params.push(priority); }
  if (priorityIn && priorityIn.length > 0) {
    const placeholders = priorityIn.map(() => '?').join(',');
    conditions.push(`t.priority IN (${placeholders})`);
    params.push(...priorityIn);
  }
  if (stage_id && stage_id !== 'all') { conditions.push('t.category_stage_id = ?'); params.push(parseInt(stage_id, 10)); }
  if (grade_id) { conditions.push('t.grade_id = ?'); params.push(parseInt(grade_id, 10)); }
  if (book_id) { conditions.push('t.book_id = ?'); params.push(parseInt(book_id, 10)); }
  if (unit_id) { conditions.push('t.unit_id = ?'); params.push(parseInt(unit_id, 10)); }
  if (lesson_id && lesson_id !== 'null') { conditions.push('t.lesson_id = ?'); params.push(parseInt(lesson_id, 10)); }
  else if (lesson_id === 'null') { conditions.push('t.lesson_id IS NULL'); }
  if (search) { conditions.push('(t.name LIKE ? OR t.description LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (assignee_id) {
    if (assignee_id === 'none') conditions.push('ta.task_id IS NULL');
    else { conditions.push('ta.assignee_id = ?'); params.push(assignee_id); }
  }
  if (assigneeIdIn && assigneeIdIn.length > 0) {
    const placeholders = assigneeIdIn.map(() => '?').join(',');
    conditions.push(`ta.assignee_id IN (${placeholders})`);
    params.push(...assigneeIdIn);
  }
  if (dateRangeStart) {
    conditions.push('t.end_date >= ?');
    params.push(dateRangeStart);
  }
  if (dateRangeEnd) {
    conditions.push('t.end_date <= ?');
    params.push(dateRangeEnd);
  }
  if (team_id && team_id !== 'all') {
    conditions.push(TEAM_TASK_FILTER_SQL);
    params.push(parseInt(team_id, 10));
  }

  return { conditions, params };
};

// Get all tasks with filters and pagination
const getTasks = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort = 'created_at',
      order = 'desc',
      project_id, status, priority, search,
      stage_id, grade_id, book_id, unit_id, lesson_id,
      assigneeIdIn, priorityIn, dateRangeStart, dateRangeEnd,
      team_id,
      all = false
    } = req.query;

    // Team members (employees) can only see tasks assigned to them
    const assignee_id = req.user?.type === 'team'
      ? String(req.user.id)
      : req.query.assignee_id;

    const assigneeIdList = req.user?.type === 'team'
      ? []
      : assigneeIdIn
        ? assigneeIdIn.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
    const priorityInList = priorityIn
      ? priorityIn.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    const teamIdFilter = req.user?.type === 'team' ? undefined : team_id;

    const needsAssigneeJoin = sort === 'assignees' || assignee_id || assigneeIdList.length > 0;
    const { conditions, params } = buildTaskFilters({
      project_id, status, priority, stage_id, grade_id, book_id, unit_id, lesson_id,
      search, assignee_id, assigneeIdIn: assigneeIdList, priorityIn: priorityInList,
      dateRangeStart, dateRangeEnd, team_id: teamIdFilter
    });

    // Build base joins
    let joinClause = 'FROM tasks t LEFT JOIN projects p ON t.project_id = p.id LEFT JOIN category_stages cs ON t.category_stage_id = cs.id';
    if (needsAssigneeJoin) {
      joinClause += ' LEFT JOIN task_assignees ta ON t.id = ta.task_id LEFT JOIN admin_users au ON ta.assignee_id = au.id AND ta.assignee_type = "admin" LEFT JOIN team_members tm ON ta.assignee_id = tm.id AND ta.assignee_type = "team"';
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const groupClause = needsAssigneeJoin ? 'GROUP BY t.id' : '';

    // Sort
    const validSortFields = ['name', 'created_at', 'updated_at', 'start_date', 'end_date', 'priority', 'status', 'progress'];
    const validOrders = ['asc', 'desc'];
    let orderClause;
    if (sort === 'assignees') {
      orderClause = `ORDER BY COALESCE(au.name, tm.name, '') ${order.toUpperCase()}, t.created_at DESC`;
    } else if (validSortFields.includes(sort) && validOrders.includes(order.toLowerCase())) {
      orderClause = `ORDER BY t.${sort} ${order.toUpperCase()}`;
    } else {
      orderClause = 'ORDER BY t.created_at DESC';
    }

    // Run data + count in parallel
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitClause = all !== 'true' ? `LIMIT ${parseInt(limit)} OFFSET ${offset}` : '';

    const dataQuery = `SELECT t.*, p.name as project_name, cs.name as stage_name ${joinClause} ${whereClause} ${groupClause} ${orderClause} ${limitClause}`;
    const countQuery = `SELECT COUNT(DISTINCT t.id) as total ${joinClause} ${whereClause}`;

    const [tasks, countResult] = await Promise.all([
      db.query(dataQuery, params),
      db.query(countQuery, params),
    ]);

    const total = countResult[0].total;

    // Enrich tasks with assignees & skills in 2 bulk queries (no N+1)
    const processedTasks = await enrichTasksBatch(tasks);

    res.json({
      success: true,
      data: processedTasks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });

  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Failed to fetch tasks' } });
  }
};

// Test endpoint for stage filtering
const testStageFilter = async (req, res) => {
  try {
    const { stage_id } = req.query;
    const stages = await db.query('SELECT id, name FROM category_stages ORDER BY id');
    const tasks = await db.query('SELECT t.id, t.name, t.category_stage_id, cs.name as stage_name FROM tasks t LEFT JOIN category_stages cs ON t.category_stage_id = cs.id LIMIT 50');

    let filteredTasks = tasks;
    if (stage_id && stage_id !== 'all') {
      const stageIdNum = parseInt(stage_id, 10);
      filteredTasks = tasks.filter(t => t.category_stage_id === stageIdNum);
    }

    res.json({ success: true, stage_id, stages, all_tasks: tasks, filtered_tasks: filteredTasks, total_stages: stages.length, total_tasks: tasks.length, filtered_count: filteredTasks.length });
  } catch (error) {
    console.error('Test stage filter error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get bulk create preview
const getBulkCreatePreview = async (req, res) => {
  try {
    const { project_id } = req.params;

    if (!project_id) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Project ID is required' } });

    const projects = await db.query('SELECT * FROM projects WHERE id = ?', [project_id]);
    if (projects.length === 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });

    const project = projects[0];
    const categoryId = project.category_id;
    if (!categoryId) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Project must have a category assigned' } });

    // Parallel fetch of all hierarchy data
    const [stages, grades] = await Promise.all([
      db.query(`SELECT cs.*, st.order_index as template_order FROM category_stages cs INNER JOIN stage_templates st ON cs.id = st.stage_id WHERE st.category_id = ? ORDER BY st.order_index ASC`, [categoryId]),
      db.query('SELECT * FROM grades WHERE project_id = ? ORDER BY order_index ASC', [project_id]),
    ]);

    if (stages.length === 0) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No stages found for this project category' } });

    const [books, units, lessons, existingTasks] = await Promise.all([
      grades.length > 0 ? db.query(`SELECT b.*, g.name as grade_name, g.project_id FROM books b JOIN grades g ON b.grade_id = g.id WHERE g.project_id = ? ORDER BY b.order_index ASC`, [project_id]) : [],
      db.query(`SELECT u.*, b.name as book_name, g.name as grade_name, g.project_id FROM units u JOIN books b ON u.book_id = b.id JOIN grades g ON b.grade_id = g.id WHERE g.project_id = ? ORDER BY u.order_index ASC`, [project_id]),
      db.query(`SELECT l.*, u.name as unit_name, b.name as book_name, g.name as grade_name, g.project_id FROM lessons l JOIN units u ON l.unit_id = u.id JOIN books b ON u.book_id = b.id JOIN grades g ON b.grade_id = g.id WHERE g.project_id = ? ORDER BY l.order_index ASC`, [project_id]),
      db.query(`SELECT CONCAT(COALESCE(grade_id, 'null'), '-', COALESCE(book_id, 'null'), '-', COALESCE(unit_id, 'null'), '-', COALESCE(lesson_id, 'null'), '-', category_stage_id) as task_key, category_stage_id, name FROM tasks WHERE project_id = ?`, [project_id]),
    ]);

    const hierarchy = [
      ...grades.map(g => ({ id: g.id, unique_id: `grade-${g.id}`, type: 'grade', name: g.name, parent_id: null, parent_unique_id: null, grade_id: g.id, book_id: null, unit_id: null, lesson_id: null, component_path: g.name })),
      ...books.map(b => ({ id: b.id, unique_id: `book-${b.id}`, type: 'book', name: b.name, parent_id: b.grade_id, parent_unique_id: `grade-${b.grade_id}`, grade_id: b.grade_id, book_id: b.id, unit_id: null, lesson_id: null, component_path: `${b.grade_name} > ${b.name}` })),
      ...units.map(u => ({ id: u.id, unique_id: `unit-${u.id}`, type: 'unit', name: u.name, parent_id: u.book_id, parent_unique_id: `book-${u.book_id}`, grade_id: u.grade_id, book_id: u.book_id, unit_id: u.id, lesson_id: null, component_path: `${u.grade_name} > ${u.book_name} > ${u.name}` })),
      ...lessons.map(l => ({ id: l.id, unique_id: `lesson-${l.id}`, type: 'lesson', name: l.name, parent_id: l.unit_id, parent_unique_id: `unit-${l.unit_id}`, grade_id: l.grade_id, book_id: l.book_id, unit_id: l.unit_id, lesson_id: l.id, component_path: `${l.grade_name} > ${l.book_name} > ${l.unit_name} > ${l.name}` })),
    ];

    const childIds = new Set(hierarchy.filter(i => i.parent_unique_id).map(i => i.parent_unique_id));
    const lowestUnits = hierarchy.filter(item => !childIds.has(item.unique_id));

    const existingTaskKeys = new Set(existingTasks.map(task => task.task_key));

    const stageStats = stages.map(stage => {
      let wouldCreate = 0, wouldSkip = 0;
      const existingForStage = [];
      for (const unit of lowestUnits) {
        const taskKey = `${unit.grade_id || 'null'}-${unit.book_id || 'null'}-${unit.unit_id || 'null'}-${unit.lesson_id || 'null'}-${stage.id}`;
        if (existingTaskKeys.has(taskKey)) {
          wouldSkip++;
          const existingTask = existingTasks.find(t => t.task_key === taskKey);
          existingForStage.push({ ...unit, task_name: existingTask.name, reason: 'Task already exists' });
        } else {
          wouldCreate++;
        }
      }
      return { stage_id: stage.id, stage_name: stage.name, stage_description: stage.description, template_order: stage.template_order, would_create: wouldCreate, would_skip: wouldSkip, existing_tasks: existingForStage };
    });

    res.json({
      success: true,
      data: {
        project_id: parseInt(project_id), project_name: project.name,
        total_stages: stages.length, total_lowest_units: lowestUnits.length,
        total_would_create: stageStats.reduce((s, st) => s + st.would_create, 0),
        total_would_skip: stageStats.reduce((s, st) => s + st.would_skip, 0),
        stages: stageStats, lowest_units: lowestUnits,
      },
    });

  } catch (error) {
    console.error('Get bulk create preview error:', error);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Failed to get bulk create preview', details: error.message } });
  }
};

// Bulk create tasks for selected stages
const bulkCreateTasks = async (req, res) => {
  try {
    const { project_id } = req.params;
    const { selected_stage_ids } = req.body;

    if (!project_id) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Project ID is required' } });
    if (!selected_stage_ids || !Array.isArray(selected_stage_ids) || selected_stage_ids.length === 0) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'At least one stage must be selected' } });

    const projects = await db.query('SELECT * FROM projects WHERE id = ?', [project_id]);
    if (projects.length === 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });

    const project = projects[0];
    const categoryId = project.category_id;
    if (!categoryId) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Project must have a category assigned' } });

    const placeholders = selected_stage_ids.map(() => '?').join(',');
    const [stages, grades] = await Promise.all([
      db.query(`SELECT cs.*, st.order_index as template_order FROM category_stages cs INNER JOIN stage_templates st ON cs.id = st.stage_id WHERE st.category_id = ? AND cs.id IN (${placeholders}) ORDER BY st.order_index ASC`, [categoryId, ...selected_stage_ids]),
      db.query('SELECT * FROM grades WHERE project_id = ? ORDER BY order_index ASC', [project_id]),
    ]);

    if (stages.length === 0) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No stages found for this project category' } });

    const [books, units, lessons] = await Promise.all([
      grades.length > 0 ? db.query(`SELECT b.*, g.name as grade_name, g.project_id FROM books b JOIN grades g ON b.grade_id = g.id WHERE g.project_id = ? ORDER BY b.order_index ASC`, [project_id]) : [],
      db.query(`SELECT u.*, b.name as book_name, g.name as grade_name, g.project_id FROM units u JOIN books b ON u.book_id = b.id JOIN grades g ON b.grade_id = g.id WHERE g.project_id = ? ORDER BY u.order_index ASC`, [project_id]),
      db.query(`SELECT l.*, u.name as unit_name, b.name as book_name, g.name as grade_name, g.project_id FROM lessons l JOIN units u ON l.unit_id = u.id JOIN books b ON u.book_id = b.id JOIN grades g ON b.grade_id = g.id WHERE g.project_id = ? ORDER BY l.order_index ASC`, [project_id]),
    ]);

    // Build lookup maps for O(1) access
    const booksById = Object.fromEntries(books.map(b => [b.id, b]));
    const unitsById = Object.fromEntries(units.map(u => [u.id, u]));
    const gradesById = Object.fromEntries(grades.map(g => [g.id, g]));

    const lessonUnitIds = new Set(lessons.map(l => l.unit_id));
    const unitBookIds = new Set(units.map(u => u.book_id));
    const bookGradeIds = new Set(books.map(b => b.grade_id));

    const lowestUnits = [];

    for (const lesson of lessons) {
      const unit = unitsById[lesson.unit_id];
      const book = booksById[unit?.book_id];
      const grade = gradesById[book?.grade_id];
      if (unit && book && grade) {
        lowestUnits.push({ type: 'lesson', grade_id: grade.id, book_id: book.id, unit_id: unit.id, lesson_id: lesson.id, component_path: `${grade.name} > ${book.name} > ${unit.name} > ${lesson.name}`, name: lesson.name });
      }
    }
    for (const unit of units) {
      if (!lessonUnitIds.has(unit.id)) {
        const book = booksById[unit.book_id];
        const grade = gradesById[book?.grade_id];
        if (book && grade) lowestUnits.push({ type: 'unit', grade_id: grade.id, book_id: book.id, unit_id: unit.id, lesson_id: null, component_path: `${grade.name} > ${book.name} > ${unit.name}`, name: unit.name });
      }
    }
    for (const book of books) {
      if (!unitBookIds.has(book.id)) {
        const grade = gradesById[book.grade_id];
        if (grade) lowestUnits.push({ type: 'book', grade_id: grade.id, book_id: book.id, unit_id: null, lesson_id: null, component_path: `${grade.name} > ${book.name}`, name: book.name });
      }
    }
    for (const grade of grades) {
      if (!bookGradeIds.has(grade.id)) lowestUnits.push({ type: 'grade', grade_id: grade.id, book_id: null, unit_id: null, lesson_id: null, component_path: grade.name, name: grade.name });
    }

    if (lowestUnits.length === 0) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No educational hierarchy found for this project' } });

    const existingTasks = await db.query('SELECT grade_id, book_id, unit_id, lesson_id, category_stage_id FROM tasks WHERE project_id = ?', [project_id]);
    const existingTaskKeys = new Set(existingTasks.map(t => `${t.grade_id || 'null'}-${t.book_id || 'null'}-${t.unit_id || 'null'}-${t.lesson_id || 'null'}-${t.category_stage_id}`));

    const createdTasks = [];
    const skippedTasks = [];
    const createdBy = req.user?.id || req.teamMember?.id || 1;

    // Batch insert using VALUES (...), (...) for performance
    const tasksToInsert = [];
    for (const unit of lowestUnits) {
      for (const stage of stages) {
        const taskKey = `${unit.grade_id || 'null'}-${unit.book_id || 'null'}-${unit.unit_id || 'null'}-${unit.lesson_id || 'null'}-${stage.id}`;
        if (existingTaskKeys.has(taskKey)) {
          skippedTasks.push({ ...unit, stage_id: stage.id, stage_name: stage.name, reason: 'Task already exists' });
        } else {
          tasksToInsert.push({ unit, stage });
        }
      }
    }

    if (tasksToInsert.length > 0) {
      const defaultEndDate = project.end_date || formatDateIST(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
      const today = getTodayIST();
      const valuePlaceholders = tasksToInsert.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
      const insertParams = [];
      for (const { unit, stage } of tasksToInsert) {
        insertParams.push(
          `${unit.component_path} - ${stage.name}`,
          `Task for ${unit.component_path} at ${stage.name} stage`,
          parseInt(project_id), stage.id,
          unit.grade_id, unit.book_id, unit.unit_id, unit.lesson_id,
          unit.component_path, 'not-started', 'medium',
          today, defaultEndDate, 0, 8, createdBy
        );
      }
      const batchInsertQuery = `INSERT INTO tasks (name, description, project_id, category_stage_id, grade_id, book_id, unit_id, lesson_id, component_path, status, priority, start_date, end_date, progress, estimated_hours, created_by) VALUES ${valuePlaceholders}`;
      const result = await db.insert(batchInsertQuery, insertParams);
      const firstId = result.insertId;
      tasksToInsert.forEach(({ unit, stage }, i) => {
        createdTasks.push({ id: firstId + i, name: `${unit.component_path} - ${stage.name}`, ...unit, stage_id: stage.id, stage_name: stage.name });
      });
    }

    res.json({
      success: true,
      data: {
        project_id: parseInt(project_id), project_name: project.name,
        total_stages: stages.length, total_lowest_units: lowestUnits.length,
        expected_tasks: stages.length * lowestUnits.length,
        created_tasks: createdTasks.length, skipped_tasks: skippedTasks.length,
        created_tasks_details: createdTasks, skipped_tasks_details: skippedTasks,
      },
      message: `Successfully created ${createdTasks.length} tasks for ${lowestUnits.length} hierarchical units across ${stages.length} stages`,
    });

  } catch (error) {
    console.error('Bulk create tasks error:', error);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Failed to bulk create tasks', details: error.message } });
  }
};

// Get single task by ID
const getTask = async (req, res) => {
  try {
    const { id } = req.params;
    const tasks = await db.query(`SELECT t.*, p.name as project_name, cs.name as stage_name FROM tasks t LEFT JOIN projects p ON t.project_id = p.id LEFT JOIN category_stages cs ON t.category_stage_id = cs.id WHERE t.id = ?`, [id]);

    if (tasks.length === 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });

    const [enriched] = await enrichTasksBatch(tasks);
    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Failed to fetch task' } });
  }
};

// Get task by ID helper (internal use)
const getTaskById = async (taskId) => {
  const tasks = await db.query(`SELECT t.*, p.name as project_name, cs.name as stage_name FROM tasks t LEFT JOIN projects p ON t.project_id = p.id LEFT JOIN category_stages cs ON t.category_stage_id = cs.id WHERE t.id = ?`, [taskId]);
  if (!tasks[0]) return null;
  const [enriched] = await enrichTasksBatch(tasks);
  return enriched;
};

// Create new task
const createTask = async (req, res) => {
  try {
    assertCanManageTasks(req.user);
    const {
      name, description, project_id, category_stage_id,
      status = 'not-started', priority = 'medium',
      start_date, end_date, estimated_hours = 0,
      component_path, grade_id, book_id, unit_id, lesson_id,
      server_location,
      assignees = [], skills = []
    } = req.body;

    const created_by = req.user?.id || 1;

    if (!name || !project_id || !category_stage_id || !start_date || !end_date) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: name, project_id, category_stage_id, start_date, end_date' } });
    }

    const formattedStartDate = formatDateIST(start_date);
    const formattedEndDate = formatDateIST(end_date);
    const calculatedProgress = calculateTaskProgress(status) ?? 0;

    const result = await db.insert(
      `INSERT INTO tasks (name, description, project_id, category_stage_id, status, priority, start_date, end_date, progress, estimated_hours, component_path, server_location, grade_id, book_id, unit_id, lesson_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description, project_id, category_stage_id, status, priority, formattedStartDate, formattedEndDate, calculatedProgress, parseInt(estimated_hours) || 0, component_path, server_location || null, grade_id || null, book_id || null, unit_id || null, lesson_id || null, created_by]
    );
    const taskId = result.insertId;

    // Determine assignee types in parallel
    if (assignees && assignees.length > 0) {
      const teamChecks = await Promise.all(assignees.map(id => db.query('SELECT id FROM team_members WHERE id = ? AND is_active = true', [id])));
      const assigneeRows = assignees.map((id, i) => [taskId, id, teamChecks[i].length > 0 ? 'team' : 'admin']);
      for (const row of assigneeRows) {
        await db.insert('INSERT INTO task_assignees (task_id, assignee_id, assignee_type) VALUES (?, ?, ?)', row);
      }

      try {
        await ensureTeamMembersOnProject(project_id, assignees);
      } catch (membershipError) {
        console.error('Failed to add assignees to project team (task still created):', membershipError);
      }
    }

    if (skills && skills.length > 0) {
      const skillValues = skills.map(() => '(?, ?)').join(',');
      const skillParams = skills.flatMap(skillId => [taskId, skillId]);
      await db.insert(`INSERT INTO task_skills (task_id, skill_id) VALUES ${skillValues}`, skillParams);
    }

    try {
      await remarkHistory.logTaskCreated(
        { id: created_by, type: req.user?.type || 'admin' },
        taskId,
        status
      );
    } catch (historyError) {
      console.error('Task remark history (create) error:', historyError);
    }

    const createdTask = await getTaskById(taskId);
    await recalculateProjectProgress(project_id);
    emitProjectTaskUpdate(project_id, taskId, 'created');

    res.status(201).json({ success: true, data: createdTask, message: 'Task created successfully' });

  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: { code: error.code || 'FORBIDDEN', message: error.message },
      });
    }
    console.error('Create task error:', error.message);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Failed to create task', details: error.message } });
  }
};

// Update task
const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status, priority, start_date, end_date, progress, estimated_hours, actual_hours, component_path, server_location, grade_id, book_id, unit_id, lesson_id, assignees, skills } = req.body;

    if (req.user?.type === 'team' && !canManageTasks(req.user)) {
      await assertTaskAccess(id, req.user);
      const restrictedFields = Object.keys(req.body).filter(
        (key) => req.body[key] !== undefined && !TEAM_ASSIGNEE_UPDATE_FIELDS.has(key)
      );
      if (
        restrictedFields.length > 0 ||
        assignees !== undefined ||
        skills !== undefined ||
        req.body.teamAssignees !== undefined
      ) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You can only update status or progress on your assigned tasks',
          },
        });
      }
    }

    const existing = await db.query('SELECT id, status, progress FROM tasks WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
    const previousStatus = existing[0].status;

    if (req.user?.type === 'team' && !canManageTasks(req.user) && status !== undefined) {
      if (status === 'on-hold' || previousStatus === 'on-hold') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: previousStatus === 'on-hold'
              ? 'This task is on hold. Contact an admin to resume work.'
              : 'Only admins can place tasks on hold.',
          },
        });
      }
    }

    let updateQuery = 'UPDATE tasks SET updated_at = CURRENT_TIMESTAMP';
    const updateParams = [];

    if (name !== undefined) { updateQuery += ', name = ?'; updateParams.push(name); }
    if (description !== undefined) { updateQuery += ', description = ?'; updateParams.push(description); }
    if (status !== undefined) {
      updateQuery += ', status = ?';
      updateParams.push(status);
      const progressForStatus = calculateTaskProgress(status);
      if (progressForStatus !== null) {
        updateQuery += ', progress = ?';
        updateParams.push(progressForStatus);
      }
    } else if (progress !== undefined) { updateQuery += ', progress = ?'; updateParams.push(progress); }
    if (priority !== undefined) { updateQuery += ', priority = ?'; updateParams.push(priority); }
    if (start_date !== undefined) { updateQuery += ', start_date = ?'; updateParams.push(formatDateIST(start_date)); }
    if (end_date !== undefined) { updateQuery += ', end_date = ?'; updateParams.push(formatDateIST(end_date)); }
    if (estimated_hours !== undefined) { updateQuery += ', estimated_hours = ?'; updateParams.push(parseInt(estimated_hours) || 0); }
    if (actual_hours !== undefined) { updateQuery += ', actual_hours = ?'; updateParams.push(parseInt(actual_hours) || 0); }
    if (component_path !== undefined) { updateQuery += ', component_path = ?'; updateParams.push(component_path); }
    if (server_location !== undefined) { updateQuery += ', server_location = ?'; updateParams.push(server_location); }
    if (req.body.category_stage_id !== undefined) { updateQuery += ', category_stage_id = ?'; updateParams.push(req.body.category_stage_id); }
    if (grade_id !== undefined) { updateQuery += ', grade_id = ?'; updateParams.push(grade_id); }
    if (book_id !== undefined) { updateQuery += ', book_id = ?'; updateParams.push(book_id); }
    if (unit_id !== undefined) { updateQuery += ', unit_id = ?'; updateParams.push(unit_id); }
    if (lesson_id !== undefined) { updateQuery += ', lesson_id = ?'; updateParams.push(lesson_id); }
    updateQuery += ' WHERE id = ?';
    updateParams.push(id);

    await db.query(updateQuery, updateParams);

    // Update assignees
    if (assignees !== undefined || req.body.teamAssignees !== undefined) {
      await db.query('DELETE FROM task_assignees WHERE task_id = ?', [id]);
      if (assignees && assignees.length > 0) {
        const teamChecks = await Promise.all(assignees.map(aId => db.query('SELECT id FROM team_members WHERE id = ? AND is_active = true', [aId])));
        for (let i = 0; i < assignees.length; i++) {
          const assigneeType = teamChecks[i].length > 0 ? 'team' : 'admin';
          await db.insert('INSERT IGNORE INTO task_assignees (task_id, assignee_id, assignee_type) VALUES (?, ?, ?)', [id, assignees[i], assigneeType]);
        }

        try {
          const taskProjectRows = await db.query('SELECT project_id FROM tasks WHERE id = ?', [id]);
          const taskProjectId = taskProjectRows[0]?.project_id;
          if (taskProjectId) {
            await ensureTeamMembersOnProject(taskProjectId, assignees);
          }
        } catch (membershipError) {
          console.error('Failed to add assignees to project team (task still updated):', membershipError);
        }
      }
    }

    // Update skills
    if (skills !== undefined) {
      await db.query('DELETE FROM task_skills WHERE task_id = ?', [id]);
      if (skills.length > 0) {
        const skillValues = skills.map(() => '(?, ?)').join(',');
        await db.insert(`INSERT INTO task_skills (task_id, skill_id) VALUES ${skillValues}`, skills.flatMap(skillId => [id, skillId]));
      }
    }

    const updatedTask = await getTaskById(id);
    await recalculateProjectProgress(updatedTask.project_id);

    if (status !== undefined && status !== previousStatus && req.user) {
      try {
        await remarkHistory.logStatusChange(req.user, Number(id), previousStatus, status);
      } catch (historyError) {
        console.error('Task remark history (status) error:', historyError);
      }
    }

    // Send notification if task was marked as under-review or completed by a team member
    if ((status === 'under-review' || status === 'completed') && req.user?.type === 'team') {
      try {
        const notificationServer = global.notificationServer;
        if (notificationServer) {
          const [users, hierarchyResult] = await Promise.all([
            db.query('SELECT name FROM team_members WHERE id = ?', [req.user.id]),
            db.query(`SELECT t.name as task_name, g.name as grade_name, b.name as book_name, u.name as unit_name, l.name as lesson_name, cs.name as stage_name FROM tasks t LEFT JOIN grades g ON t.grade_id = g.id LEFT JOIN books b ON t.book_id = b.id LEFT JOIN units u ON t.unit_id = u.id LEFT JOIN lessons l ON t.lesson_id = l.id LEFT JOIN category_stages cs ON t.category_stage_id = cs.id WHERE t.id = ?`, [id]),
          ]);
          const userName = users.length > 0 ? users[0].name : 'Unknown User';
          if (hierarchyResult.length > 0) {
            const taskData = hierarchyResult[0];
            const hierarchyParts = [taskData.grade_name, taskData.book_name, taskData.unit_name, taskData.lesson_name].filter(Boolean);
            const notificationData = { task_id: id, task_name: taskData.task_name, user_name: userName, user_id: req.user.id, user_type: 'team', hierarchy: hierarchyParts.join(' > ') || 'No hierarchy', stage_name: taskData.stage_name || 'No stage', submitted_at: new Date().toISOString(), status };
            if (status === 'under-review') await notificationServer.notifyTaskSubmission(notificationData);
            else if (status === 'completed') await notificationServer.notifyTaskCompletion(notificationData);
          }
        }
      } catch (error) {
        console.error('Failed to send task completion notification:', error);
      }
    }

    // === TEAMS NOTIFICATION — assignee actions only (not admin assign/edit) ===
    if (status !== undefined && status !== previousStatus) {
      const { notifyAssigneeTeams, isAssigneeTeamsActor } = require('../utils/teamsNotifyContext');
      if (isAssigneeTeamsActor(req.user)) {
        const task = updatedTask;
        notifyAssigneeTeams(req.user, id, {
          taskDetails: task?.title || task?.name || req.body.taskDetails || 'N/A',
          project: task?.project?.name || task?.project_name || req.body.project || 'N/A',
          status: req.body.status || status || 'N/A',
          serverLink: req.body.serverLocation || req.body.serverLink || server_location || 'N/A',
          remark: 'Status updated',
          type: 'status_update',
        });
      }
    }
    // === END TEAMS NOTIFICATION ===

    emitProjectTaskUpdate(updatedTask?.project_id, id, 'updated');

    res.json({ success: true, data: updatedTask, message: 'Task updated successfully' });

  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: { code: error.code || 'FORBIDDEN', message: error.message },
      });
    }
    console.error('Update task error:', error);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Failed to update task' } });
  }
};

// Delete task
const deleteTask = async (req, res) => {
  try {
    assertCanManageTasks(req.user);
    const { id } = req.params;
    const existing = await db.query('SELECT id, project_id FROM tasks WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });

    await db.query('DELETE FROM tasks WHERE id = ?', [id]);
    await recalculateProjectProgress(existing[0].project_id);
    emitProjectTaskUpdate(existing[0].project_id, id, 'deleted');
    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: { code: error.code || 'FORBIDDEN', message: error.message },
      });
    }
    console.error('Delete task error:', error);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Failed to delete task' } });
  }
};

// Bulk delete tasks
const bulkDeleteTasks = async (req, res) => {
  try {
    assertCanManageTasks(req.user);
    const { taskIds } = req.body;
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Task IDs array is required and must not be empty' } });
    }

    // Coerce all IDs to integers and filter out any non-numeric values
    const numericIds = taskIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id) && id > 0);
    if (numericIds.length === 0) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'No valid task IDs provided' } });
    }

    const placeholders = numericIds.map(() => '?').join(',');

    // Find which tasks actually exist
    const existing = await db.query(`SELECT id, project_id FROM tasks WHERE id IN (${placeholders})`, numericIds);

    if (existing.length === 0) {
      // Tasks may have already been deleted — treat as success to avoid UI errors
      return res.json({ success: true, message: '0 task(s) deleted (tasks may have already been removed)', deletedCount: 0, affectedProjects: 0 });
    }

    const foundIds = existing.map(task => task.id);
    const projectIds = [...new Set(existing.map(task => task.project_id))];
    const foundPlaceholders = foundIds.map(() => '?').join(',');

    // Delete only the tasks that actually exist
    await db.query(`DELETE FROM tasks WHERE id IN (${foundPlaceholders})`, foundIds);
    await Promise.all(projectIds.map(projectId => recalculateProjectProgress(projectId)));
    projectIds.forEach((projectId) => emitProjectTaskUpdate(projectId, null, 'deleted'));

    const notFoundIds = numericIds.filter(id => !foundIds.includes(id));

    res.json({
      success: true,
      message: `${foundIds.length} task(s) deleted successfully`,
      deletedCount: foundIds.length,
      affectedProjects: projectIds.length,
      ...(notFoundIds.length > 0 && { notFound: notFoundIds }),
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: { code: error.code || 'FORBIDDEN', message: error.message },
      });
    }
    console.error('Bulk delete tasks error:', error);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Failed to delete tasks' } });
  }
};

// =====================================================
// TASK EXTENSIONS CONTROLLERS
// =====================================================

const requestTaskExtension = async (req, res) => {
  try {
    const { id } = req.params;
    const { requested_due_date, reason } = req.body;
    const requested_by = req.user?.id;
    const requested_by_type = req.user?.type || 'team';

    if (!requested_due_date || !reason) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: requested_due_date, reason' } });

    const [tasks, existingRequest] = await Promise.all([
      db.query('SELECT id, end_date FROM tasks WHERE id = ?', [id]),
      db.query('SELECT id FROM task_extensions WHERE task_id = ? AND status = "pending"', [id]),
    ]);

    if (tasks.length === 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
    if (existingRequest.length > 0) return res.status(400).json({ success: false, error: { code: 'DUPLICATE_REQUEST', message: 'There is already a pending extension request for this task' } });

    const current_due_date = tasks[0].end_date;
    const formattedRequestedDate = formatDateIST(requested_due_date);

    const result = await db.insert(
      `INSERT INTO task_extensions (task_id, requested_by, requested_by_type, current_due_date, requested_due_date, reason, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [id, requested_by, requested_by_type, current_due_date, formattedRequestedDate, reason]
    );

    // Send real-time notification
    if (global.notificationServer) {
      try {
        const [projectResult, requesterResult, taskResult] = await Promise.all([
          db.query('SELECT project_id FROM tasks WHERE id = ?', [id]),
          db.query(requested_by_type === 'admin' ? 'SELECT name FROM admin_users WHERE id = ?' : 'SELECT name FROM team_members WHERE id = ?', [requested_by]),
          db.query('SELECT name FROM tasks WHERE id = ?', [id]),
        ]);
        if (projectResult.length > 0) {
          await global.notificationServer.notifyExtensionRequest({
            id: result.insertId, task_id: id, task_name: taskResult[0]?.name || 'Unknown Task',
            project_id: projectResult[0].project_id, requested_by, requested_by_type,
            requester_name: requesterResult[0]?.name || 'Unknown User',
            current_due_date, requested_due_date: formattedRequestedDate, reason, status: 'pending',
          });
        }
      } catch (notificationError) {
        console.error('Failed to send extension notification:', notificationError);
      }
    }

    res.status(201).json({ success: true, data: { id: result.insertId, task_id: id, requested_due_date: formattedRequestedDate, reason, status: 'pending' }, message: 'Extension request submitted successfully' });
  } catch (error) {
    console.error('Request extension error:', error);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Failed to submit extension request' } });
  }
};

const getTaskExtensions = async (req, res) => {
  try {
    const { id } = req.params;
    const extensions = await db.query(`
      SELECT te.*, COALESCE(tm.name, au.name, 'Unknown User') as requester_name,
        CASE WHEN te.reviewed_by IS NOT NULL THEN admin_reviewer.name ELSE NULL END as reviewer_name
      FROM task_extensions te
      LEFT JOIN team_members tm ON te.requested_by = tm.id
      LEFT JOIN admin_users au ON te.requested_by = au.id
      LEFT JOIN admin_users admin_reviewer ON te.reviewed_by = admin_reviewer.id
      WHERE te.task_id = ? ORDER BY te.created_at DESC
    `, [id]);
    res.json({ success: true, data: extensions });
  } catch (error) {
    console.error('Get task extensions error:', error);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Failed to fetch task extensions' } });
  }
};

const reviewExtensionRequest = async (req, res) => {
  try {
    const { extensionId } = req.params;
    const { status, review_notes } = req.body;
    const reviewed_by = req.user?.id;

    if (!req.user) return res.status(403).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Only admins can review extension requests' } });
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Status must be either "approved" or "rejected"' } });

    const extensions = await db.query('SELECT * FROM task_extensions WHERE id = ? AND status = "pending"', [extensionId]);
    if (extensions.length === 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Extension request not found or already reviewed' } });

    const extension = extensions[0];

    const updateOps = [db.query('UPDATE task_extensions SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_notes = ? WHERE id = ?', [status, reviewed_by, review_notes, extensionId])];
    if (status === 'approved') updateOps.push(db.query('UPDATE tasks SET end_date = ? WHERE id = ?', [extension.requested_due_date, extension.task_id]));
    await Promise.all(updateOps);

    if (global.notificationServer) {
      try {
        const [taskResult, reviewerResult] = await Promise.all([
          db.query('SELECT name FROM tasks WHERE id = ?', [extension.task_id]),
          db.query('SELECT name FROM admin_users WHERE id = ?', [reviewed_by]),
        ]);
        await global.notificationServer.notifyExtensionReview({
          task_id: extension.task_id, task_name: taskResult[0]?.name || 'Unknown Task',
          requested_by: extension.requested_by, requested_by_type: extension.requested_by_type,
          status, reviewer_name: reviewerResult[0]?.name || 'Admin', review_notes,
          requested_due_date: extension.requested_due_date, current_due_date: extension.current_due_date,
        });
      } catch (notificationError) {
        console.error('Failed to send extension review notification:', notificationError);
      }
    }

    res.json({ success: true, message: `Extension request ${status} successfully` });
  } catch (error) {
    console.error('Review extension error:', error);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Failed to review extension request' } });
  }
};

// =====================================================
// TASK REMARKS CONTROLLERS
// =====================================================

const addTaskRemark = async (req, res) => {
  try {
    const { id } = req.params;
    const { remark, remark_date, remark_type = 'general', is_private = false, server_location, file_name } = req.body;
    const added_by = req.user?.id;
    const added_by_type = req.user?.type || 'team';

    if (!remark) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Remark content is required' } });
    if (added_by_type === 'team') {
      if (!server_location) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Server location is required for team members' } });
      if (!file_name) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'File name is required for team members' } });
    }

    await assertTaskAccess(id, req.user);

    const taskRow = await db.queryFirst('SELECT id, status, project_id, name FROM tasks WHERE id = ?', [id]);
    if (!taskRow) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
    if (added_by_type === 'team' && taskRow.status === 'on-hold') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'This task is on hold. Remarks cannot be added until an admin resumes the task.' },
      });
    }

    const formattedRemarkDate = remark_date ? formatDateIST(remark_date) : getTodayIST();
    const previousStatus = taskRow.status;
    let newStatus = previousStatus;
    let insertId;

    await remarkHistory.runInTransaction(async (conn) => {
      const [insertResult] = await conn.execute(
        `INSERT INTO task_remarks (task_id, added_by, added_by_type, remark_date, remark, remark_type, is_private, server_location, file_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, added_by, added_by_type, formattedRemarkDate, remark, remark_type || null, is_private || false, server_location || null, file_name || null]
      );
      insertId = insertResult.insertId;

      if (remark_type === 'complete' || remark_type === 'skipped') {
        newStatus = remark_type === 'complete' ? 'under-review' : 'skipped';
        const newProgress = calculateTaskProgress(newStatus);
        await conn.execute(
          'UPDATE tasks SET status = ?, progress = ?, updated_at = NOW() WHERE id = ?',
          [newStatus, newProgress, id]
        );
      }

      await remarkHistory.logRemarkAdded(
        req.user,
        Number(id),
        remark,
        remark_type,
        previousStatus,
        newStatus,
        conn
      );
    });

    if (remark_type === 'complete' || remark_type === 'skipped') {
      if (taskRow.project_id) await recalculateProjectProgress(taskRow.project_id);
    }

    if (global.notificationServer) {
      try {
        const userResult = await db.query(
          added_by_type === 'admin' ? 'SELECT name FROM admin_users WHERE id = ?' : 'SELECT name FROM team_members WHERE id = ?',
          [added_by]
        );
        const submitterName = userResult[0]?.name || 'Unknown User';

        if (remark_type === 'complete') {
          await global.notificationServer.notifyTaskSubmission({
            task_id: id,
            task_name: taskRow.name,
            project_id: taskRow.project_id,
            user_name: submitterName,
            user_id: added_by,
            user_type: added_by_type,
            submitted_at: new Date().toISOString(),
          });
        }

        await global.notificationServer.notifyNewRemark({
          id: insertId,
          task_id: id,
          task_name: taskRow.name,
          project_id: taskRow.project_id,
          user_name: submitterName,
          user_type: added_by_type,
          remark,
          remark_type,
          is_private,
        });
      } catch (notificationError) {
        console.error('Failed to send remark notification:', notificationError);
      }
    }

    // === TEAMS NOTIFICATION — assignee remarks only ===
    {
      const { notifyAssigneeTeams, isAssigneeTeamsActor } = require('../utils/teamsNotifyContext');
      if (isAssigneeTeamsActor(req.user)) {
        let projectName = null;
        if (taskRow?.project_id) {
          const projectRows = await db.query('SELECT name FROM projects WHERE id = ?', [taskRow.project_id]);
          projectName = projectRows[0]?.name || null;
        }
        const task = { ...taskRow, project: { name: projectName } };
        const teamsBase = {
          project: req.body.project || task?.project?.name || 'N/A',
          taskDetails: req.body.taskDetails || task?.title || task?.name || 'N/A',
          serverLink: req.body.serverLocation || req.body.serverLink || server_location || 'N/A',
          remark: req.body.remarkContent || req.body.remark || remark || 'N/A',
        };

        const isSubmissionRemark = remark_type === 'complete' || remark_type === 'skipped';

        if (isSubmissionRemark || newStatus !== previousStatus) {
          notifyAssigneeTeams(req.user, id, {
            ...teamsBase,
            status: newStatus,
            type: 'status_update',
          });
        } else {
          notifyAssigneeTeams(req.user, id, {
            ...teamsBase,
            status: req.body.remarkType || req.body.status || remark_type || 'N/A',
            type: 'remark',
          });
        }
      }
    }
    // === END TEAMS NOTIFICATION ===

    res.status(201).json({
      success: true,
      data: { id: insertId, task_id: id, remark, remark_date: formattedRemarkDate, remark_type, is_private },
      message: 'Remark added successfully',
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: { code: error.code, message: error.message },
      });
    }
    console.error('Add task remark error:', error);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Failed to add remark' } });
  }
};

const getTaskRemarksHistory = async (req, res) => {
  try {
    const { taskId } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;

    await assertTaskAccess(taskId, req.user);
    const { timeline, pagination } = await remarkHistory.getTaskTimeline(taskId, { page, limit });

    res.json({
      success: true,
      data: { timeline, pagination },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: { code: error.code, message: error.message },
      });
    }
    console.error('Get task remarks history error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'DATABASE_ERROR', message: 'Failed to fetch remarks history' },
    });
  }
};

const getTaskRemarks = async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user;
    let query = `SELECT tr.*, COALESCE(tm.name, au.name, 'Unknown User') as user_name FROM task_remarks tr LEFT JOIN team_members tm ON tr.added_by = tm.id LEFT JOIN admin_users au ON tr.added_by = au.id WHERE tr.task_id = ?`;
    const queryParams = [id];
    if (!isAdmin) query += ' AND tr.is_private = 0';
    query += ' ORDER BY tr.remark_date DESC, tr.created_at DESC';
    const remarks = await db.query(query, queryParams);
    res.json({ success: true, data: remarks });
  } catch (error) {
    console.error('Get task remarks error:', error);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Failed to fetch task remarks' } });
  }
};

const deleteTaskRemark = async (req, res) => {
  try {
    const { remarkId } = req.params;
    const remarks = await db.query('SELECT * FROM task_remarks WHERE id = ?', [remarkId]);
    if (remarks.length === 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task remark not found' } });
    await db.query('DELETE FROM task_remarks WHERE id = ?', [remarkId]);
    res.json({ success: true, message: 'Task remark deleted successfully' });
  } catch (error) {
    console.error('Delete task remark error:', error);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Failed to delete task remark' } });
  }
};

// Get notifications for admin dashboard
const getNotifications = async (req, res) => {
  try {
    const [extensions, remarks] = await Promise.all([
      db.query(`
        SELECT te.id, te.task_id, te.requested_by, te.requested_by_type, te.current_due_date, te.requested_due_date, te.reason, te.status, te.created_at,
          t.name as task_name, p.name as project_name,
          CASE WHEN te.requested_by_type = 'team' THEN tm.name WHEN te.requested_by_type = 'admin' THEN au.name ELSE 'Unknown User' END as requester_name
        FROM task_extensions te
        JOIN tasks t ON te.task_id = t.id JOIN projects p ON t.project_id = p.id
        LEFT JOIN team_members tm ON te.requested_by = tm.id LEFT JOIN admin_users au ON te.requested_by = au.id
        WHERE te.status = 'pending' ORDER BY te.created_at DESC
      `),
      db.query(`
        SELECT tr.id, tr.task_id, tr.added_by, tr.added_by_type, tr.remark_date, tr.remark, tr.remark_type, tr.is_private, tr.server_location, tr.file_name, tr.created_at,
          t.name as task_name, t.status as task_status, p.name as project_name,
          CASE WHEN tr.added_by_type = 'team' THEN tm.name WHEN tr.added_by_type = 'admin' THEN au.name ELSE 'Unknown User' END as user_name
        FROM task_remarks tr
        JOIN tasks t ON tr.task_id = t.id JOIN projects p ON t.project_id = p.id
        LEFT JOIN admin_users au ON tr.added_by = au.id LEFT JOIN team_members tm ON tr.added_by = tm.id
        WHERE tr.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          AND (tr.remark_type != 'complete' OR (tr.remark_type = 'complete' AND tr.id = (
            SELECT tr2.id FROM task_remarks tr2 WHERE tr2.task_id = tr.task_id AND tr2.added_by = tr.added_by AND tr2.added_by_type = tr.added_by_type AND tr2.remark_type = 'complete' ORDER BY tr2.created_at DESC LIMIT 1
          )))
        ORDER BY tr.created_at DESC LIMIT 50
      `),
    ]);

    res.json({
      success: true,
      data: {
        extensions: extensions.map(ext => ({ ...ext, type: 'extension_request', is_new: true })),
        remarks: remarks.map(r => ({ ...r, type: 'remark', is_new: true })),
      },
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications', error: error.message });
  }
};

// Get notifications for team members
const getTeamNotifications = async (req, res) => {
  try {
    const teamMemberId = req.user.id;

    const tasks = await db.query(`SELECT t.id, t.name as task_name, t.project_id, t.end_date FROM tasks t JOIN task_assignees ta ON t.id = ta.task_id WHERE ta.assignee_id = ? AND ta.assignee_type = 'team'`, [teamMemberId]);

    if (tasks.length === 0) return res.json({ success: true, data: { extensions: [], remarks: [], completedTasks: [] } });

    const taskIds = tasks.map(t => t.id);
    const taskIdsPlaceholder = taskIds.map(() => '?').join(',');

    const [extensions, remarks, completedTasks] = await Promise.all([
      db.query(`
        SELECT te.*, t.name as task_name, p.name as project_name,
          CASE WHEN te.requested_by_type = 'team' THEN tm.name WHEN te.requested_by_type = 'admin' THEN au.name ELSE 'Unknown User' END as requester_name,
          CASE WHEN te.reviewed_by IS NOT NULL THEN admin_reviewer.name ELSE NULL END as reviewer_name,
          CASE WHEN te.status = 'approved' THEN '✅ Extension Approved' WHEN te.status = 'rejected' THEN '❌ Extension Rejected' WHEN te.status = 'pending' THEN '⏳ Extension Pending' ELSE te.status END as status_display
        FROM task_extensions te JOIN tasks t ON te.task_id = t.id JOIN projects p ON t.project_id = p.id
        LEFT JOIN team_members tm ON te.requested_by = tm.id LEFT JOIN admin_users au ON te.requested_by = au.id
        LEFT JOIN admin_users admin_reviewer ON te.reviewed_by = admin_reviewer.id
        WHERE te.task_id IN (${taskIdsPlaceholder}) ORDER BY te.created_at DESC
      `, taskIds),
      db.query(`
        SELECT tr.*, t.name as task_name, p.name as project_name,
          CASE WHEN tr.added_by_type = 'team' THEN tm.name WHEN tr.added_by_type = 'admin' THEN au.name ELSE 'Unknown User' END as user_name,
          CASE WHEN tr.added_by_type = 'admin' THEN '👑 Admin Remark' WHEN tr.added_by_type = 'team' THEN '👤 Team Remark' ELSE 'Remark' END as remark_type_display
        FROM task_remarks tr JOIN tasks t ON tr.task_id = t.id JOIN projects p ON t.project_id = p.id
        LEFT JOIN admin_users au ON tr.added_by = au.id LEFT JOIN team_members tm ON tr.added_by = tm.id
        WHERE tr.task_id IN (${taskIdsPlaceholder})
          AND (tr.remark_type != 'complete' OR (tr.remark_type = 'complete' AND tr.id = (
            SELECT tr2.id FROM task_remarks tr2 WHERE tr2.task_id = tr.task_id AND tr2.added_by = tr.added_by AND tr2.added_by_type = tr.added_by_type AND tr2.remark_type = 'complete' ORDER BY tr2.created_at DESC LIMIT 1
          )))
        ORDER BY tr.created_at DESC
      `, taskIds),
      db.query(`
        SELECT DISTINCT t.id as task_id, t.name as task_name, t.status, t.updated_at as completed_at, p.name as project_name,
          g.name as grade_name, b.name as book_name, u.name as unit_name, l.name as lesson_name, cs.name as stage_name,
          tm.name as completed_by_name, tm.id as completed_by_id
        FROM tasks t JOIN projects p ON t.project_id = p.id
        LEFT JOIN grades g ON t.grade_id = g.id LEFT JOIN books b ON t.book_id = b.id LEFT JOIN units u ON t.unit_id = u.id
        LEFT JOIN lessons l ON t.lesson_id = l.id LEFT JOIN category_stages cs ON t.category_stage_id = cs.id
        LEFT JOIN task_assignees ta ON t.id = ta.task_id AND ta.assignee_type = 'team'
        LEFT JOIN team_members tm ON ta.assignee_id = tm.id
        WHERE t.status = 'completed' AND t.updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND ta.assignee_id = ? AND ta.assignee_type = 'team'
        ORDER BY t.updated_at DESC LIMIT 50
      `, [teamMemberId]),
    ]);

    const now = Date.now();
    res.json({
      success: true,
      data: {
        extensions: extensions.map(ext => ({ ...ext, type: 'extension_request', is_new: ext.status === 'pending' || (ext.reviewed_at && new Date(ext.reviewed_at) > new Date(now - 86400000)) })),
        remarks: remarks.map(r => ({ ...r, type: 'remark', is_new: new Date(r.created_at) > new Date(now - 86400000) })),
        completedTasks: completedTasks.map(task => {
          const parts = [task.grade_name, task.book_name, task.unit_name, task.lesson_name].filter(Boolean);
          return { id: `completed_${task.task_id}_${task.completed_by_id}`, type: 'task_completed', task_id: task.task_id, task_name: task.task_name, project_name: task.project_name, completed_by_name: task.completed_by_name, completed_by_id: task.completed_by_id, completed_at: task.completed_at, hierarchy: parts.join(' > ') || 'No hierarchy', stage_name: task.stage_name || 'No stage', is_new: new Date(task.completed_at) > new Date(now - 86400000) };
        }),
      },
    });
  } catch (error) {
    console.error('Error fetching team notifications:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch team notifications', error: error.message });
  }
};

// Approve or deny task completion (admin only)
const reviewTaskCompletion = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { action, review_notes, resubmission_deadline: resubmissionDeadlineInput } = req.body;
    const reviewerId = req.user?.id;

    if (!req.user) return res.status(403).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Only admins can review task completions' } });
    if (!['approve', 'deny'].includes(action)) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Action must be either "approve" or "deny"' } });

    const tasks = await db.query('SELECT * FROM tasks WHERE id = ? AND status = "under-review"', [taskId]);
    if (tasks.length === 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found or not under review' } });

    const previousStatus = tasks[0].status;
    const newStatus = action === 'approve' ? 'completed' : 'returned';
    const calculatedProgress = calculateTaskProgress(newStatus);
    let reworkCount = Number(tasks[0].rework_count) || 0;
    let responseStatus = newStatus;
    let savedResubmissionDeadline = null;

    if (action === 'deny' && resubmissionDeadline.isEnabled()) {
      const validation = resubmissionDeadline.validateDeadline(resubmissionDeadlineInput);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: { code: validation.code || 'VALIDATION_ERROR', message: validation.message },
        });
      }
      savedResubmissionDeadline = validation.mysqlDatetime;
    }

    await remarkHistory.runInTransaction(async (conn) => {
      if (action === 'deny' && reworkService.isSubmittedStatus(previousStatus)) {
        const reworkResult = await reworkService.incrementRework(conn, {
          taskId: Number(taskId),
          adminUser: req.user,
          previousStatus,
          reviewNotes: review_notes,
          mysqlDeadline: savedResubmissionDeadline,
          resubmissionSetBy: reviewerId,
        });
        if (!reworkResult.incremented) {
          const err = new Error('TASK_NOT_SUBMITTED');
          err.code = 'TASK_NOT_SUBMITTED';
          throw err;
        }
        reworkCount = reworkResult.reworkCount;
        responseStatus = 'returned';
        savedResubmissionDeadline = reworkResult.resubmissionDeadline ?? savedResubmissionDeadline;
      } else {
        await conn.execute(
          'UPDATE tasks SET status = ?, progress = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newStatus, calculatedProgress, taskId]
        );
        if (action === 'approve') {
          await reworkService.resetRework(conn, taskId);
          reworkCount = 0;
        }
        await remarkHistory.logReview(
          req.user,
          Number(taskId),
          action,
          review_notes,
          previousStatus,
          newStatus,
          conn
        );
        responseStatus = newStatus;
      }

      await conn.execute(
        `UPDATE projects p SET progress = (SELECT COALESCE(AVG(t.progress), 0) FROM tasks t WHERE t.project_id = p.id) WHERE p.id = (SELECT project_id FROM tasks WHERE id = ?)`,
        [taskId]
      );
    });

    if (global.notificationServer) {
      try {
        const [assignees, reviewers, taskResult] = await Promise.all([
          db.query(`SELECT tm.id, tm.name, tm.email FROM task_assignees ta JOIN team_members tm ON ta.assignee_id = tm.id WHERE ta.task_id = ? AND ta.assignee_type = 'team' LIMIT 1`, [taskId]),
          db.query('SELECT name FROM admin_users WHERE id = ?', [reviewerId]),
          db.query('SELECT name FROM tasks WHERE id = ?', [taskId]),
        ]);
        if (assignees.length > 0) {
          const notifyPayload = {
            task_id: taskId,
            task_name: taskResult[0]?.name || 'Unknown Task',
            action,
            reviewer_name: reviewers[0]?.name || 'Admin',
            review_notes: review_notes || '',
            assignee_id: assignees[0].id,
            assignee_name: assignees[0].name,
            resubmission_deadline: savedResubmissionDeadline,
            resubmission_deadline_label: savedResubmissionDeadline
              ? resubmissionDeadline.formatDisplayLabel(savedResubmissionDeadline)
              : null,
          };
          if (action === 'deny' && savedResubmissionDeadline) {
            await global.notificationServer.notifyTaskReturnedForRework?.(notifyPayload)
              ?? global.notificationServer.notifyTaskReview(notifyPayload);
          } else {
            await global.notificationServer.notifyTaskReview(notifyPayload);
          }
        }
      } catch (notificationError) {
        console.error('Failed to send task review notification:', notificationError);
      }
    }

    emitProjectTaskUpdate(tasks[0].project_id, taskId, 'updated');

    const remaining = savedResubmissionDeadline
      ? resubmissionDeadline.formatRemainingTime(savedResubmissionDeadline)
      : { text: '', overdue: false };

    res.json({
      success: true,
      message: `Task ${action}d successfully`,
      data: {
        taskId: Number(taskId),
        task_id: taskId,
        status: responseStatus,
        new_status: responseStatus,
        action,
        reworkCount,
        reworkSeverity: reworkService.getReworkSeverity(reworkCount),
        resubmissionDeadline: savedResubmissionDeadline,
        remainingTime: remaining.text,
        resubmissionOverdue: remaining.overdue,
      },
    });
  } catch (error) {
    console.error('Review task completion error:', error);
    if (error.code === 'TASK_NOT_SUBMITTED') {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found or not under review' } });
    }
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Failed to review task completion' } });
  }
};

// =====================================================
// BULK UPLOAD TASKS FROM EXCEL/CSV
// =====================================================

const VALID_STATUSES = ['not-started', 'in-progress', 'under-review', 'completed', 'blocked', 'skipped', 'returned', 'redo-requested', 'resubmitted', 'on-hold'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const bulkUploadTasks = async (req, res) => {
  const tasks = req.body;

  if (!Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({ success: false, error: 'Request body must be a non-empty array of tasks' });
  }

  if (tasks.length > 500) {
    return res.status(400).json({ success: false, error: 'Maximum 500 tasks allowed per upload' });
  }

  // Get a connection from the pool for transaction
  const pool = db.getPool();
  const connection = await pool.getConnection();

  // Collect row-level errors before touching DB
  const rowErrors = [];

  // Pre-validate all rows
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const row = task.rowIndex || (i + 2);

    if (!task['Task Name']?.toString().trim()) {
      rowErrors.push({ row, error: 'Task Name is required' });
    }
    if (!task['Project']?.toString().trim()) {
      rowErrors.push({ row, error: 'Project is required' });
    }
    if (!task['Grade']?.toString().trim()) {
      rowErrors.push({ row, error: 'Grade is required' });
    }
    if (!task['Book']?.toString().trim()) {
      rowErrors.push({ row, error: 'Book is required' });
    }
    if (!task['Unit']?.toString().trim()) {
      rowErrors.push({ row, error: 'Unit is required' });
    }
    if (!task['Lesson']?.toString().trim()) {
      rowErrors.push({ row, error: 'Lesson is required' });
    }
    if (task['Status'] && !VALID_STATUSES.includes(task['Status'].toString().toLowerCase().trim().replace(/\s+/g, '-'))) {
      rowErrors.push({ row, error: `Invalid Status "${task['Status']}"` });
    }
    if (task['Priority'] && !VALID_PRIORITIES.includes(task['Priority'].toString().toLowerCase().trim().replace(/\s+/g, '-'))) {
      rowErrors.push({ row, error: `Invalid Priority "${task['Priority']}"` });
    }
  }

  if (rowErrors.length > 0) {
    connection.release();
    return res.status(400).json({ success: false, errors: rowErrors });
  }

  // Use a transaction via connection
  try {
    // Start transaction using connection.query (not execute)
    await connection.query('START TRANSACTION');

    let created = 0;
    const createdBy = req.user?.id || req.teamMember?.id || 1;
    const today = getTodayIST();
    const defaultDue = formatDateIST(new Date(Date.now() + 7 * 86400000));

    // Normalize various dash/hyphen Unicode variants to a plain hyphen for fuzzy matching
    const normalizeName = (s) => s
      .replace(/[\u2013\u2014\u2012\u2010\u2011\uFE58\uFE63\uFF0D]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    // Pre-fetch all projects once (avoid N queries in the loop)
    const [allProjects] = await connection.execute('SELECT id, name FROM projects');
    console.log('[BulkUpload] Projects in DB:', allProjects.map(p => ({ id: p.id, name: p.name, hex: Buffer.from(p.name).toString('hex').substring(0, 40) })));

    // Pre-fetch all stages with their project associations (cache by projectId)
    const [allStages] = await connection.execute(
      `SELECT cs.id, cs.name, p.id as project_id
       FROM category_stages cs
       INNER JOIN stage_templates st ON cs.id = st.stage_id
       INNER JOIN projects p ON p.category_id = st.category_id`
    );
    // Group stages by project_id for O(1) lookup
    const stagesByProject = {};
    for (const s of allStages) {
      if (!stagesByProject[s.project_id]) stagesByProject[s.project_id] = [];
      stagesByProject[s.project_id].push(s);
    }

    let allGrades = [];
    let allBooks = [];
    let allUnits = [];
    let allLessons = [];
    try {
      [allGrades] = await connection.execute('SELECT id, name, project_id FROM grades');
      [allBooks] = await connection.execute('SELECT id, name, grade_id FROM books');
      [allUnits] = await connection.execute('SELECT id, name, book_id FROM units');
      [allLessons] = await connection.execute('SELECT id, name, unit_id FROM lessons');
    } catch (catalogError) {
      console.error('[BulkUpload] Hierarchy catalog load failed:', catalogError.message);
      await connection.query('ROLLBACK');
      connection.release();
      return res.status(400).json({
        success: false,
        errors: [{ row: 0, error: 'Educational hierarchy data could not be loaded. Please try again.' }],
      });
    }
    const hierarchyCatalogs = { grades: allGrades, books: allBooks, units: allUnits, lessons: allLessons };

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const row = task.rowIndex || (i + 2);

      // Resolve project (case-insensitive, trim-safe, dash-normalized)
      const projectName = task['Project'].toString().trim();
      console.log(`[BulkUpload] Row ${row} project name: "${projectName}" hex: ${Buffer.from(projectName).toString('hex').substring(0, 40)}`);
      const matchedProject = allProjects.find(p => {
        const dbNorm = normalizeName(p.name);
        const excelNorm = normalizeName(projectName);
        // 1) Exact normalized match
        if (dbNorm === excelNorm) return true;
        // 2) Word-overlap: names share ≥75% of significant words
        //    e.g. "UAE Citizen / Digital Citizen I-JAE" vs "UAE Citizen / Digital Citizen UAE" → 80% → match
        //    "Apex" vs "Apex LMS" → only 50% → no match (prevents false positives)
        const dbWords = new Set(dbNorm.split(/\s+/).filter(w => w.length > 2));
        const excelWords = excelNorm.split(/\s+/).filter(w => w.length > 2);
        if (dbWords.size > 0 && excelWords.length > 0) {
          const matchedWords = excelWords.filter(w => dbWords.has(w)).length;
          const overlapRatio = matchedWords / Math.max(dbWords.size, excelWords.length);
          if (overlapRatio >= 0.75) return true;
        }
        return false;
      });
      const projects = matchedProject ? [matchedProject] : [];
      if (!projects.length) {
        // Find closest project name for a helpful error message
        const excelNorm = normalizeName(projectName);
        const closest = allProjects.reduce((best, p) => {
          const dbNorm = normalizeName(p.name);
          // Count matching leading characters as a simple similarity score
          let score = 0;
          const minLen = Math.min(dbNorm.length, excelNorm.length);
          for (let c = 0; c < minLen; c++) {
            if (dbNorm[c] === excelNorm[c]) score++;
            else break;
          }
          return score > best.score ? { name: p.name, score } : best;
        }, { name: null, score: 0 });
        const hint = closest.name ? ` Did you mean "${closest.name}"?` : '';
        await connection.query('ROLLBACK');
        connection.release();
        return res.status(400).json({ success: false, errors: [{ row, error: `Project not found: "${projectName}".${hint}` }] });
      }
      const projectId = projects[0].id;

      // Resolve stage (optional — null if not provided)
      let stageId = null;
      if (task['Stage']?.toString().trim()) {
        const stageName = task['Stage'].toString().trim();
        const normalizedStageName = normalizeName(stageName);
        // Use pre-fetched cache — no extra DB query per row
        const projectStages = stagesByProject[projectId] || [];
        console.log(`[BulkUpload] Row ${row} stage lookup: "${stageName.substring(0, 60)}..." normalized: "${normalizedStageName.substring(0, 60)}"`);
        console.log(`[BulkUpload] Available stages for project ${projectId}:`, projectStages.map(s => `"${normalizeName(s.name).substring(0, 60)}"`));
        // 1) Exact normalized match
        // 2) Fallback: Excel cell starts with the DB stage name (handles "Core Development - Build the..." → "Core Development")
        // 3) Fallback: DB stage name starts with the Excel value (handles truncated Excel values)
        const matchedStage = projectStages.find(s => {
          const dbNorm = normalizeName(s.name);
          return dbNorm === normalizedStageName ||
                 normalizedStageName.startsWith(dbNorm + ' -') ||
                 normalizedStageName.startsWith(dbNorm + ':') ||
                 normalizedStageName.startsWith(dbNorm + ' –') ||
                 dbNorm.startsWith(normalizedStageName);
        });
        if (!matchedStage) {
          await connection.query('ROLLBACK');
          connection.release();
          return res.status(400).json({ success: false, errors: [{ row, error: `Stage "${stageName}" not found for project "${projectName}"` }] });
        }
        stageId = matchedStage.id;
        console.log(`[BulkUpload] Row ${row} stage matched: id=${stageId}`);
      }

      const hierarchy = resolveHierarchyIds({
        projectId,
        projectName,
        task,
        catalogs: hierarchyCatalogs,
      });
      if (hierarchy.error) {
        await connection.query('ROLLBACK');
        connection.release();
        return res.status(400).json({ success: false, errors: [{ row, error: hierarchy.error }] });
      }
      const { gradeId, bookId, unitId, lessonId } = hierarchy;

      const status = (task['Status'] || 'not-started').toString().toLowerCase().trim().replace(/\s+/g, '-');
      const priority = (task['Priority'] || 'medium').toString().toLowerCase().trim().replace(/\s+/g, '-');
      const estimatedHours = parseInt(task['Estimated Hours']) || 0;

      // Normalize date to YYYY-MM-DD regardless of input format (M/D/YYYY, YYYY-MM-DD, etc.)
      const parseDateToYMD = (val) => {
        if (!val) return null;
        const s = val.toString().trim();
        if (!s) return null;
        // Already YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        // M/D/YYYY or MM/DD/YYYY
        const mdyMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (mdyMatch) {
          const [, m, d, y] = mdyMatch;
          return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        // Fallback: parse and format using IST helper
        const parsed = new Date(s);
        if (!isNaN(parsed.getTime())) return formatDateIST(parsed);
        return null;
      };

      const startDate = parseDateToYMD(task['Start Date']) || today;
      const endDate = parseDateToYMD(task['Due Date']) || defaultDue;
      const progress = calculateTaskProgress(status) ?? 0;
      const serverLocation = task['File Location']?.toString().trim() || null;

      const [result] = await connection.execute(
        `INSERT INTO tasks (name, description, project_id, category_stage_id, status, priority, start_date, end_date, progress, estimated_hours, server_location, created_by, grade_id, book_id, unit_id, lesson_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          task['Task Name'].toString().trim(),
          task['Description']?.toString().trim() || null,
          projectId, stageId, status, priority,
          startDate, endDate, progress, estimatedHours, serverLocation, createdBy,
          gradeId, bookId, unitId, lessonId,
        ]
      );
      const taskId = result.insertId;

      // Resolve and assign users by email
      if (task['Assignees']?.toString().trim()) {
        const emails = task['Assignees'].toString().split(',').map(e => e.trim()).filter(Boolean);
        for (const email of emails) {
          const [teamUsers] = await connection.execute('SELECT id FROM team_members WHERE email = ? AND is_active = 1', [email]);
          if (teamUsers.length) {
            await connection.execute('INSERT IGNORE INTO task_assignees (task_id, assignee_id, assignee_type) VALUES (?, ?, ?)', [taskId, teamUsers[0].id, 'team']);
          } else {
            const [adminUsers] = await connection.execute('SELECT id FROM admin_users WHERE email = ?', [email]);
            if (adminUsers.length) {
              await connection.execute('INSERT IGNORE INTO task_assignees (task_id, assignee_id, assignee_type) VALUES (?, ?, ?)', [taskId, adminUsers[0].id, 'admin']);
            }
          }
        }
      }

      created++;
    }

    // Recalculate progress for all affected projects
    const projectNames = [...new Set(tasks.map(t => t['Project']?.toString().trim()).filter(Boolean))];
    const normalizeDashes = (s) => s.replace(/[\u2013\u2014\u2012]/g, '-');
    const [allProjectsForProgress] = await connection.execute('SELECT id, name FROM projects');
    for (const name of projectNames) {
      const normalizedName = normalizeDashes(name).toLowerCase();
      const matched = allProjectsForProgress.find(p => normalizeDashes(p.name.trim()).toLowerCase() === normalizedName);
      if (matched) await recalculateProjectProgress(matched.id);
    }

    await connection.query('COMMIT');
    connection.release();
    
    console.log(`[BulkUpload] Successfully created ${created} tasks`);
    console.log(`[BulkUpload] Transaction committed at ${new Date().toISOString()}`);
    
    res.status(200).json({ success: true, created, message: `${created} task${created !== 1 ? 's' : ''} uploaded successfully` });

  } catch (error) {
    try { 
      await connection.query('ROLLBACK');
      connection.release();
    } catch (_) {}
    console.error('Bulk upload tasks error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to upload tasks' });
  }
};

// =====================================================
// BULK UPDATE TASK EDUCATIONAL HIERARCHY FROM CSV
// Body: [{ rowIndex, 'Task ID', Grade, Book, Unit, Lesson }]
// Updates only grade_id, book_id, unit_id, lesson_id. Empty cells keep existing values.
// =====================================================
const bulkUpdateTaskHierarchy = async (req, res) => {
  const rows = req.body;
  const isPreview = String(req.query.preview || '') === '1' || String(req.query.preview || '') === 'true';
  const failMessage = isPreview
    ? 'Preview validation failed. No changes were applied.'
    : 'Educational Hierarchy Update Failed. No changes were applied.';

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ success: false, error: 'Request body must be a non-empty array of rows' });
  }

  if (rows.length > 500) {
    return res.status(400).json({ success: false, error: 'Maximum 500 rows allowed per upload' });
  }

  const rowErrors = [];
  const parsed = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = row.rowIndex || (i + 2);
    const rawId = row['Task ID'] ?? row.task_id ?? row.taskId;
    const taskId = parseInt(rawId, 10);

    if (rawId === undefined || rawId === null || String(rawId).trim() === '') {
      rowErrors.push({ row: rowNum, error: 'Task ID is required for hierarchy update.' });
      continue;
    }
    if (isNaN(taskId) || taskId < 1) {
      rowErrors.push({ row: rowNum, error: `Task ID "${rawId}" was not found.` });
      continue;
    }
    parsed.push({ rowNum, taskId, row });
  }

  if (parsed.length === 0) {
    return res.status(400).json({
      success: false,
      preview: isPreview,
      updated: 0,
      skipped: 0,
      total: rows.length,
      errors: rowErrors,
      foundTasks: [],
      message: failMessage,
    });
  }

  const pool = db.getPool();
  const connection = await pool.getConnection();

  try {
    let allGrades = [];
    let allBooks = [];
    let allUnits = [];
    let allLessons = [];
    try {
      [allGrades] = await connection.execute('SELECT id, name, project_id FROM grades');
      [allBooks] = await connection.execute('SELECT id, name, grade_id FROM books');
      [allUnits] = await connection.execute('SELECT id, name, book_id FROM units');
      [allLessons] = await connection.execute('SELECT id, name, unit_id FROM lessons');
    } catch (catalogError) {
      console.error('[HierarchyUpdate] Catalog load failed:', catalogError.message);
      connection.release();
      return res.status(400).json({
        success: false,
        preview: isPreview,
        updated: 0,
        skipped: 0,
        total: rows.length,
        errors: [{ row: 0, error: 'Educational hierarchy data could not be loaded. Please try again.' }],
        foundTasks: [],
        message: failMessage,
      });
    }

    const catalogs = { grades: allGrades, books: allBooks, units: allUnits, lessons: allLessons };
    const uniqueIds = [...new Set(parsed.map((p) => p.taskId))];
    const placeholders = uniqueIds.map(() => '?').join(',');
    const [taskRows] = uniqueIds.length
      ? await connection.execute(
          `SELECT t.id, t.name, t.project_id, t.grade_id, t.book_id, t.unit_id, t.lesson_id, p.name as project_name
           FROM tasks t
           LEFT JOIN projects p ON p.id = t.project_id
           WHERE t.id IN (${placeholders})`,
          uniqueIds
        )
      : [[]];
    const tasksById = {};
    for (const t of taskRows) tasksById[Number(t.id)] = t;
    const foundTasks = Object.values(tasksById).map((t) => ({ id: Number(t.id), name: t.name }));

    const updates = [];
    for (const item of parsed) {
      const existingTask = tasksById[item.taskId];
      if (!existingTask) {
        rowErrors.push({ row: item.rowNum, error: `Task ID "${item.taskId}" was not found.` });
        continue;
      }

      const hierarchy = resolveHierarchyUpdateIds({
        projectId: existingTask.project_id,
        projectName: existingTask.project_name || '',
        task: item.row,
        catalogs,
        existing: {
          gradeId: existingTask.grade_id,
          bookId: existingTask.book_id,
          unitId: existingTask.unit_id,
          lessonId: existingTask.lesson_id,
        },
      });

      if (hierarchy.error) {
        rowErrors.push({ row: item.rowNum, error: `Task ID ${item.taskId}: ${hierarchy.error}` });
        continue;
      }

      updates.push({
        id: item.taskId,
        gradeId: hierarchy.gradeId,
        bookId: hierarchy.bookId,
        unitId: hierarchy.unitId,
        lessonId: hierarchy.lessonId,
      });
    }

    if (rowErrors.length > 0) {
      connection.release();
      return res.status(400).json({
        success: false,
        preview: isPreview,
        updated: 0,
        skipped: 0,
        total: rows.length,
        errors: rowErrors,
        foundTasks,
        message: failMessage,
      });
    }

    if (isPreview) {
      connection.release();
      return res.status(200).json({
        success: true,
        preview: true,
        updated: 0,
        skipped: 0,
        total: rows.length,
        errors: [],
        foundTasks,
        message: 'Preview only. No changes were applied.',
      });
    }

    await connection.query('START TRANSACTION');

    for (const upd of updates) {
      await connection.execute(
        `UPDATE tasks SET grade_id = ?, book_id = ?, unit_id = ?, lesson_id = ? WHERE id = ?`,
        [upd.gradeId, upd.bookId, upd.unitId, upd.lessonId, upd.id]
      );
    }

    await connection.query('COMMIT');
    connection.release();

    res.status(200).json({
      success: true,
      updated: updates.length,
      skipped: 0,
      total: rows.length,
      errors: [],
      message: `Educational Hierarchy Update Complete. Updated: ${updates.length}.`,
    });
  } catch (error) {
    try {
      await connection.query('ROLLBACK');
      connection.release();
    } catch (_) {}
    console.error('Bulk update task hierarchy error:', error);
    res.status(500).json({
      success: false,
      updated: 0,
      skipped: 0,
      total: rows.length,
      error: error.message || 'Failed to update task hierarchy',
      message: 'Educational Hierarchy Update Failed. No changes were applied.',
    });
  }
};

// =====================================================
// BULK ASSIGN: Assign multiple unassigned tasks to a team member
// POST /api/tasks/bulk-assign
// Body: { assignee_id, assignee_type, task_ids (optional — if omitted, assigns ALL unassigned tasks) }
// =====================================================
const bulkAssignTasks = async (req, res) => {
  try {
    const { assignee_id, assignee_type, task_ids, project_id } = req.body;

    if (!assignee_id) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'assignee_id is required' } });
    }

    // Validate assignee exists
    const table = assignee_type === 'admin' ? 'admin_users' : 'team_members';
    const assigneeRows = await db.query(`SELECT id FROM ${table} WHERE id = ?`, [assignee_id]);
    if (assigneeRows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Assignee not found in ${table}` } });
    }
    const resolvedType = assignee_type === 'admin' ? 'admin' : 'team';

    let targetTaskIds;

    if (task_ids && Array.isArray(task_ids) && task_ids.length > 0) {
      // Assign specific tasks
      targetTaskIds = task_ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id) && id > 0);
    } else {
      // Assign ALL unassigned tasks (optionally filtered by project)
      let unassignedQuery = `
        SELECT t.id FROM tasks t
        LEFT JOIN task_assignees ta ON t.id = ta.task_id
        WHERE ta.task_id IS NULL
      `;
      const queryParams = [];
      if (project_id) {
        unassignedQuery += ' AND t.project_id = ?';
        queryParams.push(parseInt(project_id, 10));
      }
      const unassignedTasks = await db.query(unassignedQuery, queryParams);
      targetTaskIds = unassignedTasks.map(t => t.id);
    }

    if (targetTaskIds.length === 0) {
      return res.json({ success: true, message: 'No tasks to assign', assigned_count: 0 });
    }

    // Batch insert into task_assignees, skipping already-assigned tasks
    const BATCH_SIZE = 500;
    let totalAssigned = 0;

    for (let i = 0; i < targetTaskIds.length; i += BATCH_SIZE) {
      const batch = targetTaskIds.slice(i, i + BATCH_SIZE);
      const placeholders = batch.map(() => '(?, ?, ?)').join(',');
      const params = batch.flatMap(taskId => [taskId, assignee_id, resolvedType]);
      // INSERT IGNORE skips duplicates (tasks already assigned to this person)
      const result = await db.insert(
        `INSERT IGNORE INTO task_assignees (task_id, assignee_id, assignee_type) VALUES ${placeholders}`,
        params
      );
      totalAssigned += result.affectedRows || 0;
    }

    if (targetTaskIds.length > 0) {
      try {
        const placeholders = targetTaskIds.map(() => '?').join(',');
        const projectRows = await db.query(
          `SELECT DISTINCT project_id FROM tasks WHERE id IN (${placeholders})`,
          targetTaskIds
        );
        for (const row of projectRows) {
          if (!row.project_id) continue;
          if (resolvedType === 'team') {
            try {
              await ensureTeamMembersOnProject(row.project_id, [assignee_id]);
            } catch (membershipError) {
              console.error('Failed to add bulk assignee to project team:', membershipError);
            }
          }
          emitProjectTaskUpdate(row.project_id, assignee_id, 'assigned');
        }
      } catch (bulkSideEffectError) {
        console.error('Failed bulk assign project side effects:', bulkSideEffectError);
      }
    }

    return res.json({
      success: true,
      message: `Successfully assigned ${totalAssigned} task(s) to assignee ${assignee_id}`,
      assigned_count: totalAssigned,
      total_targeted: targetTaskIds.length,
    });

  } catch (error) {
    console.error('Bulk assign tasks error:', error);
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Failed to bulk assign tasks', details: error.message } });
  }
};

module.exports = {
  getTasks, getTask, createTask, updateTask, deleteTask, bulkDeleteTasks,
  testStageFilter, getBulkCreatePreview, bulkCreateTasks,
  requestTaskExtension, getTaskExtensions, reviewExtensionRequest,
  addTaskRemark, getTaskRemarks, getTaskRemarksHistory, deleteTaskRemark,
  getNotifications, getTeamNotifications, reviewTaskCompletion,
  bulkUploadTasks, bulkUpdateTaskHierarchy, bulkAssignTasks,
};
