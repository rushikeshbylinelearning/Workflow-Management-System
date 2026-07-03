# 🚀 Database Migration Quick Start

## Quick Commands

```bash
# Create a new migration
npm run migrate:create "add user settings"
# or
node create-migration.js "add user settings"

# Run a migration
npm run migrate filename.sql
# or
node migrate.js filename.sql

# Check migration status
npm run migrate:status
# or
node migration-status.js
```

## Common Migration Patterns

### 1. Create a Table

```sql
CREATE TABLE IF NOT EXISTS table_name (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2. Add a Column

```sql
ALTER TABLE table_name 
ADD COLUMN new_column VARCHAR(100) AFTER existing_column;

-- Add with default value
ALTER TABLE table_name 
ADD COLUMN new_column VARCHAR(100) DEFAULT 'default_value' AFTER existing_column;

-- Add NOT NULL with default
ALTER TABLE table_name 
ADD COLUMN new_column VARCHAR(100) NOT NULL DEFAULT 'value' AFTER existing_column;
```

### 3. Modify a Column

```sql
-- Change data type
ALTER TABLE table_name 
MODIFY COLUMN column_name VARCHAR(500);

-- Change to NOT NULL
ALTER TABLE table_name 
MODIFY COLUMN column_name VARCHAR(255) NOT NULL;

-- Change default value
ALTER TABLE table_name 
ALTER COLUMN column_name SET DEFAULT 'new_default';
```

### 4. Add an Index

```sql
-- Single column index
CREATE INDEX idx_column_name ON table_name(column_name);

-- Multi-column index
CREATE INDEX idx_multiple ON table_name(column1, column2);

-- Unique index
CREATE UNIQUE INDEX idx_unique_email ON users(email);
```

### 5. Add Foreign Key

```sql
ALTER TABLE child_table 
ADD CONSTRAINT fk_parent 
FOREIGN KEY (parent_id) REFERENCES parent_table(id) ON DELETE CASCADE;

-- With different actions
ALTER TABLE child_table 
ADD CONSTRAINT fk_parent 
FOREIGN KEY (parent_id) REFERENCES parent_table(id) 
ON DELETE SET NULL 
ON UPDATE CASCADE;
```

### 6. Drop Column/Index/Constraint

```sql
-- Drop column
ALTER TABLE table_name DROP COLUMN column_name;

-- Drop index
DROP INDEX idx_name ON table_name;

-- Drop foreign key
ALTER TABLE table_name DROP FOREIGN KEY fk_name;
```

### 7. Rename Table/Column

```sql
-- Rename table
RENAME TABLE old_name TO new_name;

-- Rename column
ALTER TABLE table_name 
CHANGE COLUMN old_name new_name VARCHAR(255);
```

### 8. Update Data

```sql
-- Simple update
UPDATE table_name 
SET column_name = 'new_value' 
WHERE condition = true;

-- Update with JOIN
UPDATE table1 t1
JOIN table2 t2 ON t1.id = t2.table1_id
SET t1.status = 'active'
WHERE t2.condition = true;

-- Conditional update
UPDATE table_name 
SET status = CASE 
  WHEN priority = 'high' THEN 'urgent'
  WHEN priority = 'medium' THEN 'normal'
  ELSE 'low'
END;
```

### 9. Insert Default Data

```sql
-- Simple insert
INSERT INTO table_name (column1, column2) 
VALUES ('value1', 'value2');

-- Insert with duplicate key handling
INSERT INTO settings (key, value) 
VALUES ('theme', 'dark')
ON DUPLICATE KEY UPDATE value = 'dark';

-- Insert multiple rows
INSERT INTO table_name (column1, column2) VALUES
  ('value1', 'value2'),
  ('value3', 'value4'),
  ('value5', 'value6');
```

### 10. Add Enum Values

```sql
-- Modify enum to add new values
ALTER TABLE table_name 
MODIFY COLUMN status ENUM('pending', 'active', 'completed', 'cancelled', 'new_status') 
DEFAULT 'pending';
```

## Migration Template

```sql
-- Migration: [Name]
-- Description: [What this migration does]
-- Created: [Date]
-- Author: [Your Name]

-- ============================================
-- MIGRATION UP (Apply Changes)
-- ============================================

-- Your SQL statements here

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 'Migration completed successfully!' AS status;
```

## Best Practices Checklist

- ✅ Use `IF NOT EXISTS` for CREATE statements
- ✅ Use `IF EXISTS` for DROP statements
- ✅ Add indexes AFTER inserting large amounts of data
- ✅ Test on development database first
- ✅ Backup production database before running
- ✅ Use descriptive migration names
- ✅ Add comments explaining complex changes
- ✅ Include verification queries at the end
- ✅ Keep migrations small and focused
- ✅ Never modify old migrations that have been run

## Troubleshooting

### Migration fails with "Table already exists"
```sql
-- Use IF NOT EXISTS
CREATE TABLE IF NOT EXISTS table_name (...);
```

### Migration fails with "Column already exists"
```sql
-- Check if column exists first
ALTER TABLE table_name 
ADD COLUMN IF NOT EXISTS column_name VARCHAR(100);
```

### Foreign key constraint fails
```sql
-- Ensure parent table and column exist
-- Ensure data types match exactly
-- Clean up orphaned records first
DELETE FROM child_table 
WHERE parent_id NOT IN (SELECT id FROM parent_table);
```

### Need to rollback
```sql
-- Add rollback statements as comments in your migration
-- Then create a new migration to reverse changes
```

## File Naming Convention

```
YYYYMMDDHHMMSS_descriptive_name.sql

Examples:
20260423143022_add_user_preferences.sql
20260423150000_update_task_status_enum.sql
20260423160000_create_audit_logs.sql
```

## Workflow

1. **Create** migration file
   ```bash
   npm run migrate:create "add user settings"
   ```

2. **Edit** the generated file with your SQL

3. **Test** on development database
   ```bash
   npm run migrate 20260423143022_add_user_settings.sql
   ```

4. **Verify** changes
   ```bash
   npm run migrate:status
   ```

5. **Commit** migration file to version control

6. **Deploy** to production
   ```bash
   npm run migrate 20260423143022_add_user_settings.sql
   ```

## Need Help?

- 📖 Read full documentation: `MIGRATIONS.md`
- 🔍 Check migration status: `npm run migrate:status`
- 📋 View existing migrations for examples
- 🧪 Test SQL in MySQL client first

## Common Errors

| Error | Solution |
|-------|----------|
| File not found | Check filename and path |
| Syntax error | Test SQL in MySQL client |
| Foreign key fails | Ensure parent table exists |
| Column exists | Use `IF NOT EXISTS` |
| Connection failed | Check `.env` database config |

---

**Remember:** Always backup your database before running migrations on production! 🔒
