const express = require('express');
const allocationController = require('../controllers/allocationController');
const { requireAdminOrPMAuth } = require('../middleware/auth');

// Apply auth middleware to all routes
const router = express.Router();

router.use(requireAdminOrPMAuth);

// Get all allocations with filters
router.get('/', allocationController.getAllocations);

// Get workload summary for a specific date
router.get('/workload-summary', allocationController.getWorkloadSummary);

// Get daily allocations based on task assignments
router.get('/daily', allocationController.getDailyAllocations);

// Get single allocation by ID
router.get('/:id', allocationController.getAllocation);

// Create new allocation
router.post('/', allocationController.createAllocation);

// Update allocation
router.put('/:id', allocationController.updateAllocation);

// Delete allocation
router.delete('/:id', allocationController.deleteAllocation);

module.exports = router;
