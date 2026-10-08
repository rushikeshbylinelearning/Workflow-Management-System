const db = require('../db');

const RESERVED_SLUGS = new Set([
  'remark',
  'stage',
  'file_name',
  'filename',
  'file_location',
  'filelocation',
  'server_location',
  'serverlocation',
  'server_link',
  'tags',
  'name',
  'description',
  'task_name',
  'extra_fields',
  'extrafields',
  'type',
  'status',
  'project',
]);

function isMissingTable(err) {
  return !!err && (err.code === 'ER_NO_SUCH_TABLE' || /doesn't exist/i.test(err.message || ''));
}

function isMissingColumn(err) {
  return !!err && (err.code === 'ER_BAD_FIELD_ERROR' || /unknown column/i.test(err.message || ''));
}

function mapField(row) {
  if (!row) return null;
  return {
    id: row.id ?? null,
    slug: row.slug,
    label: row.label,
    is_required: !!(row.is_required === true || row.is_required === 1),
    sort_order: Number(row.sort_order) || 100,
  };
}

function slugifyLabel(label) {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

function parseStoredExtraFields(raw) {
  if (!raw) return {};
  let data = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  return data;
}

function extraFieldsToList(raw) {
  const data = parseStoredExtraFields(raw);
  return Object.entries(data)
    .map(([slug, value]) => {
      if (value && typeof value === 'object') {
        return {
          slug,
          label: String(value.label || slug),
          value: String(value.value ?? '').trim(),
        };
      }
      return { slug, label: slug, value: String(value ?? '').trim() };
    })
    .filter((item) => item.value);
}

function formatExtraFieldsForTeams(raw) {
  const items = extraFieldsToList(raw);
  if (items.length === 0) return '';
  return items.map((item) => `${item.label}: ${item.value}`).join('\n');
}

async function listAllFields() {
  try {
    const rows = await db.query(
      `SELECT id, slug, label, is_required, sort_order
       FROM remark_input_fields
       ORDER BY sort_order ASC, id ASC`
    );
    return (rows || []).map(mapField);
  } catch (err) {
    if (isMissingTable(err)) return [];
    throw err;
  }
}

async function getFieldById(id) {
  const row = await db.queryFirst(
    `SELECT id, slug, label, is_required, sort_order
     FROM remark_input_fields WHERE id = ? LIMIT 1`,
    [id]
  );
  return mapField(row);
}

async function getAssignedFieldIds(memberId) {
  try {
    const rows = await db.query(
      'SELECT field_id FROM team_member_remark_fields WHERE team_member_id = ?',
      [memberId]
    );
    return rows.map((row) => Number(row.field_id));
  } catch (err) {
    if (isMissingTable(err)) return [];
    throw err;
  }
}

async function getAssignedFieldIdsByMember(memberIds) {
  const map = {};
  if (!Array.isArray(memberIds) || memberIds.length === 0) return map;
  try {
    const placeholders = memberIds.map(() => '?').join(',');
    const rows = await db.query(
      `SELECT team_member_id, field_id
       FROM team_member_remark_fields
       WHERE team_member_id IN (${placeholders})`,
      memberIds
    );
    for (const row of rows) {
      const memberId = Number(row.team_member_id);
      if (!map[memberId]) map[memberId] = [];
      map[memberId].push(Number(row.field_id));
    }
    return map;
  } catch (err) {
    if (isMissingTable(err)) return map;
    throw err;
  }
}

async function getFieldsForMember(memberId) {
  const all = await listAllFields();
  const assigned = await getAssignedFieldIds(memberId);
  if (assigned.length === 0) return [];
  const allowed = new Set(assigned);
  return all.filter((field) => allowed.has(Number(field.id)));
}

function shouldSeeAllFields(user) {
  return !!user && (user.type === 'admin' || user.role === 'project_manager');
}

async function getFieldsForUser(user) {
  if (!user) return [];
  if (shouldSeeAllFields(user)) return listAllFields();
  if (user.type === 'team') return getFieldsForMember(user.id);
  return listAllFields();
}

function shouldEnforceRequired(user) {
  return !!user && user.type === 'team' && user.role !== 'project_manager';
}

function pickRawExtraValues(raw) {
  if (!raw || typeof raw !== 'object') return {};
  if (raw.extraFields && typeof raw.extraFields === 'object' && !Array.isArray(raw.extraFields)) {
    return raw.extraFields;
  }
  if (raw.extra_fields && typeof raw.extra_fields === 'object' && !Array.isArray(raw.extra_fields)) {
    return raw.extra_fields;
  }
  return raw;
}

async function normalizeExtraFieldValues(raw, user) {
  const allowed = await getFieldsForUser(user);
  const input = pickRawExtraValues(raw);
  const stored = {};
  const enforceRequired = shouldEnforceRequired(user);

  for (const field of allowed) {
    const rawValue = input[field.slug] ?? input[String(field.id)] ?? '';
    const value = String(
      rawValue && typeof rawValue === 'object' ? (rawValue.value ?? '') : rawValue
    ).trim().slice(0, 500);

    if (enforceRequired && field.is_required && !value) {
      const err = new Error(`${field.label} is required`);
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    if (value) {
      stored[field.slug] = { label: field.label, value };
    }
  }

  return { values: stored, fields: allowed };
}

async function createField({ label, is_required = false }) {
  const trimmed = String(label || '').trim();
  if (!trimmed) {
    const err = new Error('Field label is required');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  if (trimmed.length > 100) {
    const err = new Error('Field label must be 100 characters or less');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  let slug = slugifyLabel(trimmed);
  if (!slug) {
    const err = new Error('Field label must include letters or numbers');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  if (RESERVED_SLUGS.has(slug)) {
    const err = new Error('That name is reserved for a built-in remark field');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const existing = await db.query('SELECT slug FROM remark_input_fields');
  const used = new Set((existing || []).map((row) => row.slug));
  if (used.has(slug)) {
    let suffix = 2;
    while (used.has(`${slug}_${suffix}`.slice(0, 64))) suffix += 1;
    slug = `${slug}_${suffix}`.slice(0, 64);
  }

  const maxOrderRow = await db.queryFirst('SELECT MAX(sort_order) AS max_order FROM remark_input_fields');
  const sortOrder = Math.max(100, Number(maxOrderRow?.max_order) || 100) + 10;
  const result = await db.insert(
    `INSERT INTO remark_input_fields (slug, label, is_required, sort_order)
     VALUES (?, ?, ?, ?)`,
    [slug, trimmed, is_required ? 1 : 0, sortOrder]
  );
  return getFieldById(result.insertId);
}

async function updateField(id, { label, is_required }) {
  const existing = await getFieldById(id);
  if (!existing) {
    const err = new Error('Remark field not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }
  const nextLabel = label !== undefined ? String(label).trim() : existing.label;
  if (!nextLabel) {
    const err = new Error('Field label is required');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  const nextRequired = is_required !== undefined ? !!is_required : existing.is_required;
  await db.execute(
    'UPDATE remark_input_fields SET label = ?, is_required = ? WHERE id = ?',
    [nextLabel, nextRequired ? 1 : 0, id]
  );
  return getFieldById(id);
}

async function deleteField(id) {
  const existing = await getFieldById(id);
  if (!existing) {
    const err = new Error('Remark field not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }
  await db.execute('DELETE FROM remark_input_fields WHERE id = ?', [id]);
  return true;
}

async function setMemberFields(memberId, fieldIds) {
  const member = await db.queryFirst('SELECT id FROM team_members WHERE id = ?', [memberId]);
  if (!member) {
    const err = new Error('Team member not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  await db.execute('DELETE FROM team_member_remark_fields WHERE team_member_id = ?', [memberId]);
  if (!Array.isArray(fieldIds) || fieldIds.length === 0) {
    return getFieldsForMember(memberId);
  }

  const all = await listAllFields();
  const validIds = new Set(all.map((field) => Number(field.id)).filter((id) => id > 0));
  const uniqueIds = [...new Set(fieldIds.map((id) => Number(id)).filter((id) => validIds.has(id)))];

  for (const fieldId of uniqueIds) {
    await db.execute(
      'INSERT IGNORE INTO team_member_remark_fields (team_member_id, field_id) VALUES (?, ?)',
      [memberId, fieldId]
    );
  }
  return getFieldsForMember(memberId);
}

module.exports = {
  isMissingTable,
  isMissingColumn,
  listAllFields,
  getFieldById,
  getAssignedFieldIds,
  getAssignedFieldIdsByMember,
  getFieldsForMember,
  getFieldsForUser,
  shouldEnforceRequired,
  normalizeExtraFieldValues,
  extraFieldsToList,
  formatExtraFieldsForTeams,
  parseStoredExtraFields,
  createField,
  updateField,
  deleteField,
  setMemberFields,
};
