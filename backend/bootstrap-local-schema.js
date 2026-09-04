/**
 * Local schema bootstrap for an empty bylinelm_workflow_db.
 * Creates tables the live app actually queries, then seeds login users.
 *
 * Usage: node bootstrap-local-schema.js
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const statements = [
  `CREATE TABLE IF NOT EXISTS admin_users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    email_verified_at DATETIME NULL,
    last_login_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS admin_sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id INT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS team_members (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    passcode VARCHAR(100) NOT NULL,
    role ENUM('employee', 'project_manager') NOT NULL DEFAULT 'employee',
    phone VARCHAR(50) NULL,
    is_active TINYINT(1) DEFAULT 1,
    last_login_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS team_member_sessions (
    id VARCHAR(64) PRIMARY KEY,
    team_member_id INT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_member (team_member_id),
    FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS team_member_permissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    team_member_id INT NOT NULL,
    permission_key VARCHAR(100) NOT NULL,
    is_granted TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_member_permission (team_member_id, permission_key),
    FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS functional_units (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS teams (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    functional_unit_id INT NULL,
    team_lead_id INT NULL,
    team_lead_type VARCHAR(20) NULL,
    max_capacity INT DEFAULT 10,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS team_members_teams (
    id INT PRIMARY KEY AUTO_INCREMENT,
    team_id INT NOT NULL,
    team_member_id INT NOT NULL,
    role VARCHAR(50) DEFAULT 'member',
    joined_date DATE NULL,
    is_active TINYINT(1) DEFAULT 1,
    UNIQUE KEY unique_team_member (team_id, team_member_id),
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS skills (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) UNIQUE NOT NULL,
    description VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS team_member_skills (
    id INT PRIMARY KEY AUTO_INCREMENT,
    team_member_id INT NOT NULL,
    skill_id INT NOT NULL,
    UNIQUE KEY unique_member_skill (team_member_id, skill_id),
    FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS team_skills (
    id INT PRIMARY KEY AUTO_INCREMENT,
    team_id INT NOT NULL,
    skill_id INT NOT NULL,
    proficiency_level VARCHAR(50) DEFAULT 'intermediate',
    UNIQUE KEY unique_team_skill (team_id, skill_id),
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS category_stages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    order_index INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS stage_templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    category_id INT NOT NULL,
    stage_id INT NOT NULL,
    order_index INT DEFAULT 0,
    is_default TINYINT(1) DEFAULT 0,
    UNIQUE KEY unique_category_stage (category_id, stage_id),
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    FOREIGN KEY (stage_id) REFERENCES category_stages(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS projects (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id INT NULL,
    current_stage_id INT NULL,
    parent_id INT NULL,
    status VARCHAR(50) DEFAULT 'planning',
    progress INT DEFAULT 0,
    start_date DATE NULL,
    end_date DATE NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (current_stage_id) REFERENCES category_stages(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS grades (
    id INT PRIMARY KEY AUTO_INCREMENT,
    project_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    order_index INT DEFAULT 0,
    weight DECIMAL(6,2) DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS books (
    id INT PRIMARY KEY AUTO_INCREMENT,
    grade_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'student',
    description TEXT,
    order_index INT DEFAULT 0,
    weight DECIMAL(6,2) DEFAULT 0,
    FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS units (
    id INT PRIMARY KEY AUTO_INCREMENT,
    book_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    order_index INT DEFAULT 0,
    weight DECIMAL(6,2) DEFAULT 0,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS lessons (
    id INT PRIMARY KEY AUTO_INCREMENT,
    unit_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    order_index INT DEFAULT 0,
    weight DECIMAL(6,2) DEFAULT 0,
    FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS tasks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    project_id INT NOT NULL,
    category_stage_id INT NULL,
    grade_id INT NULL,
    book_id INT NULL,
    unit_id INT NULL,
    lesson_id INT NULL,
    component_path VARCHAR(500) NULL,
    server_location VARCHAR(500) NULL,
    status VARCHAR(50) DEFAULT 'not-started',
    priority VARCHAR(20) DEFAULT 'medium',
    start_date DATE NULL,
    end_date DATE NULL,
    progress INT DEFAULT 0,
    estimated_hours INT DEFAULT 0,
    actual_hours INT DEFAULT 0,
    created_by INT NULL,
    rework_count INT DEFAULT 0,
    resubmission_deadline DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS task_assignees (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT NOT NULL,
    assignee_id INT NOT NULL,
    assignee_type ENUM('admin', 'team') NOT NULL DEFAULT 'team',
    UNIQUE KEY unique_assignee (task_id, assignee_id, assignee_type),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS task_skills (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT NOT NULL,
    skill_id INT NOT NULL,
    UNIQUE KEY unique_task_skill (task_id, skill_id),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS task_remarks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT NOT NULL,
    added_by INT NULL,
    added_by_type VARCHAR(20) NULL,
    remark_date DATETIME NULL,
    remark TEXT,
    remark_type VARCHAR(50) NULL,
    is_private TINYINT(1) DEFAULT 0,
    server_location VARCHAR(500) NULL,
    file_name VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS task_remark_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT NOT NULL,
    user_id INT NOT NULL,
    user_role ENUM('admin', 'assignee') NOT NULL,
    action_type ENUM(
      'task_created',
      'submitted',
      'remark_added',
      'approved',
      'denied',
      'reopened',
      'completed',
      'status_updated',
      'returned_for_rework'
    ) NOT NULL,
    remark_text TEXT,
    previous_status VARCHAR(32) NULL,
    new_status VARCHAR(32) NULL,
    rework_count INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_task_remark_history_task_created (task_id, created_at),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS task_extensions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT NOT NULL,
    requested_by INT NOT NULL,
    requested_by_type VARCHAR(20) DEFAULT 'team',
    current_due_date DATE NULL,
    requested_due_date DATE NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    reviewed_by INT NULL,
    reviewed_at DATETIME NULL,
    review_notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_task_extensions_task (task_id),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS performance_flags (
    id INT PRIMARY KEY AUTO_INCREMENT,
    team_member_id INT NOT NULL,
    task_id INT NULL,
    type ENUM('red', 'orange', 'yellow', 'green') NOT NULL,
    reason TEXT NOT NULL,
    added_by VARCHAR(255) NOT NULL,
    added_by_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS task_time_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT NOT NULL,
    user_id INT NOT NULL,
    user_type ENUM('admin', 'team') DEFAULT 'team',
    start_time DATETIME NOT NULL,
    end_time DATETIME NULL,
    duration_seconds INT DEFAULT 0,
    status ENUM('running', 'paused', 'completed') DEFAULT 'running',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS daily_allocations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    user_type ENUM('admin', 'team') DEFAULT 'team',
    project_id INT NULL,
    task_id INT NULL,
    hours_per_day DECIMAL(5,2) DEFAULT 0,
    start_date DATE NULL,
    end_date DATE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

const permissionKeys = [
  'view_dashboard',
  'view_projects',
  'view_tasks',
  'view_team',
  'view_analytics',
  'view_allocations',
  'view_top_performers',
  'view_notifications',
];

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  console.log('Connected to', process.env.DB_NAME);

  for (const sql of statements) {
    const match = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
    await connection.query(sql);
    console.log('  table', match ? match[1] : 'ok');
  }

  const passwordHash = await bcrypt.hash('admin123', 12);

  await connection.query(
    `INSERT IGNORE INTO admin_users (email, password_hash, name, is_active, email_verified_at)
     VALUES (?, ?, ?, 1, NOW())`,
    ['info@bylinelearning.com', passwordHash, 'Demo Admin']
  );

  await connection.query(
    `INSERT IGNORE INTO team_members (name, email, passcode, role, is_active)
     VALUES (?, ?, ?, 'project_manager', 1)`,
    ['Demo Admin', 'info@bylinelearning.com', '123456']
  );

  const [members] = await connection.query(
    'SELECT id FROM team_members WHERE email = ?',
    ['info@bylinelearning.com']
  );
  const memberId = members[0]?.id;
  if (memberId) {
    for (const key of permissionKeys) {
      await connection.query(
        `INSERT IGNORE INTO team_member_permissions (team_member_id, permission_key, is_granted)
         VALUES (?, ?, 1)`,
        [memberId, key]
      );
    }
  }

  await connection.query(
    `INSERT IGNORE INTO categories (name, description) VALUES ('General', 'Default category')`
  );
  await connection.query(
    `INSERT IGNORE INTO skills (name, description) VALUES
      ('Content Writers', 'Writing'),
      ('Instructional Designers', 'ID')`
  );
  await connection.query(
    `INSERT IGNORE INTO category_stages (id, name, description, order_index) VALUES
      (1, 'Plan', 'Planning stage', 1),
      (2, 'Core Development', 'Build stage', 2),
      (3, 'Review', 'Review stage', 3)`
  );
  await connection.query(
    `INSERT IGNORE INTO stage_templates (category_id, stage_id, order_index, is_default)
     SELECT c.id, s.id, s.order_index, 1
     FROM categories c
     CROSS JOIN category_stages s
     WHERE c.name = 'General'`
  );

  const [tables] = await connection.query('SHOW TABLES');
  console.log('\nTables:', tables.length);
  await connection.end();
  console.log('\nLocal login:');
  console.log('  Admin: info@bylinelearning.com / admin123');
  console.log('  Team:  info@bylinelearning.com / 123456');
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
