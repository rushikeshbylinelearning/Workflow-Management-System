const db = require('../db');

const SYSTEM_OPTIONS = [
  { slug: 'general', label: 'General / In Progress', status_effect: 'in-progress', is_system: 1, sort_order: 10 },
  { slug: 'complete', label: 'Completed', status_effect: 'under-review', is_system: 1, sort_order: 20 },
  { slug: 'skipped', label: 'Skipped', status_effect: 'skipped', is_system: 1, sort_order: 30 },
  { slug: 'other', label: 'Other', status_effect: 'none', is_system: 1, sort_order: 40 },
];

const VALID_STATUS_EFFECTS = new Set(['none', 'in-progress', 'under-review', 'skipped']);

function isMissingTable(err) {
  return !!err && (err.code === 'ER_NO_SUCH_TABLE' || /doesn't exist/i.test(err.message || ''));
}

function mapOption(row) {
  if (!row) return null;
  return {
    id: row.id ?? null,
    slug: row.slug,
    label: row.label,
    status_effect: row.status_effect || 'none',
    is_system: !!(row.is_system === true || row.is_system === 1),
    sort_order: Number(row.sort_order) || 100,
  };
}

function fallbackSystemOptions() {
  return SYSTEM_OPTIONS.map((option, index) => mapOption({ ...option, id: -(index + 1) }));
}

async function listAllOptions() {
  try {
    const rows = await db.query(
      `SELECT id, slug, label, status_effect, is_system, sort_order
       FROM remark_options
       ORDER BY sort_order ASC, id ASC`
    );
    if (!rows || rows.length === 0) return fallbackSystemOptions();
    return rows.map(mapOption);
  } catch (err) {
    if (isMissingTable(err)) return fallbackSystemOptions();
    throw err;
  }
}

async function getOptionBySlug(slug) {
  const key = String(slug || '').trim().toLowerCase();
  if (!key) return null;
  try {
    const row = await db.queryFirst(
      `SELECT id, slug, label, status_effect, is_system, sort_order
       FROM remark_options WHERE slug = ? LIMIT 1`,
      [key]
    );
    if (row) return mapOption(row);
  } catch (err) {
    if (!isMissingTable(err)) throw err;
  }
  const fallback = SYSTEM_OPTIONS.find((option) => option.slug === key);
  return fallback ? mapOption({ ...fallback, id: null }) : null;
}

async function getSystemOptionIds() {
  try {
    const rows = await db.query(
      'SELECT id FROM remark_options WHERE is_system = 1 ORDER BY sort_order ASC, id ASC'
    );
    return rows.map((row) => Number(row.id));
  } catch (err) {
    if (isMissingTable(err)) return [];
    throw err;
  }
}

async function getAssignedOptionIds(memberId) {
  try {
    const rows = await db.query(
      'SELECT option_id FROM team_member_remark_options WHERE team_member_id = ?',
      [memberId]
    );
    return rows.map((row) => Number(row.option_id));
  } catch (err) {
    if (isMissingTable(err)) return [];
    throw err;
  }
}

async function getAssignedOptionIdsByMember(memberIds) {
  const map = {};
  if (!Array.isArray(memberIds) || memberIds.length === 0) return map;
  try {
    const placeholders = memberIds.map(() => '?').join(',');
    const rows = await db.query(
      `SELECT team_member_id, option_id
       FROM team_member_remark_options
       WHERE team_member_id IN (${placeholders})`,
      memberIds
    );
    for (const row of rows) {
      const memberId = Number(row.team_member_id);
      if (!map[memberId]) map[memberId] = [];
      map[memberId].push(Number(row.option_id));
    }
    return map;
  } catch (err) {
    if (isMissingTable(err)) return map;
    throw err;
  }
}

async function getOptionsForMember(memberId) {
  const all = await listAllOptions();
  const assigned = await getAssignedOptionIds(memberId);
  if (assigned.length === 0) {
    return all.filter((option) => option.is_system);
  }
  const allowed = new Set(assigned);
  return all.filter((option) => allowed.has(Number(option.id)));
}

async function getOptionsForUser(user) {
  if (!user) return fallbackSystemOptions();
  if (user.type === 'admin' || user.role === 'project_manager') {
    return listAllOptions();
  }
  if (user.type === 'team') {
    return getOptionsForMember(user.id);
  }
  return listAllOptions();
}

async function resolveOptionForUser(slug, user) {
  const option = await getOptionBySlug(slug);
  if (!option) return null;
  if (!user || user.type === 'admin' || user.role === 'project_manager') {
    return option;
  }
  if (user.type === 'team') {
    const allowed = await getOptionsForMember(user.id);
    return allowed.some((item) => item.slug === option.slug) ? option : null;
  }
  return option;
}

function slugifyLabel(label) {
  const slug = String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
  return slug;
}

async function createOption({ label, status_effect = 'none' }) {
  const trimmed = String(label || '').trim();
  if (!trimmed) {
    const err = new Error('Option label is required');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  if (trimmed.length > 100) {
    const err = new Error('Option label must be 100 characters or less');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  const effect = VALID_STATUS_EFFECTS.has(status_effect) ? status_effect : 'none';
  let slug = slugifyLabel(trimmed);
  if (!slug) {
    const err = new Error('Option label must include letters or numbers');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const reserved = new Set(SYSTEM_OPTIONS.map((option) => option.slug));
  if (reserved.has(slug)) {
    const err = new Error('That name is reserved for a built-in option');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const existing = await db.query('SELECT slug FROM remark_options');
  const used = new Set(existing.map((row) => row.slug));
  if (used.has(slug)) {
    let suffix = 2;
    while (used.has(`${slug}_${suffix}`.slice(0, 64))) suffix += 1;
    slug = `${slug}_${suffix}`.slice(0, 64);
  }

  const maxOrderRow = await db.queryFirst('SELECT MAX(sort_order) AS max_order FROM remark_options');
  const sortOrder = Math.max(100, Number(maxOrderRow?.max_order) || 100) + 10;
  const result = await db.insert(
    `INSERT INTO remark_options (slug, label, status_effect, is_system, sort_order)
     VALUES (?, ?, ?, 0, ?)`,
    [slug, trimmed, effect, sortOrder]
  );
  return getOptionById(result.insertId);
}

async function getOptionById(id) {
  const row = await db.queryFirst(
    `SELECT id, slug, label, status_effect, is_system, sort_order
     FROM remark_options WHERE id = ? LIMIT 1`,
    [id]
  );
  return mapOption(row);
}

async function updateOption(id, { label, status_effect }) {
  const existing = await getOptionById(id);
  if (!existing) {
    const err = new Error('Remark option not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (existing.is_system) {
    const err = new Error('Built-in options cannot be edited');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  const nextLabel = label !== undefined ? String(label).trim() : existing.label;
  if (!nextLabel) {
    const err = new Error('Option label is required');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  const nextEffect = status_effect !== undefined
    ? (VALID_STATUS_EFFECTS.has(status_effect) ? status_effect : existing.status_effect)
    : existing.status_effect;
  await db.execute(
    'UPDATE remark_options SET label = ?, status_effect = ? WHERE id = ?',
    [nextLabel, nextEffect, id]
  );
  return getOptionById(id);
}

async function deleteOption(id) {
  const existing = await getOptionById(id);
  if (!existing) {
    const err = new Error('Remark option not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (existing.is_system) {
    const err = new Error('Built-in options cannot be removed');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  await db.execute('DELETE FROM remark_options WHERE id = ?', [id]);
  return true;
}

async function setMemberOptions(memberId, optionIds) {
  const member = await db.queryFirst('SELECT id FROM team_members WHERE id = ?', [memberId]);
  if (!member) {
    const err = new Error('Team member not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const resetToDefault = !Array.isArray(optionIds) || optionIds.length === 0;
  await db.execute('DELETE FROM team_member_remark_options WHERE team_member_id = ?', [memberId]);
  if (resetToDefault) {
    return getOptionsForMember(memberId);
  }

  const all = await listAllOptions();
  const validIds = new Set(all.map((option) => Number(option.id)).filter((id) => id > 0));
  const uniqueIds = [...new Set(optionIds.map((id) => Number(id)).filter((id) => validIds.has(id)))];
  if (uniqueIds.length === 0) {
    const err = new Error('Select at least one remark option, or clear all to restore the default set');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  for (const optionId of uniqueIds) {
    await db.execute(
      'INSERT IGNORE INTO team_member_remark_options (team_member_id, option_id) VALUES (?, ?)',
      [memberId, optionId]
    );
  }
  return getOptionsForMember(memberId);
}

function labelForSlug(slug, options) {
  const key = String(slug || '').trim().toLowerCase();
  const match = (options || []).find((option) => option.slug === key);
  if (match) return match.label;
  const fallback = SYSTEM_OPTIONS.find((option) => option.slug === key);
  return fallback?.label || slug || '—';
}

module.exports = {
  SYSTEM_OPTIONS,
  VALID_STATUS_EFFECTS,
  listAllOptions,
  getOptionBySlug,
  getOptionById,
  getSystemOptionIds,
  getAssignedOptionIds,
  getAssignedOptionIdsByMember,
  getOptionsForMember,
  getOptionsForUser,
  resolveOptionForUser,
  createOption,
  updateOption,
  deleteOption,
  setMemberOptions,
  labelForSlug,
};
