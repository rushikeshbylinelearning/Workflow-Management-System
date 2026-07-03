const express = require('express');
const router = express.Router();
const unitController = require('../controllers/unitController');
const { requireAdminOrPMAuth } = require('../middleware/auth');

// Apply authentication middleware to all routes (admin or project manager)
router.use(requireAdminOrPMAuth);

// Get all units for a book
router.get('/book/:bookId', unitController.getUnitsByBook);

// Auto-distribute weights for units in a book — MUST be before /:id
router.post('/distribute-weights', unitController.distributeWeights);

// Get all units
router.get('/', unitController.getAllUnits);

// Get unit by ID
router.get('/:id', unitController.getUnitById);

// Create new unit
router.post('/', unitController.createUnit);

// Update unit
router.put('/:id', unitController.updateUnit);

// Delete unit
router.delete('/:id', unitController.deleteUnit);

module.exports = router;
