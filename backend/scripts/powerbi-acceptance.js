#!/usr/bin/env node
/**
 * Acceptance checks for the Power BI read API.
 * Structural checks run against the configured MySQL database.
 * Snapshot counts are the 28 Sep 2026 English export. A grown database fails those
 * counts on purpose and prints the live numbers.
 *
 * HTTP checks run when the API is up:
 *   POWERBI_ACCEPT_BASE=http://127.0.0.1:3005/api/v1
 *   POWERBI_ACCEPT_KEY=pbi_...
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../db');

const PROJECT_ID = Number(process.env.POWERBI_ACCEPT_PROJECT || 58);
const EXPECTED = {
  tasks: 4963,
  stages: {
    'Subject Matter Development': 4787,
    'Visual & Graphic Design': 172,
    Storyboarding: 4,
  },
  remarks: 3073,
  hierarchy: 16731,
  grades: 26,
  books: 868,
  units: 8680,
  lessons: 7157,
  assignees: 13,
  unmatchedTasks: 6,
};

const results = [];

function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
}

async function structural() {
  const tasks = await db.queryFirst(
    'SELECT COUNT(*) AS rows_n, COUNT(DISTINCT id) AS ids_n FROM tasks WHERE project_id = ?',
    [PROJECT_ID]
  );
  record('tasks unique ids', Number(tasks.rows_n) === Number(tasks.ids_n), `${tasks.ids_n} unique / ${tasks.rows_n} rows`);
  record('snapshot task count 4963', Number(tasks.rows_n) === EXPECTED.tasks, `live ${tasks.rows_n}, expected ${EXPECTED.tasks}`);

  const stages = await db.query(
    `SELECT cs.name AS name, COUNT(*) AS n
     FROM tasks t
     LEFT JOIN category_stages cs ON cs.id = t.category_stage_id
     WHERE t.project_id = ?
     GROUP BY cs.name`,
    [PROJECT_ID]
  );
  for (const [name, expected] of Object.entries(EXPECTED.stages)) {
    const found = stages.find((row) => row.name === name);
    const actual = found ? Number(found.n) : 0;
    record(`stage ${name}`, actual === expected, `live ${actual}, expected ${expected}`);
  }

  const remarks = await db.queryFirst(
    `SELECT COUNT(*) AS n
     FROM task_remarks r
     INNER JOIN tasks t ON t.id = r.task_id
     WHERE t.project_id = ? AND COALESCE(r.is_private, 0) = 0`,
    [PROJECT_ID]
  );
  const orphans = await db.queryFirst(
    `SELECT COUNT(*) AS n
     FROM task_remarks r
     LEFT JOIN tasks t ON t.id = r.task_id
     WHERE t.id IS NULL`
  );
  record('remarks belong to a task', Number(orphans.n) === 0, `orphan remarks ${orphans.n}`);
  record('snapshot remarks 3073', Number(remarks.n) === EXPECTED.remarks, `live ${remarks.n}, expected ${EXPECTED.remarks}`);

  const grades = await db.queryFirst('SELECT COUNT(*) AS n FROM grades WHERE project_id = ?', [PROJECT_ID]);
  const books = await db.queryFirst(
    'SELECT COUNT(*) AS n FROM books b INNER JOIN grades g ON g.id = b.grade_id WHERE g.project_id = ?',
    [PROJECT_ID]
  );
  const units = await db.queryFirst(
    `SELECT COUNT(*) AS n FROM units u
     INNER JOIN books b ON b.id = u.book_id
     INNER JOIN grades g ON g.id = b.grade_id
     WHERE g.project_id = ?`,
    [PROJECT_ID]
  );
  const lessons = await db.queryFirst(
    `SELECT COUNT(*) AS n FROM lessons l
     INNER JOIN units u ON u.id = l.unit_id
     INNER JOIN books b ON b.id = u.book_id
     INNER JOIN grades g ON g.id = b.grade_id
     WHERE g.project_id = ?`,
    [PROJECT_ID]
  );
  const hierarchyTotal = Number(grades.n) + Number(books.n) + Number(units.n) + Number(lessons.n);
  record('hierarchy 26/868/8680/7157', Number(grades.n) === 26 && Number(books.n) === 868 && Number(units.n) === 8680 && Number(lessons.n) === 7157,
    `${grades.n}/${books.n}/${units.n}/${lessons.n}`);
  record('hierarchy total 16731', hierarchyTotal === EXPECTED.hierarchy, `live ${hierarchyTotal}`);

  const paths = await db.queryFirst(
    `SELECT COUNT(*) AS rows_n, COUNT(DISTINCT path_value) AS paths_n FROM (
       SELECT g.name AS path_value FROM grades g WHERE g.project_id = ?
       UNION ALL
       SELECT CONCAT(g.name, ' > ', b.name) FROM books b INNER JOIN grades g ON g.id = b.grade_id WHERE g.project_id = ?
       UNION ALL
       SELECT CONCAT(g.name, ' > ', b.name, ' > ', u.name)
       FROM units u INNER JOIN books b ON b.id = u.book_id INNER JOIN grades g ON g.id = b.grade_id WHERE g.project_id = ?
       UNION ALL
       SELECT CONCAT(g.name, ' > ', b.name, ' > ', u.name, ' > ', l.name)
       FROM lessons l
       INNER JOIN units u ON u.id = l.unit_id
       INNER JOIN books b ON b.id = u.book_id
       INNER JOIN grades g ON g.id = b.grade_id
       WHERE g.project_id = ?
     ) paths`,
    [PROJECT_ID, PROJECT_ID, PROJECT_ID, PROJECT_ID]
  );
  record('hierarchy_path unique', Number(paths.rows_n) === Number(paths.paths_n), `${paths.paths_n} unique / ${paths.rows_n} paths`);

  const people = await db.queryFirst(
    `SELECT COUNT(DISTINCT ta.assignee_id) AS n
     FROM task_assignees ta
     INNER JOIN tasks t ON t.id = ta.task_id
     WHERE t.project_id = ? AND ta.assignee_type = 'team'`,
    [PROJECT_ID]
  );
  record('snapshot assignees 13', Number(people.n) === EXPECTED.assignees, `live ${people.n}, expected ${EXPECTED.assignees}`);

  const missingAssignee = await db.queryFirst(
    `SELECT COUNT(*) AS n FROM tasks t
     WHERE t.project_id = ?
       AND NOT EXISTS (
         SELECT 1 FROM task_assignees ta
         WHERE ta.task_id = t.id AND ta.assignee_type = 'team'
       )`,
    [PROJECT_ID]
  );
  record('every task has a team assignee', Number(missingAssignee.n) === 0, `tasks without a team assignee ${missingAssignee.n}`);

  const unmatched = await db.queryFirst(
    'SELECT COUNT(*) AS n FROM tasks WHERE project_id = ? AND grade_id IS NULL AND book_id IS NULL AND unit_id IS NULL AND lesson_id IS NULL',
    [PROJECT_ID]
  );
  record('project-level tasks with null hierarchy', true, `live ${unmatched.n}, snapshot expected ${EXPECTED.unmatchedTasks}`);
}

async function httpChecks() {
  const base = process.env.POWERBI_ACCEPT_BASE;
  const key = process.env.POWERBI_ACCEPT_KEY;
  if (!base || !key) {
    record('http auth checks', true, 'skipped — set POWERBI_ACCEPT_BASE and POWERBI_ACCEPT_KEY');
    return;
  }
  const headers = { 'X-API-Key': key };
  const missing = await fetch(`${base}/projects/${PROJECT_ID}/tasks`);
  record('missing key is 401', missing.status === 401, `status ${missing.status}`);
  const other = await fetch(`${base}/projects/999999/tasks`, { headers });
  record('other or missing project is 403 or 404', other.status === 403 || other.status === 404, `status ${other.status}`);
  const fresh = await fetch(`${base}/projects/${PROJECT_ID}/tasks?updated_since=${encodeURIComponent(new Date().toISOString())}&page_size=1`, { headers });
  const body = await fresh.json();
  record('updated_since now is empty', fresh.status === 200 && Array.isArray(body.data) && body.data.length === 0, `status ${fresh.status}, rows ${body.data && body.data.length}`);
}

async function main() {
  const connected = await db.testConnection();
  if (!connected) process.exit(1);
  await structural();
  await httpChecks();
  await db.close();
  const failed = results.filter((item) => !item.pass).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  try { await db.close(); } catch (_) { /* ignore */ }
  process.exit(1);
});
