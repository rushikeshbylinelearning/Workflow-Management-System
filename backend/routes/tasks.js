const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const remarkSubmitRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT', message: 'Too many remarks submitted. Please wait a moment.' },
  },
});
const {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  bulkDeleteTasks,
  testStageFilter,
  getBulkCreatePreview,
  bulkCreateTasks,
  bulkUploadTasks,
  bulkTagTasks,
  bulkUpdateTasks,
  bulkAssignTasks,
  bulkUpdateTaskStatus,
  bulkReassignTasks,
  bulkUpdateTaskDates,
  bulkApproveTasks,
  // Extension endpoints
  requestTaskExtension,
  getTaskExtensions,
  reviewExtensionRequest,
  // Remark endpoints
  addTaskRemark,
  getBulkRemarkDefaults,
  bulkAddTaskRemarks,
  getTaskRemarks,
  deleteTaskRemark,
  getNotifications,
  getTeamNotifications,
  reviewTaskCompletion,
  getTaskRemarksHistory,
} = require('../controllers/taskController');
const { getDashboardSummary } = require('../controllers/taskSummaryController');
const { exportTasks, exportSelectedTasks } = require('../controllers/taskExportController');
const {
  startTaskTimer,
  pauseTaskTimer,
  resumeTaskTimer,
  completeTaskTimer,
  getTaskTime,
  getTimerStatus
} = require('../controllers/timeTrackingController');
const { requireAuth, requireTeamAuth, requireAdminOrPMAuth } = require('../middleware/auth');
const { body, param, query, validationResult } = require('express-validator');
const {
  stripHtml,
  REMARK_MAX_PLAIN_LENGTH,
  REMARK_MAX_HTML_LENGTH,
} = require('../utils/sanitizeRemark');

const TASK_ROUTE_STATUSES = [
  'not-started', 'in-progress', 'under-review', 'completed', 'blocked', 'skipped', 'on-hold',
  'returned', 'redo-requested', 'resubmitted',
];

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        details: errors.array()
      }
    });
  }
  next();
};

// Task validation rules
const taskValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Task name is required')
    .isLength({ max: 255 })
    .withMessage('Task name must not exceed 255 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Description must not exceed 5000 characters'),
  
  body('project_id')
    .isInt({ min: 1 })
    .withMessage('Project ID must be a positive integer'),
  
  body('category_stage_id')
    .isInt({ min: 1 })
    .withMessage('Category Stage ID must be a positive integer'),
  
  body('status')
    .optional()
    .isIn(TASK_ROUTE_STATUSES)
    .withMessage(`Status must be one of: ${TASK_ROUTE_STATUSES.join(', ')}`),
  
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be one of: low, medium, high, urgent'),
  
  body('start_date')
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  
  body('end_date')
    .isISO8601()
    .withMessage('End date must be a valid date'),
  
  body('progress')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Progress must be between 0 and 100'),
  
  body('estimated_hours')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Estimated hours must be a positive number'),
  
  body('component_path')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Component path must not exceed 1000 characters'),
  
  body('assignees')
    .optional()
    .isArray()
    .withMessage('Assignees must be an array'),
  
  body('assignees.*.id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Assignee ID must be a positive integer'),
  
  body('assignees.*.type')
    .optional()
    .isIn(['admin', 'team'])
    .withMessage('Assignee type must be admin or team'),
  
  body('skills')
    .optional()
    .isArray()
    .withMessage('Skills must be an array'),
  
  body('skills.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Each skill ID must be a positive integer')
];

const taskUpdateValidation = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Task name cannot be empty')
    .isLength({ max: 255 })
    .withMessage('Task name must not exceed 255 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Description must not exceed 5000 characters'),
  
  body('status')
    .optional()
    .isIn(TASK_ROUTE_STATUSES)
    .withMessage(`Status must be one of: ${TASK_ROUTE_STATUSES.join(', ')}`),
  
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be one of: low, medium, high, urgent'),
  
  body('start_date')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  
  body('end_date')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date'),
  
  body('progress')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Progress must be between 0 and 100'),
  
  body('estimated_hours')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Estimated hours must be a positive number'),
  
  body('actual_hours')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Actual hours must be a positive number'),
  
  body('component_path')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Component path must not exceed 1000 characters'),
  
  body('assignees')
    .optional()
    .isArray()
    .withMessage('Assignees must be an array'),
  
  body('assignees.*.id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Assignee ID must be a positive integer'),
  
  body('assignees.*.type')
    .optional()
    .isIn(['admin', 'team'])
    .withMessage('Assignee type must be admin or team'),
  
  body('skills')
    .optional()
    .isArray()
    .withMessage('Skills must be an array'),
  
  body('skills.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Each skill ID must be a positive integer')
];

const idValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID must be a positive integer')
];

