# Database Migration System

A comprehensive database migration system for managing schema changes in your MySQL/MariaDB database.

## 📋 Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Migration Scripts](#migration-scripts)
- [Usage Examples](#usage-examples)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

This migration system provides:

- **Automated migration execution** - Run SQL migrations with a single command
- **Migration generation** - Create timestamped migration files from templates
- **Error handling** - Detailed error messages and rollback support
- **Multi-statement support** - Execute complex migrations with multiple SQL statements
- **Colored output** - Easy-to-read console output with status indicators

## 🚀 Quick Start

### 1. Create a New Migration

```bash
# Create a new migration file
node create-migration.js "add user preferences"

# This creates: migrations/20260423143022_add_user_preferences.sql
```

### 2. Edit the Migration File

Open the generated file and add your SQL statements:

```sql
-- Migration: add user preferences
-- Description: Add user preferences table
-- Created: 2026-04-23

CREATE TABLE IF NOT EXISTS user_preferences (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  theme VARCHAR(50) DEFAULT 'light',
  language VARCHAR(10) DEFAULT 'en',
  notifications_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'User preferences table created!' AS status;
```

### 3. Run the Migration

```bash
# Run by filename
node migrate.js 20260423143022_add_user_preferences.sql

# Or just the filename without path
node migrate.js add_user_preferences.sql
```

## 📜 Migration Scripts

### `create-migration.js` - Migration Generator

Creates a new timestamped migration file with a template.

**Usage:**
```bash
node create-migration.js <migration-name>
```

**Examples:**
```bash
node create-migration.js add_user_preferences
node create-migration.js "Add User Preferences"
node create-migration.js update_task_status_enum
```

**Output:**
- Creates file: `migrations/YYYYMMDDHHMMSS_migration_name.sql`
- Includes template with examples
- Adds timestamp and metadata

### `migrate.js` - Migration Runner

Executes SQL migration files with error handling and progress tracking.

**Usage:**
```bash
node migrate.js <migration-file>
```

**Examples:**
```bash
# Run by full filename
node migrate.js 20260423143022_add_user_preferences.sql

# Run by partial name
node migrate.js add_user_preferences.sql

# Run with path
node migrate.js migrations/add_user_preferences.sql
```

**Features:**
- ✅ Automatic path resolution
- ✅ Multi-statement execution
- ✅ Comment removal (-- and /* */)
- ✅ Detailed progress output
- ✅ Error handling with context
- ✅ Execution timing
- ✅ Database connection testing

## 💡 Usage Examples

### Example 1: Add a New Table

```bash
# Create migration
node create-migration.js "create notifications table"

# Edit the file and add:
```

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_read (is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

```bash
# Run migration
node migrate.js create_notifications_table.sql
```

### Example 2: Add a Column

```bash
# Create migration
node create-migration.js "add avatar to team members"

# Edit and add:
```

```sql
ALTER TABLE team_members 
ADD COLUMN avatar_url VARCHAR(500) AFTER phone;

CREATE INDEX idx_avatar ON team_members(avatar_url);
```

```bash
# Run migration
node migrate.js add_avatar_to_team_members.sql
```

### Example 3: Modify Existing Data

```bash
# Create migration
node create-migration.js "update default task status"

# Edit and add:
```

```sql
-- Update all pending tasks to todo
UPDATE tasks 
SET status = 'todo' 
WHERE status = 'pending';

-- Modify the enum to remove 'pending'
ALTER TABLE tasks 
MODIFY COLUMN status ENUM('todo', 'in_progress', 'review', 'completed', 'blocked') DEFAULT 'todo';
```

```bash
# Run migration
node migrate.js update_default_task_status.sql
```

### Example 4: Add Foreign Keys

```bash
# Create migration
node create-migration.js "add project relationships"

# Edit and add:
```

```sql
-- Add foreign key to tasks
ALTER TABLE tasks 
ADD CONSTRAINT fk_task_project 
FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- Add foreign key to stages
ALTER TABLE stages 
ADD CONSTRAINT fk_stage_project 
FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
```

```bash
# Run migration
node migrate.js add_project_relationships.sql
```

## 📚 Best Practices

### 1. **Naming Conventions**

- Use descriptive names: `add_user_preferences` not `update1`
- Use snake_case: `add_email_verification` not `AddEmailVerification`
- Be specific: `add_avatar_to_team_members` not `add_column`

### 2. **Migration Structure**

```sql
-- Always include header comments
-- Migration: [Name]
-- Description: [What it does]
-- Created: [Date]

-- Group related changes together
-- Add tables first, then columns, then indexes, then foreign keys

-- Always use IF NOT EXISTS for CREATE statements
CREATE TABLE IF NOT EXISTS table_name (...);

-- Always verify at the end
SELECT 'Migration completed!' AS status;
```

### 3. **Safety First**

- **Test migrations** on a development database first
- **Backup your database** before running migrations on production
- **Use transactions** for complex migrations (wrap in START TRANSACTION / COMMIT)
- **Add rollback statements** as comments for reference

### 4. **Performance Considerations**

- **Add indexes** after inserting large amounts of data
- **Use ALGORITHM=INPLACE** for ALTER TABLE when possible
- **Avoid locking** tables during peak hours
- **Test on production-sized data** before deploying

### 5. **Data Migrations**

```sql
-- Good: Safe update with WHERE clause
UPDATE users SET status = 'active' WHERE status IS NULL;

-- Good: Insert with duplicate key handling
INSERT INTO settings (key, value) 
VALUES ('theme', 'dark')
ON DUPLICATE KEY UPDATE value=value;

-- Good: Conditional data migration
UPDATE tasks t
JOIN projects p ON t.project_id = p.id
SET t.priority = 'high'
WHERE p.status = 'critical';
```

## 🔧 Troubleshooting

### Migration File Not Found

```bash
❌ Migration file not found: my_migration.sql
```

**Solution:**
- Check the filename spelling
- Ensure the file is in the `migrations/` directory
- Try using the full filename with timestamp

### SQL Syntax Error

```bash
❌ Statement 3 failed
Error: You have an error in your SQL syntax
```

**Solution:**
- Check the SQL statement syntax
- Ensure all statements end with semicolons
- Remove any special characters or comments that might cause issues
- Test the SQL in a MySQL client first

### Foreign Key Constraint Fails

```bash
❌ Cannot add foreign key constraint
```

**Solution:**
- Ensure the referenced table exists
- Check that the referenced column exists and has the same data type
- Verify that existing data doesn't violate the constraint
- Add the foreign key in a separate migration after data cleanup

### Table Already Exists

```bash
❌ Table 'table_name' already exists
```

**Solution:**
- Use `CREATE TABLE IF NOT EXISTS` instead of `CREATE TABLE`
- Check if the migration was already run
- Consider using `DROP TABLE IF EXISTS` first (with caution!)

### Connection Issues

```bash
❌ Database connection failed
```

**Solution:**
- Check your `.env` file has correct database credentials
- Ensure MySQL/MariaDB is running
- Verify network connectivity
- Check database user permissions

## 📁 File Structure

```
backend/
├── migrations/
│   ├── 00_initial_schema.sql
│   ├── 20260423143022_add_user_preferences.sql
│   ├── 20260423150000_update_task_status.sql
│   └── ...
├── create-migration.js      # Migration generator
├── migrate.js               # Migration runner
├── db.js                    # Database connection
└── MIGRATIONS.md            # This file
```

## 🎨 Output Examples

### Successful Migration

```
============================================================
🚀 DATABASE MIGRATION RUNNER
============================================================

📁 Migration file: add_user_preferences.sql
📂 Full path: /path/to/migrations/20260423143022_add_user_preferences.sql

🔌 Testing database connection...
✅ Database connected successfully to: workflow_db

📖 Reading migration file...
✅ File loaded (1.23 KB)

🔍 Parsing SQL statements...
✅ Found 2 SQL statement(s)

⚙️  Executing migration...
------------------------------------------------------------

[1/2] CREATE TABLE IF NOT EXISTS user_preferences ( id INT PRIMARY KEY AUTO_...
✅ Statement 1 completed

[2/2] SELECT 'User preferences table created!' AS status...
✅ Statement 2 completed

============================================================
✅ MIGRATION COMPLETED SUCCESSFULLY!
============================================================
⏱️  Duration: 0.45s
📊 Statements executed: 2
📁 Migration: add_user_preferences.sql
============================================================
```

### Failed Migration

```
============================================================
🚀 DATABASE MIGRATION RUNNER
============================================================

[1/3] CREATE TABLE invalid_syntax (...
❌ Statement 1 failed
Error: You have an error in your SQL syntax

Problematic SQL:
CREATE TABLE invalid_syntax (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  invalid column definition here
)

============================================================
❌ MIGRATION FAILED
============================================================
⏱️  Duration: 0.12s

Error: You have an error in your SQL syntax; check the manual...
============================================================
```

## 📞 Support

For issues or questions:
1. Check this documentation
2. Review existing migration files for examples
3. Test SQL statements in a MySQL client first
4. Check database logs for detailed error messages

## 🔄 Version History

- **v1.0** - Initial migration system with generator and runner
- Supports MySQL/MariaDB
- Colored console output
- Multi-statement execution
- Error handling and rollback support
