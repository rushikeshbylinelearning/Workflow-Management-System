const express = require('express');
const router = express.Router();
const lessonController = require('../controllers/lessonController');
const { requireAdminOrPMAuth } = require('../middleware/auth');

// Apply authentication middleware to all routes (admin or project manager)
router.use(requireAdminOrPMAuth);

// Get all lessons for a unit
router.get('/unit/:unitId', lessonController.getLessonsByUnit);

// Auto-distribute weights for lessons in a unit — MUST be before /:id
router.post('/distribute-weights', lessonController.distributeWeights);

// Get all lessons
router.get('/', lessonController.getAllLessons);

// Get lesson by ID
router.get('/:id', lessonController.getLessonById);

// Create new lesson
router.post('/', lessonController.createLesson);

// Update lesson
router.put('/:id', lessonController.updateLesson);

// Delete lesson
router.delete('/:id', lessonController.deleteLesson);

module.exports = router;
