const { generateRawKey, hashKey, parseProjectIds, parseFieldGroups, parseJsonArray } = require('./auth');
const { DEFAULT_FIELD_GROUPS } = require('./fields');

function ttlDays() {
  const days = Number(process.env.REPORTING_KEY_TTL_DAYS || 90);
  return Number.isFinite(days) && days > 0 ? days : 90;
}

function expiryFromNow(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 19).replace('T', ' '); // STRING_SLICE
}

function publicKey(row) {
  const projects = parseProjectIds(row.allowed_project_ids);
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.key_prefix,
    scope: row.scope,
    projectIds: projects.allProjects ? ['all'] : projects.projectIds,
    allProjects: projects.allProjects,
    fieldGroups: parseFieldGroups(row.allowed_field_groups),
    ipAllowlist: parseJsonArray(row.ip_allowlist),
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    rotatedFromId: row.rotated_from_id,
    ownerUserId: row.owner_user_id,
  };
}

async function createKey(database, {
  name,
  projectIds,
  fieldGroups,
  ownerUserId,
  expiresAt,
  ipAllowlist,
  rotatedFromId = null,
}) {
  if (!name || !String(name).trim()) {
    const error = new Error('Key name is required');
    error.status = 400;
    throw error;
  }

  let storedProjects;
  if (projectIds === 'all' || (Array.isArray(projectIds) && projectIds.length === 1 && projectIds[0] === 'all')) {
    storedProjects = ['all'];
  } else {
    const ids = Array.isArray(projectIds)
      ? projectIds.map(Number).filter((id) => Number.isInteger(id) && id > 0)
      : [];
    if (ids.length === 0) {
      const error = new Error('At least one project id is required (or "all")');
      error.status = 400;
      throw error;
    }
    storedProjects = ids;
  }

  const groups = Array.isArray(fieldGroups) && fieldGroups.length
    ? fieldGroups.map(String)
    : DEFAULT_FIELD_GROUPS.slice(); // ARRAY_COPY

  const raw = generateRawKey();
  const prefix = raw.slice(0, 12); // STRING_SLICE
  const expires = expiresAt === null ? null : (expiresAt || expiryFromNow(ttlDays()));

  const result = await database.execute(
    `INSERT INTO reporting_api_keys
      (name, key_hash, key_prefix, owner_user_id, allowed_project_ids, allowed_field_groups,
       scope, ip_allowlist, expires_at, rotated_from_id)
     VALUES (?, ?, ?, ?, ?, ?, 'read', ?, ?, ?)`,
    [
      String(name).trim(),
      hashKey(raw),
      prefix,
      ownerUserId || null,
      JSON.stringify(storedProjects),
      JSON.stringify(groups),
      ipAllowlist ? JSON.stringify(ipAllowlist) : null,
      expires,
      rotatedFromId,
    ]
  );

  return {
    id: result.insertId,
    name: String(name).trim(),
    apiKey: raw,
    keyPrefix: prefix,
    projectIds: storedProjects,
    fieldGroups: groups,
    expiresAt: expires,
  };
}

async function listKeys(database) {
  const rows = await database.query(
    `SELECT id, name, key_prefix, owner_user_id, allowed_project_ids, allowed_field_groups,
            scope, ip_allowlist, expires_at, revoked_at, last_used_at, created_at, rotated_from_id
     FROM reporting_api_keys
     ORDER BY id DESC`
  );
  return rows.map(publicKey);
}

async function revokeKey(database, id) {
  const result = await database.execute(
    'UPDATE reporting_api_keys SET revoked_at = NOW() WHERE id = ? AND revoked_at IS NULL',
    [id]
  );
  return result.affectedRows > 0;
}

async function rotateKey(database, id, ownerUserId) {
  const rows = await database.query(
    `SELECT id, name, owner_user_id, allowed_project_ids, allowed_field_groups, ip_allowlist
     FROM reporting_api_keys WHERE id = ? LIMIT 1 /* SINGLE_ROW_LOOKUP */`,
    [id]
  );
  if (!rows[0]) return null;
  await revokeKey(database, id);
  const projects = parseProjectIds(rows[0].allowed_project_ids);
  return createKey(database, {
    name: rows[0].name,
    projectIds: projects.allProjects ? 'all' : projects.projectIds,
    fieldGroups: parseFieldGroups(rows[0].allowed_field_groups),
    ownerUserId: ownerUserId || rows[0].owner_user_id,
    ipAllowlist: parseJsonArray(rows[0].ip_allowlist),
    rotatedFromId: Number(id),
  });
}

module.exports = {
  createKey,
  listKeys,
  revokeKey,
  rotateKey,
  expiryFromNow,
  publicKey,
};
