const crypto = require('crypto');
const { ApiError } = require('./errors');

function hashKey(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

function generateRawKey() {
  return `pbi_${crypto.randomBytes(32).toString('hex')}`;
}

function parseProjectIds(value) {
  if (Array.isArray(value)) return value.map(Number).filter((id) => Number.isInteger(id) && id > 0);
  if (value == null || value === '') return [];
  if (typeof value === 'object') return parseProjectIds(Object.values(value));
  try {
    return parseProjectIds(JSON.parse(value));
  } catch {
    return [];
  }
}

function httpsRequired(req) {
  if (process.env.NODE_ENV !== 'production') return false;
  const host = String(req.headers.host || '');
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return false;
  const forwarded = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  return !(req.secure || forwarded === 'https');
}

function createAuth(database) {
  return async function requirePowerBiKey(req, res, next) {
    try {
      if (httpsRequired(req)) {
        return res.status(403).json({ error: 'forbidden' });
      }
      const raw = req.headers['x-api-key'];
      if (!raw || typeof raw !== 'string') {
        return res.status(401).json({ error: 'unauthorized' });
      }
      const row = await database.queryFirst(
        `SELECT id, name, scope, project_ids, expires_at, revoked_at
         FROM powerbi_api_keys
         WHERE key_hash = ?
         LIMIT 1`,
        [hashKey(raw.trim())]
      );
      if (!row || row.revoked_at) {
        return res.status(401).json({ error: 'unauthorized' });
      }
      if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
        return res.status(401).json({ error: 'unauthorized' });
      }
      database.execute(
        'UPDATE powerbi_api_keys SET last_used_at = NOW() WHERE id = ?',
        [row.id]
      ).catch(() => {});
      req.powerbiKey = {
        id: row.id,
        name: row.name,
        scope: row.scope,
        projectIds: parseProjectIds(row.project_ids),
      };
      return next();
    } catch (error) {
      if (error && error.code === 'ER_NO_SUCH_TABLE') {
        return res.status(503).json({ error: 'server_error' });
      }
      console.error('powerbi auth error:', error.message);
      return res.status(500).json({ error: 'server_error' });
    }
  };
}

function assertProject(req, projectId) {
  if (!req.powerbiKey.projectIds.includes(projectId)) {
    throw new ApiError(403, 'forbidden');
  }
}

module.exports = {
  hashKey,
  generateRawKey,
  parseProjectIds,
  httpsRequired,
  createAuth,
  assertProject,
};
