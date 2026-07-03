const express = require('express');
const router = express.Router();
const {
  getStages,
  getStagesByCategory,
  getStage,
  createStage,
  updateStage,
  deleteStage,
  reorderStages
} = require('../controllers/stageController');
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

const stageValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Stage name is required')
    .isLength({ max: 255 })
    .withMessage('Stage name must not exceed 255 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  
  body('order_index')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Order index must be a non-negative integer'),
  
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean')
];

const updateStageValidation = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Stage name cannot be empty')
    .isLength({ max: 255 })
    .withMessage('Stage name must not exceed 255 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  
  body('order_index')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Order index must be a non-negative integer'),
  
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean')
];

const reorderValidation = [
  body('stage_orders')
    .isArray()
    .withMessage('stage_orders must be an array'),
  
  body('stage_orders.*.stage_id')
    .isInt({ min: 1 })
    .withMessage('Each stage_id must be a positive integer'),
  
  body('stage_orders.*.order')
    .isInt({ min: 0 })
    .withMessage('Each order must be a non-negative integer')
];

const idValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID must be a positive integer')
];

const categoryIdValidation = [
  param('category_id')
    .isInt({ min: 1 })
    .withMessage('Category ID must be a positive integer')
];

const queryValidation = [
  query('project_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Project ID must be a positive integer'),
  
  query('category_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Category ID must be a positive integer')
];

// Routes

// Get all stages
router.get('/', 
  requireAuth,
  queryValidation,
  handleValidationErrors,
  getStages
);

// Get stages by category — MUST be before /:id
router.get('/category/:category_id',
  requireAuth,
  categoryIdValidation,
  handleValidationErrors,
  getStagesByCategory
);

// Reorder stages within a category — MUST be before /:id
router.post('/category/:category_id/reorder',
  requireAuth,
  categoryIdValidation,
  reorderValidation,
  handleValidationErrors,
  reorderStages
);

// Get stage by ID
router.get('/:id',
  requireAuth,
  idValidation,
  handleValidationErrors,
  getStage
);

// Create new stage
router.post('/',
  requireAuth,
  stageValidation,
  handleValidationErrors,
  createStage
);

// Update stage
router.put('/:id',
  requireAuth,
  idValidation,
  updateStageValidation,
  handleValidationErrors,
  updateStage
);

// Delete stage
router.delete('/:id',
  requireAuth,
  idValidation,
  handleValidationErrors,
  deleteStage
);

module.exports = router;
