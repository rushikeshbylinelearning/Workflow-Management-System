-- Migration: Add Audit Logging System
-- Description: Creates comprehensive audit logging for tracking all database changes
-- Created: 2026-04-23
-- Author: System

-- ============================================
-- MIGRATION UP (Apply Changes)
-- ============================================

-- Create audit_logs table for tracking all database changes
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  table_name VARCHAR(100) NOT NULL,
  record_id INT NOT NULL,
  action ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
  user_id INT,
  user_type ENUM('admin', 'member', 'system') NOT NULL,
  old_values JSON,
  new_values JSON,
  changed_fields JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_table_record (table_name, record_id),
  INDEX idx_action (action),
  INDEX idx_user (user_id, user_type),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create login_history table for tracking authentication events
CREATE TABLE IF NOT EXISTS login_history (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  user_type ENUM('admin', 'member') NOT NULL,
  login_status ENUM('success', 'failed', 'locked') NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  failure_reason VARCHAR(255),
  session_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id, user_type),
  INDEX idx_status (login_status),
  INDEX idx_created (created_at),
  INDEX idx_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add audit fields to existing tables
ALTER TABLE admin_users 
ADD COLUMN IF NOT EXISTS last_modified_by INT AFTER updated_at,
ADD COLUMN IF NOT EXISTS last_modified_at TIMESTAMP NULL AFTER last_modified_by;

ALTER TABLE team_members 
ADD COLUMN IF NOT EXISTS last_modified_by INT AFTER updated_at,
ADD COLUMN IF NOT EXISTS last_modified_at TIMESTAMP NULL AFTER last_modified_by;

ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS last_modified_by INT AFTER updated_at,
ADD COLUMN IF NOT EXISTS last_modified_at TIMESTAMP NULL AFTER last_modified_by;

ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS last_modified_by INT AFTER updated_at,
ADD COLUMN IF NOT EXISTS last_modified_at TIMESTAMP NULL AFTER last_modified_by;

-- Create indexes for audit fields
CREATE INDEX IF NOT EXISTS idx_admin_modified ON admin_users(last_modified_by, last_modified_at);
CREATE INDEX IF NOT EXISTS idx_member_modified ON team_members(last_modified_by, last_modified_at);
CREATE INDEX IF NOT EXISTS idx_project_modified ON projects(last_modified_by, last_modified_at);
CREATE INDEX IF NOT EXISTS idx_task_modified ON tasks(last_modified_by, last_modified_at);

-- ============================================
-- MIGRATION DOWN (Rollback Changes)
-- ============================================
-- Uncomment to rollback

-- DROP TABLE IF EXISTS audit_logs;
-- DROP TABLE IF EXISTS login_history;
-- ALTER TABLE admin_users DROP COLUMN IF EXISTS last_modified_by, DROP COLUMN IF EXISTS last_modified_at;
-- ALTER TABLE team_members DROP COLUMN IF EXISTS last_modified_by, DROP COLUMN IF EXISTS last_modified_at;
-- ALTER TABLE projects DROP COLUMN IF EXISTS last_modified_by, DROP COLUMN IF EXISTS last_modified_at;
-- ALTER TABLE tasks DROP COLUMN IF EXISTS last_modified_by, DROP COLUMN IF EXISTS last_modified_at;

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify tables were created
SELECT 
  COUNT(*) as audit_tables_created 
FROM information_schema.tables 
WHERE table_schema = DATABASE() 
  AND table_name IN ('audit_logs', 'login_history');

-- Verify columns were added
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND column_name IN ('last_modified_by', 'last_modified_at')
ORDER BY table_name, ordinal_position;

SELECT 'Audit logging system migration completed successfully!' AS status;
