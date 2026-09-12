const express = require('express');
const router = express.Router();
const lessonController = require('../controllers/lessonController');
const { requireAuth, requireAdminOrPMAuth } = require('../middleware/auth');

// Read — any authenticated user (admin, PM, or team member) so task tag filters work
router.get('/unit/:unitId', requireAuth, lessonController.getLessonsByUnit);
router.get('/', requireAuth, lessonController.getAllLessons);
router.get('/:id', requireAuth, lessonController.getLessonById);

// Mutations — admin or project manager
router.post('/distribute-weights', requireAdminOrPMAuth, lessonController.distributeWeights);
router.post('/', requireAdminOrPMAuth, lessonController.createLesson);
router.put('/:id', requireAdminOrPMAuth, lessonController.updateLesson);
router.delete('/:id', requireAdminOrPMAuth, lessonController.deleteLesson);

module.exports = router;
