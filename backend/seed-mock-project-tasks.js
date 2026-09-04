/**
 * Seed one eLearning Design project plus 20 fully populated tasks.
 * Usage: node seed-mock-project-tasks.js
 *
 * Idempotent: re-running replaces the "UAE Citizen eLearning" mock project.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const PROJECT_NAME = 'UAE Citizen eLearning';

const CATEGORIES = [
  'Corporate E-Learning',
  'Curriculum Design',
  'Data Analysis',
  'eLearning Design',
  'IT Applications - Accelerators',
  'IT Applications - Flagships',
  'IT Applications - Utilities',
  'Tech Application',
  'Test Category',
];

const STAGES = [
  { name: 'Content & Instructional Design', description: 'Script and instructional design', isDefault: true },
  { name: 'Storyboarding', description: 'Visual narrative and screen flow', isDefault: false },
  { name: 'Visual & Graphic Design', description: 'UI, icons, and layout', isDefault: false },
  { name: 'Animation & Multimedia Development', description: 'Motion and media assets', isDefault: false },
  { name: 'eLearning Development (Authoring Tool Build)', description: 'Authoring and packaging', isDefault: false },
];

const SKILLS = [
  'Animators',
  'Graphic Designers',
  'Marketing',
  'Sales',
  'Content Writers',
  'Instructional Design',
  'Project Management',
  'Tech',
  'Developers',
  'Instructional Designers',
  'QA',
];

const MEMBERS = [
  { name: 'Aachal Shukla', email: 'aachal.s@bylinelearning.com', skills: ['Instructional Designers', 'Content Writers'] },
  { name: 'Aniket', email: 'aniket@bylinelearning.com', skills: ['Graphic Designers', 'Animators'] },
  { name: 'Ankita', email: 'ankita@bylinelearning.com', skills: ['Developers', 'QA'] },
];

const progressFor = (status) => {
  switch (status) {
    case 'not-started': return 0;
    case 'in-progress': return 50;
    case 'under-review': return 90;
    case 'completed': return 100;
    case 'blocked': return 25;
    case 'skipped': return 0;
    default: return 0;
  }
};

async function ensureNamed(conn, table, name, extraInsert) {
  const [rows] = await conn.query(`SELECT id FROM ${table} WHERE name = ? LIMIT 1`, [name]);
  if (rows[0]) return rows[0].id;
  const [result] = await conn.query(extraInsert.sql, extraInsert.params);
  return result.insertId;
}

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  console.log('Seeding mock project into', process.env.DB_NAME);

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

  for (const name of CATEGORIES) {
    await conn.query(
      'INSERT IGNORE INTO categories (name, description) VALUES (?, ?)',
      [name, `${name} category`]
    );
  }

  const [[category]] = await conn.query(
    "SELECT id FROM categories WHERE name = 'eLearning Design' LIMIT 1"
  );
  if (!category) throw new Error('eLearning Design category was not created');

  const stageIds = [];
  for (let i = 0; i < STAGES.length; i++) {
    const stage = STAGES[i];
    const id = await ensureNamed(conn, 'category_stages', stage.name, {
      sql: 'INSERT INTO category_stages (name, description, order_index) VALUES (?, ?, ?)',
      params: [stage.name, stage.description, i + 1],
    });
    stageIds.push({ id, ...stage });
    await conn.query(
      `INSERT INTO stage_templates (category_id, stage_id, order_index, is_default)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE order_index = VALUES(order_index), is_default = VALUES(is_default)`,
      [category.id, id, i + 1, stage.isDefault ? 1 : 0]
    );
  }

  const skillIds = {};
  for (const name of SKILLS) {
    skillIds[name] = await ensureNamed(conn, 'skills', name, {
      sql: 'INSERT INTO skills (name, description) VALUES (?, ?)',
      params: [name, name],
    });
  }

  const memberIds = [];
  for (const member of MEMBERS) {
    const id = await ensureNamed(conn, 'team_members', member.name, {
      sql: 'INSERT INTO team_members (name, email, passcode, role, is_active) VALUES (?, ?, ?, ?, 1)',
      params: [member.name, member.email, '123456', 'employee'],
    });
    await conn.query(
      'UPDATE team_members SET email = ?, passcode = ?, is_active = 1 WHERE id = ?',
      [member.email, '123456', id]
    );
    memberIds.push(id);
    for (const skillName of member.skills) {
      if (!skillIds[skillName]) continue;
      await conn.query(
        'INSERT IGNORE INTO team_member_skills (team_member_id, skill_id) VALUES (?, ?)',
        [id, skillIds[skillName]]
      );
    }
  }

  const [[adminMember]] = await conn.query(
    "SELECT id FROM team_members WHERE email = 'info@bylinelearning.com' LIMIT 1"
  );
  if (adminMember) memberIds.push(adminMember.id);

  const [[existingProject]] = await conn.query(
    'SELECT id FROM projects WHERE name = ? LIMIT 1',
    [PROJECT_NAME]
  );
  if (existingProject) {
    await conn.query('DELETE FROM tasks WHERE project_id = ?', [existingProject.id]);
    await conn.query('DELETE FROM grades WHERE project_id = ?', [existingProject.id]);
    await conn.query('DELETE FROM project_members WHERE project_id = ?', [existingProject.id]);
    await conn.query('DELETE FROM projects WHERE id = ?', [existingProject.id]);
  }

  const defaultStageId = stageIds.find((s) => s.isDefault)?.id || stageIds[0].id;
  const [projectResult] = await conn.query(
    `INSERT INTO projects (name, description, category_id, current_stage_id, status, progress, start_date, end_date, created_by)
     VALUES (?, ?, ?, ?, 'active', 0, ?, ?, 1)`,
    [
      PROJECT_NAME,
      'Mock eLearning project for UAE Citizen with a full Grade → Book → Unit → Lesson hierarchy and 20 production tasks.',
      category.id,
      defaultStageId,
      '2026-09-01',
      '2026-12-15',
    ]
  );
  const projectId = projectResult.insertId;

  for (const memberId of [...new Set(memberIds)]) {
    await conn.query(
      `INSERT IGNORE INTO project_members (project_id, user_id, user_type, role)
       VALUES (?, ?, 'team', 'member')`,
      [projectId, memberId]
    );
  }

  async function addLesson(gradeName, bookName, unitName, lessonName) {
    const [gradeRows] = await conn.query(
      'SELECT id FROM grades WHERE project_id = ? AND name = ? LIMIT 1',
      [projectId, gradeName]
    );
    let gradeId = gradeRows[0]?.id;
    if (!gradeId) {
      const [ins] = await conn.query(
        'INSERT INTO grades (project_id, name, description, order_index) VALUES (?, ?, ?, ?)',
        [projectId, gradeName, gradeName, 0]
      );
      gradeId = ins.insertId;
    }

    const [books] = await conn.query(
      'SELECT id FROM books WHERE grade_id = ? AND name = ? LIMIT 1',
      [gradeId, bookName]
    );
    let bookId = books[0]?.id;
    if (!bookId) {
      const [ins] = await conn.query(
        'INSERT INTO books (grade_id, name, type, description, order_index) VALUES (?, ?, ?, ?, ?)',
        [gradeId, bookName, 'student', bookName, 0]
      );
      bookId = ins.insertId;
    }

    const [units] = await conn.query(
      'SELECT id FROM units WHERE book_id = ? AND name = ? LIMIT 1',
      [bookId, unitName]
    );
    let unitId = units[0]?.id;
    if (!unitId) {
      const [ins] = await conn.query(
        'INSERT INTO units (book_id, name, description, order_index) VALUES (?, ?, ?, ?)',
        [bookId, unitName, unitName, 0]
      );
      unitId = ins.insertId;
    }

    const [lessons] = await conn.query(
      'SELECT id FROM lessons WHERE unit_id = ? AND name = ? LIMIT 1',
      [unitId, lessonName]
    );
    let lessonId = lessons[0]?.id;
    if (!lessonId) {
      const [ins] = await conn.query(
        'INSERT INTO lessons (unit_id, name, description, order_index) VALUES (?, ?, ?, ?)',
        [unitId, lessonName, lessonName, 0]
      );
      lessonId = ins.insertId;
    }

    return {
      gradeId,
      bookId,
      unitId,
      lessonId,
      path: `${gradeName} > ${bookName} > ${unitName} > ${lessonName}`,
    };
  }

  const lessons = [
    await addLesson('Grade 5', 'Mathematics Book', 'Unit 2', 'Fractions'),
    await addLesson('Grade 5', 'Mathematics Book', 'Unit 2', 'Decimals'),
    await addLesson('Grade 6', 'Science Book', 'Unit 3', 'Energy'),
    await addLesson('Grade 7', 'English Book', 'Unit 1', 'Grammar'),
  ];

  const taskDefs = [
    { name: 'Write Fractions instructional script', description: 'Draft learning objectives, voiceover script, and knowledge checks for Fractions.', status: 'completed', priority: 'high', hours: 8, start: '2026-09-01', due: '2026-09-05', skills: ['Instructional Designers', 'Content Writers'], location: '\\\\fileserver\\uae-citizen\\g5\\fractions\\script.docx' },
    { name: 'Write Decimals instructional script', description: 'Create the instructional narrative and assessment items for Decimals.', status: 'in-progress', priority: 'high', hours: 8, start: '2026-09-02', due: '2026-09-08', skills: ['Instructional Designers'], location: '\\\\fileserver\\uae-citizen\\g5\\decimals\\script.docx' },
    { name: 'Write Energy lesson content', description: 'Prepare science explanation, examples, and quiz items for Energy.', status: 'not-started', priority: 'medium', hours: 10, start: '2026-09-08', due: '2026-09-15', skills: ['Content Writers', 'Instructional Design'], location: '' },
    { name: 'Write Grammar lesson content', description: 'Create grammar rules, examples, and practice items.', status: 'blocked', priority: 'medium', hours: 6, start: '2026-09-08', due: '2026-09-14', skills: ['Content Writers'], location: '\\\\fileserver\\uae-citizen\\g7\\grammar\\content.docx' },
    { name: 'Storyboard Fractions screens', description: 'Screen-by-screen storyboard for the Fractions module.', status: 'completed', priority: 'high', hours: 12, start: '2026-09-05', due: '2026-09-10', skills: ['Instructional Designers', 'Graphic Designers'], location: '\\\\fileserver\\uae-citizen\\g5\\fractions\\storyboard.fig' },
    { name: 'Storyboard Decimals screens', description: 'Storyboard interactions and visual flow for Decimals.', status: 'in-progress', priority: 'medium', hours: 12, start: '2026-09-08', due: '2026-09-16', skills: ['Instructional Design'], location: '' },
    { name: 'Storyboard Energy screens', description: 'Visual sequence and on-screen text for Energy.', status: 'not-started', priority: 'low', hours: 10, start: '2026-09-15', due: '2026-09-22', skills: ['Graphic Designers'], location: '' },
    { name: 'Storyboard Grammar screens', description: 'Storyboard grammar practice screens and feedback states.', status: 'not-started', priority: 'medium', hours: 8, start: '2026-09-14', due: '2026-09-21', skills: ['Instructional Designers'], location: '' },
    { name: 'Design Fractions UI kit', description: 'Icons, layouts, and visual styles for Fractions.', status: 'under-review', priority: 'high', hours: 16, start: '2026-09-08', due: '2026-09-16', skills: ['Graphic Designers'], location: '\\\\fileserver\\uae-citizen\\g5\\fractions\\ui-kit.psd' },
    { name: 'Design Decimals graphics', description: 'Charts, place-value visuals, and screen layouts.', status: 'in-progress', priority: 'medium', hours: 14, start: '2026-09-10', due: '2026-09-18', skills: ['Graphic Designers'], location: '' },
    { name: 'Design Energy infographics', description: 'Energy conversion diagrams and screen assets.', status: 'not-started', priority: 'medium', hours: 12, start: '2026-09-16', due: '2026-09-24', skills: ['Graphic Designers'], location: '' },
    { name: 'Design Grammar visual set', description: 'Character, icon, and layout pack for Grammar.', status: 'not-started', priority: 'low', hours: 10, start: '2026-09-18', due: '2026-09-25', skills: ['Graphic Designers'], location: '' },
    { name: 'Animate Fractions walkthrough', description: 'Motion graphics explaining fraction parts.', status: 'in-progress', priority: 'urgent', hours: 20, start: '2026-09-12', due: '2026-09-22', skills: ['Animators'], location: '\\\\fileserver\\uae-citizen\\g5\\fractions\\anim.aep' },
    { name: 'Animate Decimals examples', description: 'Short animated examples for decimal place value.', status: 'not-started', priority: 'high', hours: 18, start: '2026-09-16', due: '2026-09-26', skills: ['Animators'], location: '' },
    { name: 'Produce Energy multimedia', description: 'Video clips and motion assets for Energy.', status: 'not-started', priority: 'medium', hours: 16, start: '2026-09-20', due: '2026-09-30', skills: ['Animators', 'Tech'], location: '' },
    { name: 'Produce Grammar audio', description: 'Voiceover and supporting audio for Grammar.', status: 'blocked', priority: 'low', hours: 8, start: '2026-09-18', due: '2026-09-23', skills: ['Content Writers'], location: '' },
    { name: 'Build Fractions SCORM module', description: 'Author the Fractions lesson in the authoring tool.', status: 'not-started', priority: 'high', hours: 24, start: '2026-09-20', due: '2026-10-02', skills: ['Developers', 'Tech'], location: '\\\\fileserver\\uae-citizen\\g5\\fractions\\build' },
    { name: 'Build Decimals SCORM module', description: 'Assemble Decimals screens, interactions, and quiz.', status: 'not-started', priority: 'high', hours: 24, start: '2026-09-22', due: '2026-10-06', skills: ['Developers'], location: '' },
    { name: 'Build Energy SCORM module', description: 'Author Energy interactions and publish a review build.', status: 'not-started', priority: 'medium', hours: 20, start: '2026-09-25', due: '2026-10-08', skills: ['Developers', 'QA'], location: '' },
    { name: 'QA Grammar published package', description: 'Test Grammar package for SCORM, accessibility, and content defects.', status: 'not-started', priority: 'urgent', hours: 12, start: '2026-09-28', due: '2026-10-10', skills: ['QA', 'Project Management'], location: '\\\\fileserver\\uae-citizen\\g7\\grammar\\qa' },
  ];

  const uniqueMembers = [...new Set(memberIds)];
  let created = 0;

  for (let i = 0; i < taskDefs.length; i++) {
    const def = taskDefs[i];
    const stage = stageIds[Math.floor(i / 4)];
    const lesson = lessons[i % 4];
    const assigneeId = uniqueMembers[i % uniqueMembers.length];
    const [insert] = await conn.query(
      `INSERT INTO tasks (
         name, description, project_id, category_stage_id, status, priority,
         start_date, end_date, progress, estimated_hours, component_path,
         server_location, grade_id, book_id, unit_id, lesson_id, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        def.name,
        def.description,
        projectId,
        stage.id,
        def.status,
        def.priority,
        def.start,
        def.due,
        progressFor(def.status),
        def.hours,
        lesson.path,
        def.location || null,
        lesson.gradeId,
        lesson.bookId,
        lesson.unitId,
        lesson.lessonId,
      ]
    );
    const taskId = insert.insertId;
    await conn.query(
      'INSERT INTO task_assignees (task_id, assignee_id, assignee_type) VALUES (?, ?, ?)',
      [taskId, assigneeId, 'team']
    );
    for (const skillName of def.skills) {
      if (!skillIds[skillName]) continue;
      await conn.query(
        'INSERT IGNORE INTO task_skills (task_id, skill_id) VALUES (?, ?)',
        [taskId, skillIds[skillName]]
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
    `SELECT t.id, t.name, cs.name AS stage, t.status, t.priority, t.component_path
     FROM tasks t
     LEFT JOIN category_stages cs ON cs.id = t.category_stage_id
     WHERE t.project_id = ?
     ORDER BY t.id`,
    [projectId]
  );

  console.log(`\nProject: ${PROJECT_NAME} (id ${projectId})`);
  console.log(`Category: eLearning Design`);
  console.log(`Tasks created: ${created}`);
  console.table(taskRows.map((t) => ({
    id: t.id,
    name: t.name,
    stage: t.stage,
    status: t.status,
    priority: t.priority,
    hierarchy: t.component_path,
  })));

  await conn.end();
  console.log('\nOpen Tasks in the app and filter by project "UAE Citizen eLearning".');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