// Query validation for filtering
const queryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('sort')
    .optional()
    .isIn(['name', 'created_at', 'updated_at', 'start_date', 'end_date', 'priority', 'status', 'progress'])
    .withMessage('Sort field must be one of: name, created_at, updated_at, start_date, end_date, priority, status, progress'),
  
  query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Order must be asc or desc'),
  
  query('project_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Project ID must be a positive integer'),
  
  query('status')
    .optional()
    .isIn(TASK_ROUTE_STATUSES)
    .withMessage(`Status must be one of: ${TASK_ROUTE_STATUSES.join(', ')}`),
  
  query('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be one of: low, medium, high, urgent'),
  
  query('assignee_id')
    .optional()
    .custom((value) => {
      if (value === 'none' || (parseInt(value) > 0)) {
        return true;
      }
      throw new Error('Assignee ID must be a positive integer or "none"');
    })
    .withMessage('Assignee ID must be a positive integer or "none"'),

  query('team_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Team ID must be a positive integer'),
  
  query('assignee_type')
    .optional()
    .isIn(['admin', 'team'])
    .withMessage('Assignee type must be admin or team'),
  
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Search term must be between 1 and 255 characters')
];

// Routes

// =====================================================
// DASHBOARD SUMMARY — single aggregated query, no full task list
// =====================================================
// Must be registered BEFORE /:id so the path is not treated as an ID param.
router.get('/dashboard-summary', requireAuth, getDashboardSummary);

// Bulk remark defaults — must be registered BEFORE /:id
router.get('/bulk-remark-defaults',
  requireAuth,
  [
    query('taskIds')
      .notEmpty()
      .withMessage('taskIds is required'),
  ],
  handleValidationErrors,
  getBulkRemarkDefaults
);

// Test stage filter endpoint
router.get('/test/stage-filter', testStageFilter);

// Get bulk create preview
router.get('/project/:project_id/bulk-create-preview',
  requireAdminOrPMAuth,
  [
    param('project_id')
      .isInt({ min: 1 })
      .withMessage('Project ID must be a positive integer')
  ],
  handleValidationErrors,
  getBulkCreatePreview
);

// Bulk create tasks for project hierarchy
router.post('/project/:project_id/bulk-create',
  requireAdminOrPMAuth,
  [
    param('project_id')
      .isInt({ min: 1 })
      .withMessage('Project ID must be a positive integer'),
    body('selected_stage_ids')
      .isArray({ min: 1 })
      .withMessage('At least one stage must be selected'),
    body('selected_stage_ids.*')
      .isInt({ min: 1 })
      .withMessage('Each stage ID must be a positive integer')
  ],
  handleValidationErrors,
  bulkCreateTasks
);

// Bulk upload tasks from Excel/CSV
router.post('/bulk-upload',
  requireAdminOrPMAuth,
  bulkUploadTasks
);

// Bulk tag existing tasks with educational hierarchy by Task ID
router.post('/bulk-tag',
  requireAdminOrPMAuth,
  bulkTagTasks
);

// Bulk update existing tasks by Task ID — never creates tasks
router.post('/bulk-update',
  requireAdminOrPMAuth,
  bulkUpdateTasks
);

router.post('/bulk-remark',
  requireAuth,
  [
    body('updates')
      .isArray({ min: 1, max: 100 })
      .withMessage('updates must be a non-empty array of at most 100 items'),
    body('updates.*.taskId')
      .isInt({ min: 1 })
      .withMessage('Each update must include a positive taskId'),
    body('updates.*.remark')
      .trim()
      .notEmpty()
      .withMessage('Remark is required for each update')
      .custom((value) => {
        if (value.length > REMARK_MAX_HTML_LENGTH) {
          throw new Error(`Remark must not exceed ${REMARK_MAX_HTML_LENGTH} characters`);
        }
        const plainText = stripHtml(value);
        if (!plainText) {
          throw new Error('Remark content is required');
        }
        if (plainText.length > REMARK_MAX_PLAIN_LENGTH) {
          throw new Error(`Remark must not exceed ${REMARK_MAX_PLAIN_LENGTH} characters of text`);
        }
        return true;
      }),
    body('updates.*.stage')
      .optional()
      .isIn(['general', 'complete', 'skipped', 'other'])
      .withMessage('Stage must be one of: general, complete, skipped, other'),
    body('updates.*.fileLocation')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('File location must not exceed 500 characters'),
    body('updates.*.fileName')
      .optional()
      .isString()
      .isLength({ max: 255 })
      .withMessage('File name must not exceed 255 characters'),
  ],
  handleValidationErrors,
  bulkAddTaskRemarks
);

// Export tasks to Excel (all or filtered)
router.get('/export',
  requireAdminOrPMAuth,
  exportTasks
);

