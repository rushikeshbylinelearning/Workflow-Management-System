const express = require('express');
const router = express.Router();
const bookController = require('../controllers/bookController');
const { requireAuth, requireAdminOrPMAuth } = require('../middleware/auth');

// Read — any authenticated user (admin, PM, or team member) so task tag filters work
router.get('/grade/:gradeId', requireAuth, bookController.getBooksByGrade);
router.get('/', requireAuth, bookController.getAllBooks);
router.get('/:id', requireAuth, bookController.getBookById);

// Mutations — admin or project manager
router.post('/distribute-weights', requireAdminOrPMAuth, bookController.distributeWeights);
router.post('/', requireAdminOrPMAuth, bookController.createBook);
router.put('/:id', requireAdminOrPMAuth, bookController.updateBook);
router.delete('/:id', requireAdminOrPMAuth, bookController.deleteBook);

module.exports = router;
