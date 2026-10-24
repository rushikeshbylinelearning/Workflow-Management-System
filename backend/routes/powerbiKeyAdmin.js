const express = require('express');
const { requireAdminAuth } = require('../middleware/auth');
const db = require('../db');
const keys = require('../powerbi-api/keyService');

const router = express.Router();
router.use(requireAdminAuth);

router.get('/', async (req, res) => {
  try {
    const data = await keys.listKeys(db);
    res.json({ success: true, data });
  } catch (error) {
    console.error('list powerbi keys:', error.message);
    res.status(500).json({ success: false, message: 'Failed to list Power BI API keys' });
  }
});

router.post('/', async (req, res) => {
  try {
    const created = await keys.createKey(db, {
      name: req.body.name,
      projectIds: req.body.project_ids,
      scope: req.body.scope || 'read',
      expiresAt: req.body.no_expiry ? null : (req.body.expires_at || undefined),
    });
    res.status(201).json({
      success: true,
      message: 'API key created. Copy it now — it will not be shown again.',
      data: created,
    });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ success: false, message: error.status ? error.message : 'Failed to create Power BI API key' });
  }
});

router.post('/:id/rotate', async (req, res) => {
  try {
    const created = await keys.rotateKey(db, Number(req.params.id));
    if (!created) return res.status(404).json({ success: false, message: 'API key not found' });
    res.status(201).json({
      success: true,
      message: 'Key rotated. Copy the new key now — it will not be shown again.',
      data: created,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to rotate Power BI API key' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const ok = await keys.revokeKey(db, Number(req.params.id));
    if (!ok) return res.status(404).json({ success: false, message: 'API key not found or already revoked' });
    res.json({ success: true, message: 'API key revoked' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to revoke Power BI API key' });
  }
});

module.exports = router;
