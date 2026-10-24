#!/usr/bin/env node
/**
 * Idempotent Power BI source migration.
 * Adds columns and tables. Does not delete existing task or remark rows.
 *
 *   node scripts/migrate-powerbi.js
 *   node scripts/migrate-powerbi.js --down
 *
 * --down drops only the objects this script created (powerbi_api_keys,
 * task_history_events, and the new task columns). Take a database backup first.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../db');

async function columnExists(table, column) {
  const rows = await db.query(
    `SELECT 1 AS ok FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}

async function indexExists(table, name) {
  const rows = await db.query(
    `SELECT 1 AS ok FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
    [table, name]
  );
  return rows.length > 0;
}

async function addColumn(table, column, definition) {
  if (await columnExists(table, column)) {
    console.log(`skip column ${table}.${column}`);
    return;
  }
  await db.execute(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  console.log(`added ${table}.${column}`);
}

async function addIndex(table, name, columns) {
  if (await indexExists(table, name)) {
    console.log(`skip index ${name}`);
    return;
  }
  await db.execute(`ALTER TABLE \`${table}\` ADD INDEX \`${name}\` (${columns})`);
  console.log(`added index ${name}`);
}

async function up() {
  await addColumn('tasks', 'completed_date', 'DATE NULL');
  await addColumn('tasks', 'assigned_date', 'DATE NULL');
  await addColumn('tasks', 'assigned_by_id', 'INT NULL');
  await addColumn('tasks', 'is_deleted', 'TINYINT(1) NOT NULL DEFAULT 0');
  await addColumn('tasks', 'deleted_at', 'DATETIME NULL');

  await addIndex('tasks', 'idx_tasks_project_updated', 'project_id, updated_at, id');
  await addIndex('tasks', 'idx_tasks_project_due', 'project_id, end_date');
  await addIndex('tasks', 'idx_tasks_project_status', 'project_id, status');
  await addIndex('tasks', 'idx_tasks_is_deleted', 'is_deleted');
  await addIndex('task_remarks', 'idx_task_remarks_updated', 'updated_at');
  await addIndex('task_assignees', 'idx_task_assignees_task', 'task_id, assignee_id');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS powerbi_api_keys (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      key_hash CHAR(64) NOT NULL,
      key_prefix VARCHAR(16) NOT NULL,
      scope ENUM('read', 'read_admin') NOT NULL DEFAULT 'read',
      project_ids JSON NOT NULL,
      expires_at DATETIME NULL,
      revoked_at DATETIME NULL,
      last_used_at DATETIME NULL,
      rotated_from_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_powerbi_key_hash (key_hash)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS task_history_events (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      task_id INT NOT NULL,
      action VARCHAR(40) NOT NULL,
      field_name VARCHAR(64) NULL,
      old_value TEXT NULL,
      new_value TEXT NULL,
      changed_by_id INT NOT NULL,
      changed_by_name VARCHAR(255) NOT NULL,
      changed_at DATETIME NOT NULL,
      details TEXT NULL,
      source_ref VARCHAR(64) NULL,
      UNIQUE KEY uq_task_history_source (source_ref),
      INDEX idx_task_history_task (task_id),
      INDEX idx_task_history_changed (changed_at, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const backfillComplete = await db.execute(`
    UPDATE tasks t
    INNER JOIN (
      SELECT task_id, MAX(remark_date) AS remark_date
      FROM task_remarks
      WHERE remark_type = 'complete' AND COALESCE(is_private, 0) = 0
      GROUP BY task_id
    ) r ON r.task_id = t.id
    SET t.completed_date = r.remark_date, t.updated_at = t.updated_at
    WHERE t.status = 'completed' AND t.completed_date IS NULL
  `);
  console.log(`backfilled completed_date rows: ${backfillComplete.affectedRows}`);

  const backfillAssigned = await db.execute(`
    UPDATE tasks t
    INNER JOIN (
      SELECT task_id, MIN(created_at) AS assigned_at
      FROM task_assignees
      WHERE assignee_type = 'team'
      GROUP BY task_id
    ) a ON a.task_id = t.id
    SET t.assigned_date = DATE(a.assigned_at), t.updated_at = t.updated_at
    WHERE t.assigned_date IS NULL
  `);
  console.log(`backfilled assigned_date rows: ${backfillAssigned.affectedRows}`);

  const history = await db.execute(`
    INSERT INTO task_history_events
      (task_id, action, field_name, old_value, new_value, changed_by_id, changed_by_name, changed_at, details, source_ref)
    SELECT
      h.task_id,
      CASE h.action_type
        WHEN 'task_created' THEN 'created'
        WHEN 'remark_added' THEN 'remark_added'
        ELSE 'status_changed'
      END,
      CASE WHEN h.previous_status IS NOT NULL OR h.new_status IS NOT NULL THEN 'status' ELSE NULL END,
      h.previous_status,
      h.new_status,
      h.user_id,
      COALESCE(tm.name, au.name, 'unknown'),
      h.created_at,
      h.action_type,
      CONCAT('remark_history:', h.id)
    FROM task_remark_history h
    LEFT JOIN team_members tm ON h.user_role = 'assignee' AND tm.id = h.user_id
    LEFT JOIN admin_users au ON h.user_role = 'admin' AND au.id = h.user_id
    WHERE NOT EXISTS (
      SELECT 1 FROM task_history_events e WHERE e.source_ref = CONCAT('remark_history:', h.id)
    )
  `);
  console.log(`backfilled history events: ${history.affectedRows}`);
  console.log('Power BI migration applied. Existing task rows were not deleted.');
}

async function down() {
  console.log('BACKUP NOTE: this removes Power BI key rows, task history events, and the new task columns. Task and remark rows stay.');
  await db.execute('DROP TABLE IF EXISTS powerbi_api_keys');
  await db.execute('DROP TABLE IF EXISTS task_history_events');
  for (const column of ['completed_date', 'assigned_date', 'assigned_by_id', 'is_deleted', 'deleted_at']) {
    if (await columnExists('tasks', column)) {
      await db.execute(`ALTER TABLE tasks DROP COLUMN \`${column}\``);
      console.log(`dropped tasks.${column}`);
    }
  }
}

async function main() {
  const connected = await db.testConnection();
  if (!connected) process.exit(1);
  if (process.argv.includes('--down')) await down();
  else await up();
  await db.close();
}

main().catch(async (error) => {
  console.error(error);
  try { await db.close(); } catch (_) { /* ignore */ }
  process.exit(1);
});
