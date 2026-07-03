#!/usr/bin/env node

/**
 * Fix Script for bylinelm_workflow_db Schema Mismatch
 * 
 * Problem: "Failed to fetch projects" error on hr.bylinelms.com
 * Root Cause: Missing 'role' column and 'team_member_permissions' table
 * 
 * This script:
 * 1. Adds the missing 'role' column to team_members table
 * 2. Creates the missing team_member_permissions table
 * 3. Initializes default permissions for all team members
 */

const db = require('./db');
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

async function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function runMigration() {
  try {
    await log('\n🔧 Starting bylinelm_workflow_db Schema Fix...', 'cyan');
    await log('=' .repeat(60), 'cyan');

    // Step 1: Add role column to team_members
    await log('\n📋 Step 1: Adding "role" column to team_members table...', 'blue');
    try {
      await db.query(`
        ALTER TABLE team_members 
        ADD COLUMN IF NOT EXISTS role ENUM('employee', 'project_manager') NOT NULL DEFAULT 'employee' AFTER name
      `);
      await log('✅ "role" column added successfully', 'green');
    } catch (error) {
      if (error.message.includes('Duplicate column')) {
        await log('✅ "role" column already exists', 'green');
      } else {
        throw error;
      }
    }

    // Step 2: Create team_member_permissions table
    await log('\n📋 Step 2: Creating team_member_permissions table...', 'blue');
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS team_member_permissions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          team_member_id INT NOT NULL,
          permission_key VARCHAR(100) NOT NULL,
          is_granted TINYINT(1) NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_member_permission (team_member_id, permission_key),
          FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      await log('✅ team_member_permissions table created successfully', 'green');
    } catch (error) {
      if (error.message.includes('already exists')) {
        await log('✅ team_member_permissions table already exists', 'green');
      } else {
        throw error;
      }
    }

    // Step 3: Initialize permissions
    await log('\n📋 Step 3: Initializing default permissions...', 'blue');
    
    const permissions = [
      { key: 'view_projects', pm_only: true },
      { key: 'view_tasks', pm_only: false },
      { key: 'view_team', pm_only: true },
      { key: 'view_analytics', pm_only: true },
      { key: 'view_allocations', pm_only: true },
      { key: 'view_top_performers', pm_only: true },
      { key: 'view_notifications', pm_only: false }
    ];

    for (const perm of permissions) {
      try {
        await db.query(`
          INSERT IGNORE INTO team_member_permissions (team_member_id, permission_key, is_granted)
          SELECT id, ?, ? FROM team_members
        `, [perm.key, perm.pm_only ? 1 : 1]);
        await log(`  ✓ Permission "${perm.key}" initialized`, 'green');
      } catch (error) {
        await log(`  ⚠ Error initializing "${perm.key}": ${error.message}`, 'yellow');
      }
    }

    // Step 4: Verify the fix
    await log('\n📋 Step 4: Verifying schema fix...', 'blue');
    
    const teamMembersCount = await db.query('SELECT COUNT(*) as count FROM team_members');
    const permissionsCount = await db.query('SELECT COUNT(*) as count FROM team_member_permissions');
    const teamMembersColumns = await db.query('SHOW COLUMNS FROM team_members');
    
    await log(`  ✓ Team members: ${teamMembersCount[0].count}`, 'green');
    await log(`  ✓ Permissions records: ${permissionsCount[0].count}`, 'green');
    
    const hasRoleColumn = teamMembersColumns.some(col => col.Field === 'role');
    if (hasRoleColumn) {
      await log('  ✓ "role" column exists in team_members', 'green');
    } else {
      throw new Error('role column not found after migration');
    }

    await log('\n' + '='.repeat(60), 'cyan');
    await log('✅ Schema fix completed successfully!', 'green');
    await log('🚀 The "Failed to fetch projects" error should now be resolved.', 'green');
    await log('   You can now access projects on hr.bylinelms.com', 'green');
    await log('=' .repeat(60) + '\n', 'cyan');

    process.exit(0);
  } catch (error) {
    await log('\n❌ Error during migration:', 'red');
    await log(error.message, 'red');
    await log('\nPlease check the error above and try again.', 'yellow');
    process.exit(1);
  }
}

// Run the migration
runMigration();
