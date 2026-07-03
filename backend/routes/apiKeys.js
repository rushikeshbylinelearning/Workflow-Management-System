const express = require('express');
const router = express.Router();
const { requireAdminAuth } = require('../middleware/auth');
const { createApiKey, listApiKeys, revokeApiKey, activateApiKey } = require('../controllers/apiKeyController');

// All key-management routes are admin-only
router.use(requireAdminAuth);

// POST   /api/api-keys          — create a new key
router.post('/', createApiKey);

// GET    /api/api-keys          — list all keys (no raw key returned)
router.get('/', listApiKeys);

// DELETE /api/api-keys/:id      — revoke a key
router.delete('/:id', revokeApiKey);

// PATCH  /api/api-keys/:id/activate — re-activate a revoked key
router.patch('/:id/activate', activateApiKey);

module.exports = router;
