const express = require('express');
const router = express.Router();
const { 
  getProjects, 
  getProject, 
  createProject, 
  updateProject, 
  deleteProject,
  getProjectMembers,
  getProjectTeams,
  addProjectMember,
  removeProjectMember,
  removeProjectTeam
} = require('../controllers/projectController');
const { requireAuth } = require('../middleware/auth');
const { body, param, query, validationResult } = require('express-validator');

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

// Project validation rules
const projectValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Project name is required')
    .isLength({ max: 255 })
    .withMessage('Project name must not exceed 255 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  
  body('category_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Category ID must be a positive integer'),
  
  body('start_date')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  
  body('end_date')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date'),
  
  body('status')
    .optional()
    .isIn(['planning', 'active', 'on-hold', 'completed', 'cancelled'])
    .withMessage('Status must be one of: planning, active, on-hold, completed, cancelled'),
  
  body('client_name')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Client name must not exceed 255 characters'),
  
  body('budget')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Budget must be a positive number'),
  
  body('currency')
    .optional()
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency must be a 3-character code'),
  
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be one of: low, medium, high, urgent')
];

const projectUpdateValidation = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Project name cannot be empty')
    .isLength({ max: 255 })
    .withMessage('Project name must not exceed 255 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  
  body('category_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Category ID must be a positive integer'),
  
  body('start_date')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  
  body('end_date')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date'),
  
  body('status')
    .optional()
    .isIn(['planning', 'active', 'on-hold', 'completed', 'cancelled'])
    .withMessage('Status must be one of: planning, active, on-hold, completed, cancelled'),
  
  body('client_name')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Client name must not exceed 255 characters'),
  
  body('budget')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Budget must be a positive number'),
  
  body('currency')
    .optional()
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency must be a 3-character code'),
  
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be one of: low, medium, high, urgent')
];

const memberValidation = [
  body('user_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),
  
  body('team_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Team ID must be a positive integer'),
  
  body('role')
    .optional()
    .isIn(['owner', 'admin', 'member', 'viewer'])
    .withMessage('Role must be one of: owner, admin, member, viewer'),
  
  // Custom validation to ensure either user_id or team_id is provided
  body()
    .custom((value, { req }) => {
      if (!value.user_id && !value.team_id) {
        throw new Error('Either user_id or team_id is required');
      }
      return true;
    })
];

const idValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID must be a positive integer')
];

const memberIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Project ID must be a positive integer'),
  param('memberId')
    .isInt({ min: 1 })
    .withMessage('Member ID must be a positive integer')
];

const teamIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Project ID must be a positive integer'),
  param('teamId')
    .isInt({ min: 1 })
    .withMessage('Team ID must be a positive integer')
];

// Query validation for filtering
const queryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Limit must be between 1 and 1000'),
  
  query('sort')
    .optional()
    .isIn(['name', 'created_at', 'updated_at', 'start_date', 'end_date', 'status'])
    .withMessage('Sort field must be one of: name, created_at, updated_at, start_date, end_date, status'),
  
  query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Order must be asc or desc'),
  
  query('status')
    .optional()
    .isIn(['planning', 'active', 'on-hold', 'completed', 'cancelled'])
    .withMessage('Status must be one of: planning, active, on-hold, completed, cancelled'),
  
  query('category')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Category must be a positive integer')
];

// Routes

// Get all projects
router.get('/', 
  requireAuth,
  queryValidation,
  handleValidationErrors,
  getProjects
);

// Get project by ID
router.get('/:id',
  requireAuth,
  idValidation,
  handleValidationErrors,
  getProject
);

// Create new project
router.post('/',
  requireAuth,
  projectValidation,
  handleValidationErrors,
  createProject
);

// Update project
router.put('/:id',
  requireAuth,
  idValidation,
  projectUpdateValidation,
  handleValidationErrors,
  updateProject
);

// Delete project
router.delete('/:id',
  requireAuth,
  idValidation,
  handleValidationErrors,
  deleteProject
);

// Get project members
router.get('/:id/members',
  requireAuth,
  idValidation,
  handleValidationErrors,
  getProjectMembers
);

// Get project teams
router.get('/:id/teams',
  requireAuth,
  idValidation,
  handleValidationErrors,
  getProjectTeams
);

// Add member to project
router.post('/:id/members',
  requireAuth,
  idValidation,
  memberValidation,
  handleValidationErrors,
  addProjectMember
);

// Remove member from project
router.delete('/:id/members/:memberId',
  requireAuth,
  memberIdValidation,
  handleValidationErrors,
  removeProjectMember
);

// Remove team from project
router.delete('/:id/teams/:teamId',
  requireAuth,
  teamIdValidation,
  handleValidationErrors,
  removeProjectTeam
);

module.exports = router;
