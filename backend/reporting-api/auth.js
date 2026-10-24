const crypto = require('crypto');
const { ReportingError } = require('./errors');
const { DEFAULT_FIELD_GROUPS } = require('./fields');

const KEY_PREFIX = 'rpt_';

function pepper() {
  return process.env.REPORTING_API_KEY_PEPPER || process.env.JWT_SECRET || 'reporting-dev-pepper';
}

function hashKey(raw) {
  return crypto.createHmac('sha256', pepper()).update(String(raw)).digest('hex');
}

function generateRawKey() {
  return `${KEY_PREFIX}${crypto.randomBytes(32).toString('hex')}`;
}

function timingSafeEqualHex(a, b) {
  const ba = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (ba.length !== bb.length) {
    crypto.timingSafeEqual(ba, ba);
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  if (typeof value === 'object') return Object.values(value);
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseProjectIds(value) {
  const arr = parseJsonArray(value);
  if (arr.length === 1 && String(arr[0]).toLowerCase() === 'all') {
    return { allProjects: true, projectIds: [] };
  }
  return {
    allProjects: false,
    projectIds: arr.map(Number).filter((id) => Number.isInteger(id) && id > 0),
  };
}

function parseFieldGroups(value) {
  const arr = parseJsonArray(value).map(String);
  return arr.length ? arr : DEFAULT_FIELD_GROUPS.slice(); // ARRAY_COPY
}

function httpsRequired(req) {
  if (process.env.NODE_ENV !== 'production') return false;
  const host = String(req.headers.host || '');
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return false;
  // Only trust X-Forwarded-Proto when trust proxy is configured
  const trustProxy = Boolean(req.app && req.app.get('trust proxy'));
  const forwarded = trustProxy
    ? String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
    : '';
  return !(req.secure || forwarded === 'https');
}

function createAuth(database) {
  return async function requireReportingKey(req, res, next) {
    try {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

      if (httpsRequired(req)) {
        return res.status(403).json({ error: 'forbidden', message: 'HTTPS required' });
      }

      if (req.query && (req.query.api_key || req.query.apiKey || req.query.key)) {
        return res.status(401).json({ error: 'unauthorized', message: 'API key must be sent in X-API-Key header only' });
      }

      const raw = req.headers['x-api-key'];
      if (!raw || typeof raw !== 'string') {
        return res.status(401).json({ error: 'unauthorized', message: 'Missing API key' });
      }

      const keyHash = hashKey(raw.trim());
      const row = await database.queryFirst(
        `SELECT id, name, key_hash, owner_user_id, allowed_project_ids, allowed_field_groups,
                scope, ip_allowlist, expires_at, revoked_at
         FROM reporting_api_keys
         WHERE key_hash = ?
         LIMIT 1 /* SINGLE_ROW_LOOKUP */`,
        [keyHash]
      );

      if (!row || row.revoked_at) {
        return res.status(401).json({ error: 'unauthorized', message: 'Invalid API key' });
      }
      if (!timingSafeEqualHex(row.key_hash, keyHash)) {
        return res.status(401).json({ error: 'unauthorized', message: 'Invalid API key' });
      }
      if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
        return res.status(401).json({ error: 'unauthorized', message: 'API key expired' });
      }

      const ipAllow = parseJsonArray(row.ip_allowlist);
      if (ipAllow.length) {
        const ip = String(req.ip || req.connection?.remoteAddress || '');
        if (!ipAllow.includes(ip) && !ipAllow.includes(ip.replace(/^::ffff:/, ''))) {
          return res.status(403).json({ error: 'forbidden', message: 'IP not allowed' });
        }
      }

      const projects = parseProjectIds(row.allowed_project_ids);
      database.execute(
        'UPDATE reporting_api_keys SET last_used_at = NOW() WHERE id = ?',
        [row.id]
      ).catch(() => {});

      req.reportingKey = {
        id: row.id,
        name: row.name,
        ownerUserId: row.owner_user_id,
        scope: row.scope || 'read',
        projectIds: projects.projectIds,
        allProjects: projects.allProjects,
        fieldGroups: parseFieldGroups(row.allowed_field_groups),
      };
      return next();
    } catch (error) {
      if (error && error.code === 'ER_NO_SUCH_TABLE') {
        return res.status(503).json({ error: 'server_error', message: 'Reporting API not migrated' });
      }
      return res.status(500).json({ error: 'server_error', message: 'An error occurred' });
    }
  };
}

function assertFieldGroups(key, fieldDefs) {
  const { SENSITIVE_GROUPS } = require('./fields');
  const allowed = new Set(key.fieldGroups || []);
  for (const field of fieldDefs) {
    if (!field.sensitive) continue;
    // Sensitive: allow if fieldName is explicitly listed, or its sensitive group is granted
    const byName = allowed.has(field.fieldName);
    const byGroup = SENSITIVE_GROUPS.includes(field.group) && allowed.has(field.group);
    if (!byName && !byGroup) {
      throw new ReportingError(403, 'forbidden', 'Field group not permitted for this key');
    }
  }
}

module.exports = {
  KEY_PREFIX,
  hashKey,
  generateRawKey,
  timingSafeEqualHex,
  parseProjectIds,
  parseFieldGroups,
  parseJsonArray,
  httpsRequired,
  createAuth,
  assertFieldGroups,
};
