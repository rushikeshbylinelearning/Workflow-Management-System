const express = require('express');
const router = express.Router();
const gradeController = require('../controllers/gradeController');
const { requireAdminOrPMAuth } = require('../middleware/auth');

// Apply authentication middleware to all routes (admin or project manager)
router.use(requireAdminOrPMAuth);

// Get all grades for a project
router.get('/project/:projectId', gradeController.getGradesByProject);

// Auto-distribute weights for grades in a project — MUST be before /:id
router.post('/distribute-weights', gradeController.distributeWeights);

// Bulk upload educational hierarchy — MUST be before /:id
router.post('/bulk-upload', gradeController.bulkUpload);

// Get all grades
router.get('/', gradeController.getAllGrades);

// Get grade by ID
router.get('/:id', gradeController.getGradeById);

// Create new grade
router.post('/', gradeController.createGrade);

// Update grade
router.put('/:id', gradeController.updateGrade);

// Delete grade
router.delete('/:id', gradeController.deleteGrade);

module.exports = router;
