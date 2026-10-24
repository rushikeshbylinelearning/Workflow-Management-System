const express = require('express');
const { requireAdminAuth } = require('../middleware/auth');
const db = require('../db');
const keys = require('../reporting-api/keyService');
const { buildCurl, buildPowerQueryM, buildTasksUrl } = require('../reporting-api/mQuery');
const { DEFAULT_FIELD_GROUPS, metadataFields } = require('../reporting-api/fields');
const { reportingEnabled } = require('../reporting-api');

const router = express.Router();

router.use((req, res, next) => {
  if (!reportingEnabled()) {
    return res.status(404).json({ success: false, message: 'Not found' });
  }
  return next();
});

router.use(requireAdminAuth);

router.get('/keys', async (req, res) => {
  try {
    const data = await keys.listKeys(db);
    res.json({ success: true, data });
  } catch (error) {
    if (error && error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({ success: false, message: 'Run reporting API migration first' });
    }
    res.status(500).json({ success: false, message: 'Failed to list reporting API keys' });
  }
});

router.post('/keys', async (req, res) => {
  try {
    const created = await keys.createKey(db, {
      name: req.body.name,
      projectIds: req.body.projectIds ?? req.body.project_ids,
      fieldGroups: req.body.fieldGroups ?? req.body.field_groups ?? DEFAULT_FIELD_GROUPS.slice(),
      ownerUserId: req.user?.id,
      expiresAt: req.body.noExpiry || req.body.no_expiry ? null : (req.body.expiresAt || req.body.expires_at || undefined),
      ipAllowlist: req.body.ipAllowlist || req.body.ip_allowlist || null,
    });
    res.status(201).json({
      success: true,
      message: 'API key created. Copy it now — it will not be shown again.',
      data: created,
    });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({
      success: false,
      message: error.status ? error.message : 'Failed to create reporting API key',
    });
  }
});

router.post('/keys/:id/rotate', async (req, res) => {
  try {
    const created = await keys.rotateKey(db, Number(req.params.id), req.user?.id);
    if (!created) return res.status(404).json({ success: false, message: 'API key not found' });
    res.status(201).json({
      success: true,
      message: 'Key rotated. Copy the new key now — it will not be shown again.',
      data: created,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to rotate reporting API key' });
  }
});

router.delete('/keys/:id', async (req, res) => {
  try {
    const ok = await keys.revokeKey(db, Number(req.params.id));
    if (!ok) return res.status(404).json({ success: false, message: 'API key not found or already revoked' });
    res.json({ success: true, message: 'API key revoked' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to revoke reporting API key' });
  }
});

router.get('/fields', (req, res) => {
  res.json({ success: true, data: metadataFields(), defaultFieldGroups: DEFAULT_FIELD_GROUPS });
});

router.post('/preview', (req, res) => {
  const body = req.body || {};
  const projectIds = body.projectIds || [];
  const fields = body.fields || [];
  const filters = body.filters || {};
  res.json({
    success: true,
    data: {
      url: buildTasksUrl({ projectIds, fields, filters }),
      curl: buildCurl({ projectIds, fields, filters }),
      mQuery: buildPowerQueryM({ projectIds, fields, filters }),
    },
  });
});

router.get('/configs', async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT id, name, owner_user_id AS ownerUserId, project_ids AS projectIds, fields, filters,
              generated_url AS generatedUrl, api_key_id AS apiKeyId, m_query AS mQuery,
              created_at AS createdAt, updated_at AS updatedAt
       FROM reporting_saved_configs
       ORDER BY id DESC`
    );
    res.json({
      success: true,
      data: rows.map((row) => ({
        ...row,
        projectIds: typeof row.projectIds === 'string' ? JSON.parse(row.projectIds) : row.projectIds,
        fields: typeof row.fields === 'string' ? JSON.parse(row.fields) : row.fields,
        filters: typeof row.filters === 'string' ? JSON.parse(row.filters) : row.filters,
      })),
    });
  } catch (error) {
    if (error && error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({ success: false, message: 'Run reporting API migration first' });
    }
    res.status(500).json({ success: false, message: 'Failed to list configs' });
  }
});

router.post('/configs', async (req, res) => {
  try {
    const body = req.body || {};
    const name = String(body.name || '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'name is required' });
    const projectIds = body.projectIds || [];
    const fields = body.fields || [];
    const filters = body.filters || {};
    const apiKeyId = body.apiKeyId || null;
    const url = buildTasksUrl({ projectIds, fields, filters });
    const mQuery = buildPowerQueryM({ projectIds, fields, filters });
    const result = await db.execute(
      `INSERT INTO reporting_saved_configs
        (name, owner_user_id, project_ids, fields, filters, generated_url, api_key_id, m_query)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        req.user?.id || null,
        JSON.stringify(projectIds),
        JSON.stringify(fields),
        JSON.stringify(filters),
        url,
        apiKeyId,
        mQuery,
      ]
    );
    res.status(201).json({
      success: true,
      data: { id: result.insertId, name, projectIds, fields, filters, generatedUrl: url, apiKeyId, mQuery },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to save config' });
  }
});

router.delete('/configs/:id', async (req, res) => {
  try {
    const result = await db.execute('DELETE FROM reporting_saved_configs WHERE id = ?', [Number(req.params.id)]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Config not found' });
    res.json({ success: true, message: 'Config deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete config' });
  }
});

module.exports = router;
