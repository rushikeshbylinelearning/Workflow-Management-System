const crypto = require('crypto');
const db = require('../db');

// Generate a cryptographically secure API key: wf_ + 56 random hex chars = 59 chars total
const generateKey = () => `wf_${crypto.randomBytes(28).toString('hex')}`;

/**
 * POST /api/api-keys
 * Create a new API key (admin only)
 * Body: { name, expires_at? }
 */
const createApiKey = async (req, res) => {
  try {
    const { name, expires_at } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Key name is required' });
    }

    const rawKey = generateKey();
    const prefix  = rawKey.slice(0, 8); // "wf_" + 5 chars shown in UI

    await db.execute(
      `INSERT INTO api_keys (name, api_key, key_prefix, created_by_id, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [name.trim(), rawKey, prefix, req.user.id, expires_at || null]
    );

    // Return the full key ONCE — it is never shown again
    res.status(201).json({
      success: true,
      message: 'API key created. Copy it now — it will not be shown again.',
      data: {
        name: name.trim(),
        api_key: rawKey,   // full key — shown only on creation
        key_prefix: prefix,
        expires_at: expires_at || null
      }
    });
  } catch (error) {
    console.error('createApiKey error:', error);
    res.status(500).json({ success: false, message: 'Failed to create API key' });
  }
};

/**
 * GET /api/api-keys
 * List all API keys (admin only) — never returns the full key
 */
const listApiKeys = async (req, res) => {
  try {
    const keys = await db.query(
      `SELECT
         ak.id,
         ak.name,
         ak.key_prefix,
         ak.is_active,
         ak.last_used_at,
         ak.expires_at,
         ak.created_at,
         au.name AS created_by
       FROM api_keys ak
       JOIN admin_users au ON au.id = ak.created_by_id
       ORDER BY ak.created_at DESC`
    );

    res.json({ success: true, data: keys, total: keys.length });
  } catch (error) {
    console.error('listApiKeys error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch API keys' });
  }
};

/**
 * DELETE /api/api-keys/:id
 * Revoke (soft-delete) an API key (admin only)
 */
const revokeApiKey = async (req, res) => {
  try {
    const { id } = req.params;

    const key = await db.queryFirst('SELECT id FROM api_keys WHERE id = ?', [id]);
    if (!key) return res.status(404).json({ success: false, message: 'API key not found' });

    await db.execute('UPDATE api_keys SET is_active = 0 WHERE id = ?', [id]);

    res.json({ success: true, message: 'API key revoked successfully' });
  } catch (error) {
    console.error('revokeApiKey error:', error);
    res.status(500).json({ success: false, message: 'Failed to revoke API key' });
  }
};

/**
 * PATCH /api/api-keys/:id/activate
 * Re-activate a previously revoked key (admin only)
 */
const activateApiKey = async (req, res) => {
  try {
    const { id } = req.params;

    const key = await db.queryFirst('SELECT id FROM api_keys WHERE id = ?', [id]);
    if (!key) return res.status(404).json({ success: false, message: 'API key not found' });

    await db.execute('UPDATE api_keys SET is_active = 1 WHERE id = ?', [id]);

    res.json({ success: true, message: 'API key activated successfully' });
  } catch (error) {
    console.error('activateApiKey error:', error);
    res.status(500).json({ success: false, message: 'Failed to activate API key' });
  }
};

module.exports = { createApiKey, listApiKeys, revokeApiKey, activateApiKey };