// Export selected tasks to Excel
router.post('/export/selected',
  requireAdminOrPMAuth,
  [
    body('taskIds')
      .isArray({ min: 1 })
      .withMessage('taskIds must be a non-empty array'),
    body('taskIds.*')
      .isInt({ min: 1 })
      .withMessage('Each task ID must be a positive integer')
  ],
  handleValidationErrors,
  exportSelectedTasks
);

// Get all tasks
router.get('/', 
  requireAuth,
  queryValidation,
  handleValidationErrors,
  getTasks
);

// Get notifications for admin dashboard
router.get('/notifications', requireAuth, getNotifications);

// Get notifications for team members
router.get('/team/notifications', requireTeamAuth, getTeamNotifications);

// Review task completion (approve/deny)
router.post('/:taskId/review', 
  requireAdminOrPMAuth,
  [
    param('taskId').isInt({ min: 1 }).withMessage('Task ID must be a positive integer'),
    body('action').isIn(['approve', 'deny']).withMessage('Action must be either "approve" or "deny"'),
    body('review_notes').optional().isString().withMessage('Review notes must be a string'),
    body('resubmission_deadline')
      .optional()
      .isISO8601()
      .withMessage('Resubmission deadline must be a valid ISO 8601 date-time'),
  ],
  handleValidationErrors,
  reviewTaskCompletion
);

