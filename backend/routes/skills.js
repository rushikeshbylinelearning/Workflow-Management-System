const express = require('express');
const router = express.Router();
const {
  getSkills,
  getSkill,
  createSkill,
  updateSkill,
  deleteSkill
} = require('../controllers/skillController');
const { requireAdminAuth, requireAuth } = require('../middleware/auth');
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

// Skill validation rules
const skillValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Skill name is required')
    .isLength({ max: 100 })
    .withMessage('Skill name must not exceed 100 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  
  body('category')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Category must not exceed 50 characters')
];

const skillUpdateValidation = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Skill name cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Skill name must not exceed 100 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  
  body('category')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Category must not exceed 50 characters')
];

const idValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID must be a positive integer')
];

// Routes

// Get all skills
router.get('/', 
  requireAuth,
  getSkills
);

// Get skill by ID
router.get('/:id',
  requireAuth,
  idValidation,
  handleValidationErrors,
  getSkill
);

// Create new skill
router.post('/',
  requireAdminAuth,
  skillValidation,
  handleValidationErrors,
  createSkill
);

// Update skill
router.put('/:id',
  requireAdminAuth,
  idValidation,
  skillUpdateValidation,
  handleValidationErrors,
  updateSkill
);

// Delete skill
router.delete('/:id',
  requireAdminAuth,
  idValidation,
  handleValidationErrors,
  deleteSkill
);

module.exports = router;
