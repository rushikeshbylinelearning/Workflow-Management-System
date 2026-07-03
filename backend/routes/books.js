const express = require('express');
const router = express.Router();
const bookController = require('../controllers/bookController');
const { requireAdminOrPMAuth } = require('../middleware/auth');

// Apply authentication middleware to all routes (admin or project manager)
router.use(requireAdminOrPMAuth);

// Get all books for a grade
router.get('/grade/:gradeId', bookController.getBooksByGrade);

// Auto-distribute weights for books in a grade — MUST be before /:id
router.post('/distribute-weights', bookController.distributeWeights);

// Get all books
router.get('/', bookController.getAllBooks);

// Get book by ID
router.get('/:id', bookController.getBookById);

// Create new book
router.post('/', bookController.createBook);

// Update book
router.put('/:id', bookController.updateBook);

// Delete book
router.delete('/:id', bookController.deleteBook);

module.exports = router;
