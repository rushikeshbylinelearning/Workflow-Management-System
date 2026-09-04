/**
 * Seed a second project whose tasks have NO educational hierarchy.
 * Usage: node seed-mock-project-no-hierarchy.js
 *
 * Idempotent: re-running replaces "Internal Ops - No Hierarchy".
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const PROJECT_NAME = 'Internal Ops - No Hierarchy';

const progressFor = (status) => {
  switch (status) {
    case 'not-started': return 0;
    case 'in-progress': return 50;
    case 'under-review': return 90;
    case 'completed': return 100;
    case 'blocked': return 25;
    default: return 0;
  }
};

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
  });

  console.log('Seeding no-hierarchy project into', process.env.DB_NAME);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS project_members (
      id INT PRIMARY KEY AUTO_INCREMENT,
      project_id INT NOT NULL,
      user_id INT NOT NULL,
      user_type VARCHAR(20) NOT NULL DEFAULT 'team',
      role VARCHAR(50) DEFAULT 'member',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_project_user (project_id, user_id, user_type),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const [[category]] = await conn.query(
    "SELECT id FROM categories WHERE name = 'Test Category' LIMIT 1"
  );
  if (!category) throw new Error('Test Category is missing. Run seed-mock-project-tasks.js first or add the category.');

  const stageNames = ['Plan', 'Core Development', 'Review'];
  const stageIds = [];
  for (let i = 0; i < stageNames.length; i++) {
    const [[stage]] = await conn.query(
      'SELECT id FROM category_stages WHERE name = ? LIMIT 1',
      [stageNames[i]]
    );
    if (!stage) throw new Error(`Stage "${stageNames[i]}" is missing`);
    stageIds.push(stage.id);
    await conn.query(
      `INSERT INTO stage_templates (category_id, stage_id, order_index, is_default)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE order_index = VALUES(order_index), is_default = VALUES(is_default)`,
      [category.id, stage.id, i + 1, i === 0 ? 1 : 0]
    );
  }

  const [members] = await conn.query('SELECT id FROM team_members WHERE is_active = 1 ORDER BY id');
  const memberIds = members.map((m) => m.id);
  if (memberIds.length === 0) throw new Error('No team members found');

  const [skills] = await conn.query(
    "SELECT id, name FROM skills WHERE name IN ('Project Management','QA','Tech','Developers','Content Writers')"
  );
  const skillByName = {};
  for (const s of skills) skillByName[s.name] = s.id;

  const [[existing]] = await conn.query(
    'SELECT id FROM projects WHERE name = ? LIMIT 1',
    [PROJECT_NAME]
  );
  if (existing) {
    await conn.query('DELETE FROM tasks WHERE project_id = ?', [existing.id]);
    await conn.query('DELETE FROM project_members WHERE project_id = ?', [existing.id]);
    await conn.query('DELETE FROM projects WHERE id = ?', [existing.id]);
  }

  const [projectResult] = await conn.query(
    `INSERT INTO projects (name, description, category_id, current_stage_id, status, progress, start_date, end_date, created_by)
     VALUES (?, ?, ?, ?, 'active', 0, ?, ?, 1)`,
    [
      PROJECT_NAME,
      'Test project with tasks that have no Grade, Book, Unit, or Lesson mapping.',
      category.id,
      stageIds[0],
      '2026-09-01',
      '2026-11-30',
    ]
  );
  const projectId = projectResult.insertId;

  for (const memberId of memberIds) {
    await conn.query(
      `INSERT IGNORE INTO project_members (project_id, user_id, user_type, role)
       VALUES (?, ?, 'team', 'member')`,
      [projectId, memberId]
    );
  }

  const taskDefs = [
    { name: 'Kickoff notes and scope', description: 'Capture project goals, owners, and timeline. No curriculum mapping.', stage: 0, status: 'completed', priority: 'high', hours: 4, start: '2026-09-01', due: '2026-09-03', skills: ['Project Management'], location: '\\\\fileserver\\internal-ops\\kickoff.docx' },
    { name: 'Stakeholder list', description: 'List reviewers and approvers for internal ops work.', stage: 0, status: 'completed', priority: 'medium', hours: 3, start: '2026-09-02', due: '2026-09-04', skills: ['Project Management'], location: '' },
    { name: 'Weekly status template', description: 'Create the recurring status email template.', stage: 0, status: 'in-progress', priority: 'medium', hours: 2, start: '2026-09-03', due: '2026-09-08', skills: ['Content Writers'], location: '' },
    { name: 'Build intake form', description: 'Simple request form for new internal work.', stage: 1, status: 'in-progress', priority: 'high', hours: 8, start: '2026-09-04', due: '2026-09-12', skills: ['Developers', 'Tech'], location: '\\\\fileserver\\internal-ops\\intake' },
    { name: 'Set up shared folder', description: 'Create the shared drive structure for this project.', stage: 1, status: 'not-started', priority: 'low', hours: 2, start: '2026-09-08', due: '2026-09-10', skills: ['Tech'], location: '' },
    { name: 'Write process checklist', description: 'Ops checklist with no educational hierarchy fields.', stage: 1, status: 'blocked', priority: 'medium', hours: 6, start: '2026-09-08', due: '2026-09-15', skills: ['Content Writers'], location: '' },
    { name: 'QA intake form', description: 'Test the intake form paths and permissions.', stage: 2, status: 'not-started', priority: 'high', hours: 5, start: '2026-09-12', due: '2026-09-18', skills: ['QA'], location: '' },
    { name: 'Review kickoff pack', description: 'Admin review of notes, template, and folder setup.', stage: 2, status: 'under-review', priority: 'medium', hours: 3, start: '2026-09-10', due: '2026-09-16', skills: ['Project Management'], location: '' },
    { name: 'Fix review comments', description: 'Address comments from the kickoff pack review.', stage: 1, status: 'not-started', priority: 'urgent', hours: 4, start: '2026-09-16', due: '2026-09-19', skills: ['Content Writers'], location: '' },
    { name: 'Close out test cycle', description: 'Confirm this project can be exported and filtered without hierarchy.', stage: 2, status: 'not-started', priority: 'low', hours: 3, start: '2026-09-19', due: '2026-09-22', skills: ['QA', 'Project Management'], location: '' },
  ];

  let created = 0;
  for (let i = 0; i < taskDefs.length; i++) {
    const def = taskDefs[i];
    const assigneeId = memberIds[i % memberIds.length];
    const [insert] = await conn.query(
      `INSERT INTO tasks (
         name, description, project_id, category_stage_id, status, priority,
         start_date, end_date, progress, estimated_hours, component_path,
         server_location, grade_id, book_id, unit_id, lesson_id, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, 1)`,
      [
        def.name,
        def.description,
        projectId,
        stageIds[def.stage],
        def.status,
        def.priority,
        def.start,
        def.due,
        progressFor(def.status),
        def.hours,
        null,
        def.location || null,
      ]
    );
    const taskId = insert.insertId;
    await conn.query(
      'INSERT INTO task_assignees (task_id, assignee_id, assignee_type) VALUES (?, ?, ?)',
      [taskId, assigneeId, 'team']
    );
    for (const skillName of def.skills) {
      if (!skillByName[skillName]) continue;
      await conn.query(
        'INSERT IGNORE INTO task_skills (task_id, skill_id) VALUES (?, ?)',
        [taskId, skillByName[skillName]]
      );
    }
    created += 1;
  }

  const [[{ avg_progress }]] = await conn.query(
    'SELECT AVG(progress) AS avg_progress FROM tasks WHERE project_id = ?',
    [projectId]
  );
  await conn.query('UPDATE projects SET progress = ? WHERE id = ?', [
    Math.round(avg_progress || 0),
    projectId,
  ]);

  const [taskRows] = await conn.query(
    `SELECT t.id, t.name, cs.name AS stage, t.status, t.grade_id, t.book_id, t.unit_id, t.lesson_id
     FROM tasks t
     LEFT JOIN category_stages cs ON cs.id = t.category_stage_id
     WHERE t.project_id = ?
     ORDER BY t.id`,
    [projectId]
  );

  console.log(`\nProject: ${PROJECT_NAME} (id ${projectId})`);
  console.log(`Tasks created: ${created} (grade/book/unit/lesson all NULL)`);
  console.table(taskRows);

  await conn.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
