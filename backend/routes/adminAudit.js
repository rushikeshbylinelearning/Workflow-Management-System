const express = require('express');
const { requireAdminAuth } = require('../middleware/auth');
const adminAuditController = require('../controllers/adminAuditController');

const router = express.Router();

// =====================================================
// PERFORMANCE FLAGS ROUTES
// =====================================================

// GET /api/admin-audit/flags - Get all performance flags
router.get('/flags', requireAdminAuth, adminAuditController.getAllPerformanceFlags);

// DELETE /api/admin-audit/flags/:flagId - Delete a performance flag with audit
router.delete('/flags/:flagId', requireAdminAuth, adminAuditController.deletePerformanceFlag);

// POST /api/admin-audit/flags/bulk-delete - Bulk delete performance flags
router.post('/flags/bulk-delete', requireAdminAuth, adminAuditController.bulkDeletePerformanceFlags);

// GET /api/admin-audit/flags/audit-logs - Get flag audit logs
router.get('/flags/audit-logs', requireAdminAuth, adminAuditController.getFlagAuditLogs);

// =====================================================
// EXTENSION REQUESTS ROUTES
// =====================================================

// GET /api/admin-audit/extensions - Get all extension requests
router.get('/extensions', requireAdminAuth, adminAuditController.getAllExtensionRequests);

// DELETE /api/admin-audit/extensions/:extensionId - Delete an extension request with audit
router.delete('/extensions/:extensionId', requireAdminAuth, adminAuditController.deleteExtensionRequest);

// POST /api/admin-audit/extensions/bulk-delete - Bulk delete extension requests
router.post('/extensions/bulk-delete', requireAdminAuth, adminAuditController.bulkDeleteExtensionRequests);

// GET /api/admin-audit/extensions/audit-logs - Get extension audit logs
router.get('/extensions/audit-logs', requireAdminAuth, adminAuditController.getExtensionAuditLogs);

module.exports = router;
