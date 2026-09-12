const express = require('express');
const router = express.Router();
const gradeController = require('../controllers/gradeController');
const { requireAuth, requireAdminOrPMAuth } = require('../middleware/auth');

// Read — any authenticated user (admin, PM, or team member) so task tag filters work
router.get('/project/:projectId/export', requireAdminOrPMAuth, gradeController.exportHierarchy);
router.get('/project/:projectId', requireAuth, gradeController.getGradesByProject);
router.get('/', requireAuth, gradeController.getAllGrades);
router.get('/:id', requireAuth, gradeController.getGradeById);

// Mutations — admin or project manager
router.post('/distribute-weights', requireAdminOrPMAuth, gradeController.distributeWeights);
router.post('/bulk-upload', requireAdminOrPMAuth, gradeController.bulkUpload);
router.post('/', requireAdminOrPMAuth, gradeController.createGrade);
router.put('/:id', requireAdminOrPMAuth, gradeController.updateGrade);
router.delete('/:id', requireAdminOrPMAuth, gradeController.deleteGrade);

module.exports = router;
