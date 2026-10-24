const { generateRawKey, hashKey, parseProjectIds } = require('./auth');

function ttlDays() {
  const days = Number(process.env.POWERBI_KEY_TTL_DAYS || 90);
  return Number.isFinite(days) && days > 0 ? days : 90;
}

function expiryFromNow(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function publicKey(row) {
  return {
    id: row.id,
    name: row.name,
    key_prefix: row.key_prefix,
    scope: row.scope,
    project_ids: parseProjectIds(row.project_ids),
    expires_at: row.expires_at,
    revoked_at: row.revoked_at,
    last_used_at: row.last_used_at,
    created_at: row.created_at,
    rotated_from_id: row.rotated_from_id,
  };
}

async function createKey(database, { name, projectIds, scope = 'read', expiresAt, rotatedFromId = null }) {
  if (!name || !String(name).trim()) {
    const error = new Error('Key name is required');
    error.status = 400;
    throw error;
  }
  const ids = parseProjectIds(projectIds);
  if (ids.length === 0) {
    const error = new Error('At least one project_id is required');
    error.status = 400;
    throw error;
  }
  if (scope !== 'read' && scope !== 'read_admin') {
    const error = new Error('Scope must be read or read_admin');
    error.status = 400;
    throw error;
  }
  const raw = generateRawKey();
  const prefix = raw.slice(0, 12);
  const expires = expiresAt === null ? null : (expiresAt || expiryFromNow(ttlDays()));
  const result = await database.execute(
    `INSERT INTO powerbi_api_keys
      (name, key_hash, key_prefix, scope, project_ids, expires_at, rotated_from_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [String(name).trim(), hashKey(raw), prefix, scope, JSON.stringify(ids), expires, rotatedFromId]
  );
  return {
    id: result.insertId,
    name: String(name).trim(),
    api_key: raw,
    key_prefix: prefix,
    scope,
    project_ids: ids,
    expires_at: expires,
  };
}

async function listKeys(database) {
  const rows = await database.query(
    `SELECT id, name, key_prefix, scope, project_ids, expires_at, revoked_at, last_used_at, created_at, rotated_from_id
     FROM powerbi_api_keys
     ORDER BY id DESC`
  );
  return rows.map(publicKey);
}

async function revokeKey(database, id) {
  const result = await database.execute(
    'UPDATE powerbi_api_keys SET revoked_at = NOW() WHERE id = ? AND revoked_at IS NULL',
    [id]
  );
  return result.affectedRows > 0;
}

async function rotateKey(database, id) {
  const rows = await database.query(
    'SELECT id, name, scope, project_ids FROM powerbi_api_keys WHERE id = ? LIMIT 1',
    [id]
  );
  if (!rows[0]) return null;
  await revokeKey(database, id);
  return createKey(database, {
    name: rows[0].name,
    projectIds: parseProjectIds(rows[0].project_ids),
    scope: rows[0].scope,
    rotatedFromId: Number(id),
  });
}

module.exports = {
  createKey,
  listKeys,
  revokeKey,
  rotateKey,
  expiryFromNow,
};
