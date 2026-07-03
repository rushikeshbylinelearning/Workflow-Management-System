-- Migration: Example Migration Template
-- Description: This is a template for creating new database migrations
-- Created: 2026-04-23
-- Author: System

-- ============================================
-- MIGRATION UP (Apply Changes)
-- ============================================

-- Example: Add a new table
CREATE TABLE IF NOT EXISTS example_table (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Example: Add a new column to existing table
-- ALTER TABLE team_members 
-- ADD COLUMN new_field VARCHAR(100) AFTER full_name;

-- Example: Add an index
-- CREATE INDEX idx_example ON tasks(status, priority);

-- Example: Modify a column
-- ALTER TABLE projects 
-- MODIFY COLUMN description TEXT NOT NULL;

-- Example: Add a foreign key
-- ALTER TABLE example_table 
-- ADD CONSTRAINT fk_example_user 
-- FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE;

-- Example: Insert default data
-- INSERT INTO example_table (name, description) 
-- VALUES ('Default Entry', 'This is a default entry')
-- ON DUPLICATE KEY UPDATE name=name;

-- ============================================
-- MIGRATION DOWN (Rollback Changes)
-- ============================================
-- Note: Rollback statements are commented out by default
-- Uncomment and modify as needed for rollback capability

-- DROP TABLE IF EXISTS example_table;
-- ALTER TABLE team_members DROP COLUMN new_field;
-- DROP INDEX idx_example ON tasks;

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify the migration was successful
SELECT 'Migration completed successfully!' AS status;
