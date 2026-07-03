#!/usr/bin/env node

/**
 * Migration File Generator
 * 
 * Usage:
 *   node create-migration.js <migration-name>
 *   node create-migration.js add_user_preferences
 *   node create-migration.js "Add User Preferences"
 * 
 * Creates a new migration file with timestamp and template
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function parseArguments() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    log('\n❌ Error: No migration name specified', 'red');
    log('\nUsage:', 'yellow');
    log('  node create-migration.js <migration-name>', 'cyan');
    log('\nExamples:', 'yellow');
    log('  node create-migration.js add_user_preferences', 'cyan');
    log('  node create-migration.js "Add User Preferences"', 'cyan');
    log('  node create-migration.js update_task_status_enum', 'cyan');
    process.exit(1);
  }
  
  return args.join(' ');
}

function sanitizeName(name) {
  // Convert to snake_case and remove special characters
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function generateTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

function generateMigrationTemplate(migrationName) {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  
  return `-- Migration: ${migrationName}
-- Description: [Add description of what this migration does]
-- Created: ${dateStr}
-- Author: [Your Name]

-- ============================================
-- MIGRATION UP (Apply Changes)
-- ============================================

-- Example: Create a new table
-- CREATE TABLE IF NOT EXISTS new_table (
--   id INT PRIMARY KEY AUTO_INCREMENT,
--   name VARCHAR(255) NOT NULL,
--   description TEXT,
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--   INDEX idx_name (name)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Example: Add a column
-- ALTER TABLE existing_table 
-- ADD COLUMN new_column VARCHAR(100) AFTER existing_column;

-- Example: Modify a column
-- ALTER TABLE existing_table 
-- MODIFY COLUMN existing_column VARCHAR(255) NOT NULL;

-- Example: Add an index
-- CREATE INDEX idx_column_name ON table_name(column_name);

-- Example: Add a foreign key
-- ALTER TABLE child_table 
-- ADD CONSTRAINT fk_parent 
-- FOREIGN KEY (parent_id) REFERENCES parent_table(id) ON DELETE CASCADE;

-- Example: Insert default data
-- INSERT INTO table_name (column1, column2) 
-- VALUES ('value1', 'value2')
-- ON DUPLICATE KEY UPDATE column1=column1;

-- Example: Update existing data
-- UPDATE table_name 
-- SET column_name = 'new_value' 
-- WHERE condition = true;

-- ============================================
-- MIGRATION DOWN (Rollback Changes)
-- ============================================
-- Note: Rollback statements are commented out by default
-- Uncomment and modify as needed for rollback capability

-- DROP TABLE IF EXISTS new_table;
-- ALTER TABLE existing_table DROP COLUMN new_column;
-- DROP INDEX idx_column_name ON table_name;
-- ALTER TABLE child_table DROP FOREIGN KEY fk_parent;

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify the migration was successful
SELECT 'Migration ${migrationName} completed successfully!' AS status;
`;
}

function createMigration(migrationName) {
  try {
    log('\n' + '='.repeat(60), 'cyan');
    log('📝 MIGRATION FILE GENERATOR', 'bright');
    log('='.repeat(60), 'cyan');
    
    // Sanitize migration name
    const sanitizedName = sanitizeName(migrationName);
    log(`\n📌 Migration name: ${migrationName}`, 'cyan');
    log(`📌 Sanitized name: ${sanitizedName}`, 'cyan');
    
    // Generate timestamp
    const timestamp = generateTimestamp();
    log(`📌 Timestamp: ${timestamp}`, 'cyan');
    
    // Create filename
    const filename = `${timestamp}_${sanitizedName}.sql`;
    const migrationsDir = path.join(__dirname, 'migrations');
    const filepath = path.join(migrationsDir, filename);
    
    // Ensure migrations directory exists
    if (!fs.existsSync(migrationsDir)) {
      log('\n📁 Creating migrations directory...', 'yellow');
      fs.mkdirSync(migrationsDir, { recursive: true });
      log('✅ Migrations directory created', 'green');
    }
    
    // Check if file already exists
    if (fs.existsSync(filepath)) {
      log(`\n❌ Migration file already exists: ${filename}`, 'red');
      process.exit(1);
    }
    
    // Generate migration template
    log('\n📝 Generating migration template...', 'yellow');
    const template = generateMigrationTemplate(migrationName);
    
    // Write file
    fs.writeFileSync(filepath, template, 'utf8');
    
    // Success message
    log('\n' + '='.repeat(60), 'green');
    log('✅ MIGRATION FILE CREATED SUCCESSFULLY!', 'green');
    log('='.repeat(60), 'green');
    log(`\n📁 File: ${filename}`, 'cyan');
    log(`📂 Path: ${filepath}`, 'cyan');
    log(`📏 Size: ${(template.length / 1024).toFixed(2)} KB`, 'cyan');
    
    log('\n📋 Next steps:', 'yellow');
    log('  1. Edit the migration file and add your SQL statements', 'cyan');
    log('  2. Remove the example comments and add your actual changes', 'cyan');
    log('  3. Run the migration:', 'cyan');
    log(`     node migrate.js ${filename}`, 'bright');
    
    log('\n' + '='.repeat(60) + '\n', 'green');
    
  } catch (error) {
    log('\n❌ Error creating migration file:', 'red');
    log(error.message, 'red');
    process.exit(1);
  }
}

// Main execution
const migrationName = parseArguments();
createMigration(migrationName);
