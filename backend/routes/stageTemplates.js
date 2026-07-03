const express = require('express');
const router = express.Router();
const {
  getTemplatesByCategory,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  bulkCreateTemplates
} = require('../controllers/stageTemplateController');
const { requireAuth } = require('../middleware/auth');
const { body, param, validationResult } = require('express-validator');

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

const templateValidation = [
  body('category_id')
    .isInt({ min: 1 })
    .withMessage('Category ID must be a positive integer'),
  
  body('stage_id')
    .isInt({ min: 1 })
    .withMessage('Stage ID must be a positive integer'),
  
  body('order_index')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Order index must be a non-negative integer'),
  
  body('is_default')
    .optional()
    .isBoolean()
    .withMessage('is_default must be a boolean')
];

const updateTemplateValidation = [
  body('order_index')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Order index must be a non-negative integer'),
  
  body('is_default')
    .optional()
    .isBoolean()
    .withMessage('is_default must be a boolean')
];

const bulkCreateValidation = [
  body('templates')
    .isArray()
    .withMessage('templates must be an array'),
  
  body('templates.*.stage_id')
    .isInt({ min: 1 })
    .withMessage('Each stage_id must be a positive integer'),
  
  body('templates.*.order_index')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Each order index must be a non-negative integer'),
  
  body('templates.*.is_default')
    .optional()
    .isBoolean()
    .withMessage('Each is_default must be a boolean')
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

// Routes

// Get all stage templates for a category
router.get('/category/:category_id',
  requireAuth,
  categoryIdValidation,
  handleValidationErrors,
  getTemplatesByCategory
);

// Get stage template by ID
router.get('/:id',
  requireAuth,
  idValidation,
  handleValidationErrors,
  getTemplate
);

// Create new stage template
router.post('/',
  requireAuth,
  templateValidation,
  handleValidationErrors,
  createTemplate
);

// Update stage template
router.put('/:id',
  requireAuth,
  idValidation,
  updateTemplateValidation,
  handleValidationErrors,
  updateTemplate
);

// Delete stage template
router.delete('/:id',
  requireAuth,
  idValidation,
  handleValidationErrors,
  deleteTemplate
);

// Bulk create stage templates for a category
router.post('/category/:category_id/bulk',
  requireAuth,
  categoryIdValidation,
  bulkCreateValidation,
  handleValidationErrors,
  bulkCreateTemplates
);

module.exports = router;
