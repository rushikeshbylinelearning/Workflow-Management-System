const express = require('express');
const { body } = require('express-validator');
const { validateRequest, requireAdminAuth } = require('../middleware/auth');
const performanceFlagController = require('../controllers/performanceFlagController');

const router = express.Router();

// Validation middleware for performance flags
const performanceFlagValidation = [
  body('team_member_id')
    .isInt({ min: 1 })
    .withMessage('Team member ID must be a positive integer'),
  body('task_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Task ID must be a positive integer'),
  body('type')
    .isIn(['red', 'orange', 'yellow', 'green'])
    .withMessage('Flag type must be one of: red, orange, yellow, green'),
  body('reason')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Reason must be between 1 and 1000 characters')
];

const updateFlagValidation = [
  body('type')
    .optional()
    .isIn(['red', 'orange', 'yellow', 'green'])
    .withMessage('Flag type must be one of: red, orange, yellow, green'),
  body('reason')
    .optional()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Reason must be between 1 and 1000 characters')
];

// Routes
// GET /api/performance-flags/team-member/:teamMemberId
router.get('/team-member/:teamMemberId', performanceFlagController.getPerformanceFlags);

// GET /api/performance-flags/task/:taskId
router.get('/task/:taskId', performanceFlagController.getTaskPerformanceFlags);

// GET /api/performance-flags/summary/:teamMemberId
router.get('/summary/:teamMemberId', performanceFlagController.getPerformanceSummary);

// POST /api/performance-flags
router.post('/', requireAdminAuth, performanceFlagValidation, validateRequest, performanceFlagController.addPerformanceFlag);

// PUT /api/performance-flags/:flagId
router.put('/:flagId', requireAdminAuth, updateFlagValidation, validateRequest, performanceFlagController.updatePerformanceFlag);

// DELETE /api/performance-flags/:flagId
router.delete('/:flagId', requireAdminAuth, performanceFlagController.deletePerformanceFlag);

module.exports = router;