// Immutable review & remarks timeline (paginated)
router.get('/:taskId/remarks-history',
  requireAuth,
  [
    param('taskId').isInt({ min: 1 }).withMessage('Task ID must be a positive integer'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  ],
  handleValidationErrors,
  getTaskRemarksHistory
);

// Get task by ID
router.get('/:id',
  requireAuth,
  idValidation,
  handleValidationErrors,
  getTask
);

// Create new task
router.post('/',
  requireAdminOrPMAuth,
  taskValidation,
  handleValidationErrors,
  createTask
);

// Update task
router.put('/:id',
  requireAuth,
  idValidation,
  taskUpdateValidation,
  handleValidationErrors,
  updateTask
);

// Bulk status update — defined before /:id routes
router.patch('/bulk-status',
  requireAdminOrPMAuth,
  [
    body('taskIds')
      .isArray({ min: 1, max: 500 })
      .withMessage('Task IDs must be a non-empty array of at most 500 items'),
    body('taskIds.*')
      .isInt({ min: 1 })
      .withMessage('Each task ID must be a positive integer'),
    body('status')
      .isIn(['on-hold', 'in-progress', 'not-started', 'completed'])
      .withMessage('Status must be one of: on-hold, in-progress, not-started, completed'),
  ],
  handleValidationErrors,
  bulkUpdateTaskStatus
);

// Bulk reassign — replaces assignees on selected tasks
router.post('/bulk-reassign',
  requireAdminOrPMAuth,
  [
    body('taskIds')
      .isArray({ min: 1, max: 500 })
      .withMessage('Task IDs must be a non-empty array of at most 500 items'),
    body('taskIds.*')
      .isInt({ min: 1 })
      .withMessage('Each task ID must be a positive integer'),
    body('assignee_id')
      .isInt({ min: 1 })
      .withMessage('assignee_id must be a positive integer'),
    body('assignee_type')
      .optional()
      .isIn(['admin', 'team'])
      .withMessage('assignee_type must be "admin" or "team"'),
  ],
  handleValidationErrors,
  bulkReassignTasks
);

// Bulk start / due date update
router.patch('/bulk-dates',
  requireAdminOrPMAuth,
  [
    body('taskIds')
      .isArray({ min: 1, max: 500 })
      .withMessage('Task IDs must be a non-empty array of at most 500 items'),
    body('taskIds.*')
      .isInt({ min: 1 })
      .withMessage('Each task ID must be a positive integer'),
    body('start_date')
      .optional({ nullable: true, checkFalsy: true })
      .isISO8601()
      .withMessage('start_date must be a valid date'),
    body('end_date')
      .optional({ nullable: true, checkFalsy: true })
      .isISO8601()
      .withMessage('end_date must be a valid date'),
  ],
  handleValidationErrors,
  bulkUpdateTaskDates
);

// Bulk approve — under-review tasks only
router.post('/bulk-approve',
  requireAdminOrPMAuth,
  [
    body('taskIds')
      .isArray({ min: 1, max: 500 })
      .withMessage('Task IDs must be a non-empty array of at most 500 items'),
    body('taskIds.*')
      .isInt({ min: 1 })
      .withMessage('Each task ID must be a positive integer'),
  ],
  handleValidationErrors,
  bulkApproveTasks
);

// Bulk assign tasks (assign unassigned tasks to a team member)
// Must be defined BEFORE /:id routes to avoid route collision
router.post('/bulk-assign',
  requireAdminOrPMAuth,
  [
    body('assignee_id')
      .isInt({ min: 1 })
      .withMessage('assignee_id must be a positive integer'),
    body('assignee_type')
      .optional()
      .isIn(['admin', 'team'])
      .withMessage('assignee_type must be "admin" or "team"'),
    body('task_ids')
      .optional()
      .isArray()
      .withMessage('task_ids must be an array'),
    body('task_ids.*')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Each task ID must be a positive integer'),
    body('project_id')
      .optional()
      .isInt({ min: 1 })
      .withMessage('project_id must be a positive integer'),
  ],
  handleValidationErrors,
  bulkAssignTasks
);

// Bulk delete tasks — defined BEFORE DELETE /:id to avoid route collision
router.delete('/bulk',
  requireAdminOrPMAuth,
  [
    body('taskIds')
      .isArray({ min: 1 })
      .withMessage('Task IDs must be a non-empty array'),
    body('taskIds.*')
      .isInt({ min: 1 })
      .withMessage('Each task ID must be a positive integer')
  ],
  handleValidationErrors,
  bulkDeleteTasks
);
router.delete('/:id',
  requireAdminOrPMAuth,
  idValidation,
  handleValidationErrors,
  deleteTask
);

// =====================================================
// TASK EXTENSIONS ROUTES
// =====================================================

// Request task extension
router.post('/:id/extensions',
  requireAuth,
  idValidation,
  [
    body('requested_due_date')
      .isISO8601()
      .withMessage('Requested due date must be a valid date'),
    body('reason')
      .trim()
      .notEmpty()
      .withMessage('Reason is required')
      .isLength({ max: 1000 })
      .withMessage('Reason must not exceed 1000 characters')
  ],
  handleValidationErrors,
  requestTaskExtension
);

// Get task extensions
router.get('/:id/extensions',
  requireAuth,
  idValidation,
  handleValidationErrors,
  getTaskExtensions
);

// Review extension request (admin only)
router.put('/extensions/:extensionId/review',
  requireAuth,
  [
    param('extensionId')
      .isInt({ min: 1 })
      .withMessage('Extension ID must be a positive integer'),
    body('status')
      .isIn(['approved', 'rejected'])
      .withMessage('Status must be either "approved" or "rejected"'),
    body('review_notes')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Review notes must not exceed 500 characters')
  ],
  handleValidationErrors,
  reviewExtensionRequest
);

// =====================================================
// TASK REMARKS ROUTES
// =====================================================

// Add task remark
router.post('/:id/remarks',
  requireAuth,
  remarkSubmitRateLimit,
  idValidation,
  [
    body('remark')
      .trim()
      .notEmpty()
      .withMessage('Remark content is required')
      .custom((value) => {
        if (value.length > REMARK_MAX_HTML_LENGTH) {
          throw new Error(`Remark must not exceed ${REMARK_MAX_HTML_LENGTH} characters`);
        }
        const plainText = stripHtml(value);
        if (!plainText) {
          throw new Error('Remark content is required');
        }
        if (plainText.length > REMARK_MAX_PLAIN_LENGTH) {
          throw new Error(`Remark must not exceed ${REMARK_MAX_PLAIN_LENGTH} characters of text`);
        }
        return true;
      }),
    body('remark_date')
      .optional()
      .isISO8601()
      .withMessage('Remark date must be a valid date'),
    body('remark_type')
      .optional()
      .isIn(['general', 'complete', 'skipped', 'other'])
      .withMessage('Remark type must be one of: general, complete, skipped, other'),
    body('is_private')
      .optional()
      .isBoolean()
      .withMessage('is_private must be a boolean')
  ],
  handleValidationErrors,
  addTaskRemark
);

// Get task remarks
router.get('/:id/remarks',
  requireAuth,
  idValidation,
  handleValidationErrors,
  getTaskRemarks
);

// Delete task remark
router.delete('/remarks/:remarkId',
  requireAuth,
  [
    param('remarkId')
      .isInt({ min: 1 })
      .withMessage('Remark ID must be a positive integer')
  ],
  handleValidationErrors,
  deleteTaskRemark
);

// =====================================================
// TASK TIME TRACKING ROUTES
// =====================================================

// Get timer status for current user on a task
router.get('/:id/timer', requireAuth, idValidation, handleValidationErrors, getTimerStatus);

// Get full time summary (all sessions)
router.get('/:id/time', requireAuth, idValidation, handleValidationErrors, getTaskTime);

// Start timer
router.post('/:id/timer/start', requireAuth, idValidation, handleValidationErrors, startTaskTimer);

// Pause timer
router.post('/:id/timer/pause', requireAuth, idValidation, handleValidationErrors, pauseTaskTimer);

// Resume timer
router.post('/:id/timer/resume', requireAuth, idValidation, handleValidationErrors, resumeTaskTimer);

// Complete timer
router.post('/:id/timer/complete', requireAuth, idValidation, handleValidationErrors, completeTaskTimer);

module.exports = router;
