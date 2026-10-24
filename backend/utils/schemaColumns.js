const db = require('../db');

const cache = new Map();

async function hasColumn(table, column, database = db) {
  const key = `${table}.${column}`;
  if (cache.has(key)) return cache.get(key);
  const rows = await database.query(
    `SELECT 1 AS ok
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [table, column]
  );
  const ok = rows.length > 0;
  cache.set(key, ok);
  return ok;
}

function clearColumnCache() {
  cache.clear();
}

/** SQL fragment that hides soft-deleted tasks, or '' when the column is not migrated yet. */
async function activeTaskSql(alias, database = db) {
  if (!(await hasColumn('tasks', 'is_deleted', database))) return '';
  const column = alias ? `${alias}.is_deleted` : 'is_deleted';
  return `COALESCE(${column}, 0) = 0`;
}

module.exports = { hasColumn, clearColumnCache, activeTaskSql };
