#!/usr/bin/env node
/**
 * Idempotent Reporting API migration (Spec v2.0).
 * Creates NEW tables only. Does not modify existing app tables.
 *
 *   node scripts/migrate-reporting-api.js
 *   node scripts/migrate-reporting-api.js --down
 *
 * Reviewed manually — never auto-run from server startup.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../db');

async function up() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS reporting_api_keys (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      key_hash CHAR(64) NOT NULL,
      key_prefix VARCHAR(16) NOT NULL,
      owner_user_id INT NULL,
      allowed_project_ids JSON NOT NULL,
      allowed_field_groups JSON NOT NULL,
      scope ENUM('read') NOT NULL DEFAULT 'read',
      ip_allowlist JSON NULL,
      expires_at DATETIME NULL,
      revoked_at DATETIME NULL,
      last_used_at DATETIME NULL,
      rotated_from_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_reporting_key_hash (key_hash),
      INDEX idx_reporting_keys_prefix (key_prefix)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('ok reporting_api_keys');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS reporting_saved_configs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      owner_user_id INT NULL,
      project_ids JSON NOT NULL,
      fields JSON NOT NULL,
      filters JSON NOT NULL,
      generated_url TEXT NOT NULL,
      api_key_id INT NULL,
      m_query MEDIUMTEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_reporting_configs_owner (owner_user_id),
      INDEX idx_reporting_configs_key (api_key_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('ok reporting_saved_configs');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS reporting_audit_log (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      key_id INT NULL,
      user_id INT NULL,
      endpoint VARCHAR(255) NOT NULL,
      project_ids JSON NULL,
      fields JSON NULL,
      filters JSON NULL,
      row_count INT NULL,
      duration_ms INT NULL,
      status_code INT NULL,
      ip VARCHAR(64) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_reporting_audit_key (key_id),
      INDEX idx_reporting_audit_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('ok reporting_audit_log');
  console.log('Suggested indexes (apply separately if needed):');
  console.log('  tasks (project_id, updated_at, id)');
  console.log('  tasks (project_id, status)');
  console.log('  tasks (project_id, end_date)');
  console.log('  task_remarks (task_id, remark_type, remark_date)');
}

async function down() {
  await db.execute('DROP TABLE IF EXISTS reporting_audit_log');
  await db.execute('DROP TABLE IF EXISTS reporting_saved_configs');
  await db.execute('DROP TABLE IF EXISTS reporting_api_keys');
  console.log('dropped reporting_* tables');
}

async function main() {
  const args = process.argv.slice(2);
  try {
    if (args.includes('--down')) await down();
    else await up();
  } finally {
    if (typeof db.close === 'function') await db.close();
    else if (typeof db.end === 'function') await db.end();
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
