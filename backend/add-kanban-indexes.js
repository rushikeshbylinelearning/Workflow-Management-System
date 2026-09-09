/**
 * add-kanban-indexes.js
 *
 * One-time migration: adds composite indexes to the `tasks` table to
 * dramatically speed up the Kanban dashboard-summary aggregation query.
 *
 * Run with:  node add-kanban-indexes.js
 *
 * The script is idempotent — it uses IF NOT EXISTS so re-running it
 * on a database that already has the indexes is safe.
 */

require('dotenv').config();
const db = require('./db');

const indexes = [
  // Core status + overdue index — used by COUNT / SUM(status = ?) and the
  // overdue calculation (end_date < CURDATE() AND status NOT IN (...))
  { name: 'idx_tasks_status', sql: 'ALTER TABLE tasks ADD INDEX idx_tasks_status (status)' },
  { name: 'idx_tasks_end_date', sql: 'ALTER TABLE tasks ADD INDEX idx_tasks_end_date (end_date)' },
  // Composite: status + end_date — lets MySQL satisfy the overdue predicate
  // in a single index range scan without visiting the row data
  { name: 'idx_tasks_status_end_date', sql: 'ALTER TABLE tasks ADD INDEX idx_tasks_status_end_date (status, end_date)' },
  // Project filter — used by all scoped dashboard queries
  { name: 'idx_tasks_project_id', sql: 'ALTER TABLE tasks ADD INDEX idx_tasks_project_id (project_id)' },
  // Composite: project + status — common combined filter
  { name: 'idx_tasks_project_status', sql: 'ALTER TABLE tasks ADD INDEX idx_tasks_project_status (project_id, status)' },
  // Stage filter
  { name: 'idx_tasks_stage_id', sql: 'ALTER TABLE tasks ADD INDEX idx_tasks_stage_id (category_stage_id)' },
  // Educational hierarchy filters
  { name: 'idx_tasks_grade_id', sql: 'ALTER TABLE tasks ADD INDEX idx_tasks_grade_id (grade_id)' },
  { name: 'idx_tasks_book_id', sql: 'ALTER TABLE tasks ADD INDEX idx_tasks_book_id (book_id)' },
  { name: 'idx_tasks_unit_id', sql: 'ALTER TABLE tasks ADD INDEX idx_tasks_unit_id (unit_id)' },
  { name: 'idx_tasks_lesson_id', sql: 'ALTER TABLE tasks ADD INDEX idx_tasks_lesson_id (lesson_id)' },
  // Priority filter
  { name: 'idx_tasks_priority', sql: 'ALTER TABLE tasks ADD INDEX idx_tasks_priority (priority)' },
  // Sort helpers
  { name: 'idx_tasks_created_at', sql: 'ALTER TABLE tasks ADD INDEX idx_tasks_created_at (created_at)' },
  // task_assignees — used for every assignee join
  { name: 'idx_task_assignees_task_id', sql: 'ALTER TABLE task_assignees ADD INDEX idx_task_assignees_task_id (task_id)' },
  { name: 'idx_task_assignees_assignee_id', sql: 'ALTER TABLE task_assignees ADD INDEX idx_task_assignees_assignee_id (assignee_id, assignee_type)' },
  // team_members_teams — used by team filter EXISTS subquery
  { name: 'idx_tmt_member_team', sql: 'ALTER TABLE team_members_teams ADD INDEX idx_tmt_member_team (team_member_id, team_id, is_active)' },
];

async function run() {
  console.log('🔧  Adding Kanban performance indexes...\n');
  let added = 0;
  let skipped = 0;

  for (const { name, sql } of indexes) {
    try {
      await db.query(sql);
      console.log(`  ✅  Added   ${name}`);
      added++;
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME' || err.message?.includes('Duplicate key name')) {
        console.log(`  ⏭️   Exists  ${name}`);
        skipped++;
      } else {
        console.error(`  ❌  Failed  ${name}: ${err.message}`);
      }
    }
  }

  console.log(`\n✨  Done — ${added} added, ${skipped} already existed.`);
  await db.close();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
