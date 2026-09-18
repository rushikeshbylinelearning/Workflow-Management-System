#!/usr/bin/env node

/**
 * Create or update schema on an empty staging database.
 * Safe to re-run: duplicate table/column/key errors are skipped.
 *
 * Usage: node bootstrap-db.js
 */

const fs = require('fs');
const path = require('path');
const db = require('./db');

const SKIP_FILES = new Set([
  '01_example_migration.sql',
  'add_missing_tables.sql',
]);

const PREFERRED_ORDER = [
  '00_initial_schema.sql',
  '02_add_audit_logging.sql',
  '03_add_flag_extension_audit.sql',
  'add_roles_permissions.sql',
  'add_task_time_tracking.sql',
  'add_server_location_to_tasks.sql',
  'add_task_on_hold_status.sql',
  'add_task_returned_status.sql',
  'add_task_rework_count.sql',
  'add_task_resubmission_deadline.sql',
  'add_remark_fields.sql',
  'add_task_remark_history.sql',
  'add_teams_webhook_url.sql',
  'add_active_extension_requests.sql',
  'create_api_keys.sql',
  'add_missing_tables_safe.sql',
  'add_two_missing_tables.sql',
  'fix_team_members_and_performance_flags.sql',
  'fix_negative_time_logs.sql',
];

const IGNORABLE = /already exists|duplicate (column|key|entry)|multiple primary key|check that column\/key exists|can't drop|cannot (add|drop)|unknown column/i;

function parseSqlFile(sqlContent) {
  let cleaned = sqlContent
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith('--') && trimmed.length > 0;
    })
    .join('\n');

  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');

  return cleaned
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function listMigrationFiles() {
  const dir = path.join(__dirname, 'migrations');
  const onDisk = fs.readdirSync(dir).filter((file) => file.endsWith('.sql') && !SKIP_FILES.has(file));
  const ordered = PREFERRED_ORDER.filter((file) => onDisk.includes(file));
  const extras = onDisk.filter((file) => !PREFERRED_ORDER.includes(file)).sort();
  return [...ordered, ...extras];
}

async function run() {
  const connected = await db.testConnection();
  if (!connected) {
    throw new Error('Database connection failed. Check backend/.env DB_* values.');
  }

  const files = listMigrationFiles();
  console.log(`Running ${files.length} migration files against ${process.env.DB_NAME}`);

  for (const file of files) {
    const fullPath = path.join(__dirname, 'migrations', file);
    const statements = parseSqlFile(fs.readFileSync(fullPath, 'utf8'));
    console.log(`\n==> ${file} (${statements.length} statements)`);

    for (const statement of statements) {
      try {
        await db.execute(statement);
      } catch (error) {
        if (IGNORABLE.test(error.message)) {
          console.log(`    skip: ${error.message}`);
          continue;
        }
        console.error(`    failed SQL: ${statement.slice(0, 180)}`);
        throw error;
      }
    }
  }

  console.log('\nStaging database bootstrap complete.');
  console.log('Default admin (change immediately): admin@workflow.com / admin123');
}

run()
  .catch((error) => {
    console.error('bootstrap-db failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.close();
  });
