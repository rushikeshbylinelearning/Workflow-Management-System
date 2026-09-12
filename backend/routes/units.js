const express = require('express');
const router = express.Router();
const unitController = require('../controllers/unitController');
const { requireAuth, requireAdminOrPMAuth } = require('../middleware/auth');

// Read — any authenticated user (admin, PM, or team member) so task tag filters work
router.get('/book/:bookId', requireAuth, unitController.getUnitsByBook);
router.get('/', requireAuth, unitController.getAllUnits);
router.get('/:id', requireAuth, unitController.getUnitById);

// Mutations — admin or project manager
router.post('/distribute-weights', requireAdminOrPMAuth, unitController.distributeWeights);
router.post('/', requireAdminOrPMAuth, unitController.createUnit);
router.put('/:id', requireAdminOrPMAuth, unitController.updateUnit);
router.delete('/:id', requireAdminOrPMAuth, unitController.deleteUnit);

module.exports = router;
