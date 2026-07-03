#!/usr/bin/env node

/**
 * Database Schema Fixer
 * This script identifies and fixes discrepancies between the database schema
 * and the application code (especially for permissions and time tracking).
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

async function fixSchema() {
  console.log('\n🔧 Starting Database Schema Fixer...\n');

  let connection;
  
  try {
    console.log('📡 Connecting to database...');
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true
    });

    console.log(`✅ Connected to database: ${process.env.DB_NAME}\n`);

    // --- 1. Fix team_member_permissions ---
    console.log('🧐 Checking team_member_permissions table...');
    const [permColumns] = await connection.query('SHOW COLUMNS FROM team_member_permissions');
    const hasWrongPermColumn = permColumns.some(c => c.Field === 'permission_name');
    
    if (hasWrongPermColumn) {
      console.log('⚠️  Found incorrect schema in team_member_permissions. Fixing...');
      await connection.query('DROP TABLE IF EXISTS team_member_permissions');
      await connection.query(`
        CREATE TABLE team_member_permissions (
          id INT PRIMARY KEY AUTO_INCREMENT,
          team_member_id INT NOT NULL,
          permission_key VARCHAR(100) NOT NULL,
          is_granted TINYINT(1) NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_member_permission (team_member_id, permission_key),
          INDEX idx_member (team_member_id),
          INDEX idx_permission (permission_key),
          FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✅ team_member_permissions recreated with correct schema.');
    } else {
      console.log('✅ team_member_permissions schema looks correct.');
    }

    // --- 2. Fix task_time_logs ---
    console.log('\n🧐 Checking task_time_logs table...');
    const [timeColumns] = await connection.query('SHOW COLUMNS FROM task_time_logs');
    const hasWrongTimeColumn = timeColumns.some(c => c.Field === 'team_member_id');
    
    if (hasWrongTimeColumn) {
      console.log('⚠️  Found incorrect schema in task_time_logs. Fixing...');
      await connection.query('DROP TABLE IF EXISTS task_time_logs');
      await connection.query(`
        CREATE TABLE task_time_logs (
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
          INDEX idx_task (task_id),
          INDEX idx_user (user_id, user_type),
          INDEX idx_status (status),
          INDEX idx_dates (start_time, end_time),
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✅ task_time_logs recreated with correct schema.');
    } else {
      console.log('✅ task_time_logs schema looks correct.');
    }

    // --- 3. Ensure role column in team_members ---
    console.log('\n🧐 Checking team_members role column...');
    const [memberColumns] = await connection.query('SHOW COLUMNS FROM team_members');
    const hasRole = memberColumns.some(c => c.Field === 'role');
    
    if (!hasRole) {
      console.log('⚠️  Missing role column in team_members. Adding...');
      await connection.query("ALTER TABLE team_members ADD COLUMN role ENUM('employee', 'project_manager') NOT NULL DEFAULT 'employee' AFTER name");
      console.log('✅ role column added to team_members.');
    } else {
      console.log('✅ team_members role column exists.');
    }

    console.log('\n🎉 All schema discrepancies fixed successfully!\n');
    console.log('You can now restart your application.');

  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.log(`💡 Note: ${error.message.split("'")[1]} table doesn't exist yet. Run migrations first.`);
    } else {
      console.error('\n❌ Error fixing schema:', error.message);
      console.error(error);
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n📡 Database connection closed.');
    }
  }
}

fixSchema();
