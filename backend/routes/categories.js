const express = require('express');
const router = express.Router();
const {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory
} = require('../controllers/categoryController');
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

// Category validation rules
const categoryValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Category name is required')
    .isLength({ max: 100 })
    .withMessage('Category name must not exceed 100 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  
  body('color')
    .optional()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage('Color must be a valid hex color code (e.g., #3B82F6)')
];

const categoryUpdateValidation = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Category name cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Category name must not exceed 100 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  
  body('color')
    .optional()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage('Color must be a valid hex color code (e.g., #3B82F6)')
];

const idValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID must be a positive integer')
];

// Routes

// Get all categories
router.get('/', 
  requireAuth,
  getCategories
);

// Get category by ID
router.get('/:id',
  requireAuth,
  idValidation,
  handleValidationErrors,
  getCategory
);

// Create new category
router.post('/',
  requireAuth,
  categoryValidation,
  handleValidationErrors,
  createCategory
);

// Update category
router.put('/:id',
  requireAuth,
  idValidation,
  categoryUpdateValidation,
  handleValidationErrors,
  updateCategory
);

// Delete category
router.delete('/:id',
  requireAuth,
  idValidation,
  handleValidationErrors,
  deleteCategory
);

module.exports = router;
