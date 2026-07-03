const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function fixDatabase() {
  let connection;
  
  try {
    // Connect to MySQL server (not to specific database)
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    });

    console.log('✅ Connected to MySQL server\n');
    
    const dbName = process.env.DB_NAME || 'workflow_db';
    
    // Drop and recreate database
    console.log(`🗑️  Dropping database: ${dbName}`);
    await connection.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    console.log('   ✓ Database dropped');
    
    console.log(`📦 Creating fresh database: ${dbName}`);
    await connection.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log('   ✓ Database created');
    
    // Switch to the new database
    await connection.query(`USE \`${dbName}\``);
    console.log(`   ✓ Using database: ${dbName}\n`);
    
    console.log('📄 Creating tables...\n');

    // Create all tables
    const tables = [
      {
        name: 'admin_users',
        sql: `CREATE TABLE admin_users (
          id INT PRIMARY KEY AUTO_INCREMENT,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          full_name VARCHAR(255) NOT NULL,
          role ENUM('super_admin', 'admin', 'manager') DEFAULT 'admin',
          is_active BOOLEAN DEFAULT true,
          last_login DATETIME,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
      },
      {
        name: 'team_members',
        sql: `CREATE TABLE team_members (
          id INT PRIMARY KEY AUTO_INCREMENT,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          full_name VARCHAR(255) NOT NULL,
          employee_id VARCHAR(50) UNIQUE,
          department VARCHAR(100),
          position VARCHAR(100),
          phone VARCHAR(20),
          avatar_url VARCHAR(500),
          is_active BOOLEAN DEFAULT true,
          last_login DATETIME,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          created_by INT,
          INDEX idx_email (email),
          FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
      },
      {
        name: 'teams',
        sql: `CREATE TABLE teams (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          team_lead_id INT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          created_by INT,
          INDEX idx_name (name),
          FOREIGN KEY (team_lead_id) REFERENCES team_members(id) ON DELETE SET NULL,
          FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
      },
      {
        name: 'team_member_assignments',
        sql: `CREATE TABLE team_member_assignments (
          id INT PRIMARY KEY AUTO_INCREMENT,
          team_id INT NOT NULL,
          member_id INT NOT NULL,
          role VARCHAR(50) DEFAULT 'member',
          joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_team_member (team_id, member_id),
          FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
          FOREIGN KEY (member_id) REFERENCES team_members(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
      },
      {
        name: 'projects',
        sql: `CREATE TABLE projects (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          status ENUM('planning', 'active', 'on_hold', 'completed', 'cancelled') DEFAULT 'planning',
          priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
          start_date DATE,
          end_date DATE,
          budget DECIMAL(15, 2),
          progress INT DEFAULT 0,
          team_id INT,
          project_manager_id INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          created_by INT,
          INDEX idx_status (status),
          FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
          FOREIGN KEY (project_manager_id) REFERENCES team_members(id) ON DELETE SET NULL,
          FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
      },
      {
        name: 'stages',
        sql: `CREATE TABLE stages (
          id INT PRIMARY KEY AUTO_INCREMENT,
          project_id INT NOT NULL,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          stage_order INT DEFAULT 0,
          status ENUM('pending', 'in_progress', 'completed', 'blocked') DEFAULT 'pending',
          start_date DATE,
          end_date DATE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_project (project_id),
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
      },
      {
        name: 'tasks',
        sql: `CREATE TABLE tasks (
          id INT PRIMARY KEY AUTO_INCREMENT,
          project_id INT NOT NULL,
          stage_id INT,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          status ENUM('todo', 'in_progress', 'review', 'completed', 'blocked') DEFAULT 'todo',
          priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
          assigned_to INT,
          estimated_hours DECIMAL(10, 2),
          actual_hours DECIMAL(10, 2) DEFAULT 0,
          progress INT DEFAULT 0,
          due_date DATE,
          completed_at DATETIME,
          tags JSON,
          attachments JSON,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          created_by INT,
          INDEX idx_project (project_id),
          INDEX idx_status (status),
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE SET NULL,
          FOREIGN KEY (assigned_to) REFERENCES team_members(id) ON DELETE SET NULL,
          FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
      },
      {
        name: 'task_comments',
        sql: `CREATE TABLE task_comments (
          id INT PRIMARY KEY AUTO_INCREMENT,
          task_id INT NOT NULL,
          user_id INT NOT NULL,
          user_type ENUM('admin', 'member') NOT NULL,
          comment TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_task (task_id),
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
      },
      {
        name: 'time_logs',
        sql: `CREATE TABLE time_logs (
          id INT PRIMARY KEY AUTO_INCREMENT,
          task_id INT NOT NULL,
          member_id INT NOT NULL,
          start_time DATETIME NOT NULL,
          end_time DATETIME,
          duration_minutes INT,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_task (task_id),
          INDEX idx_member (member_id),
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
          FOREIGN KEY (member_id) REFERENCES team_members(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
      },
      {
        name: 'notifications',
        sql: `CREATE TABLE notifications (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          user_type ENUM('admin', 'member') NOT NULL,
          type VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          link VARCHAR(500),
          is_read BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_user (user_id, user_type),
          INDEX idx_read (is_read)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
      },
      {
        name: 'activity_logs',
        sql: `CREATE TABLE activity_logs (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          user_type ENUM('admin', 'member') NOT NULL,
          action VARCHAR(100) NOT NULL,
          entity_type VARCHAR(50),
          entity_id INT,
          details JSON,
          ip_address VARCHAR(45),
          user_agent TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_user (user_id, user_type),
          INDEX idx_entity (entity_type, entity_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
      }
    ];

    for (const table of tables) {
      await connection.query(table.sql);
      console.log(`   ✓ Created ${table.name}`);
    }

    // Insert default admin
    console.log('\n📝 Inserting default admin user...');
    await connection.query(`
      INSERT INTO admin_users (email, password, full_name, role, is_active) 
      VALUES (
        'admin@workflow.com', 
        '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIeWEHaSuu',
        'System Administrator',
        'super_admin',
        true
      )
    `);
    console.log('   ✓ Default admin created');

    console.log('\n✅ Database setup complete!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 Default Admin Credentials:');
    console.log('   Email:    admin@workflow.com');
    console.log('   Password: admin123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⚠️  IMPORTANT: Change the password after first login!\n');
    console.log('✨ You can now start your server with: node server\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixDatabase();
