-- Migration: Add Flag and Extension Request Audit Trailing
-- Description: Creates audit tables for tracking flag and extension request deletions
-- Created: 2026-08-24

-- ============================================
-- MIGRATION UP (Apply Changes)
-- ============================================

-- Create flag_audit_logs table for tracking flag deletions
CREATE TABLE IF NOT EXISTS flag_audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  flag_id INT NOT NULL,
  team_member_id INT NOT NULL,
  team_member_name VARCHAR(255),
  task_id INT,
  task_name VARCHAR(255),
  flag_type ENUM('red', 'orange', 'yellow', 'green') NOT NULL,
  flag_reason TEXT NOT NULL,
  original_added_by VARCHAR(255),
  original_added_by_id INT,
  original_created_at TIMESTAMP NULL,
  deleted_by INT NOT NULL,
  deleted_by_name VARCHAR(255) NOT NULL,
  deleted_by_type ENUM('admin', 'team', 'system') DEFAULT 'admin',
  deleted_at TIMESTAMP NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  INDEX idx_flag_id (flag_id),
  INDEX idx_team_member (team_member_id),
  INDEX idx_task (task_id),
  INDEX idx_deleted_by (deleted_by, deleted_by_type),
  INDEX idx_deleted_at (deleted_at),
  INDEX idx_flag_type (flag_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Audit trail for performance flag deletions';

-- Create extension_request_audit_logs table for tracking extension request deletions
CREATE TABLE IF NOT EXISTS extension_request_audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  extension_id INT NOT NULL,
  task_id INT NOT NULL,
  task_name VARCHAR(255),
  project_id INT,
  project_name VARCHAR(255),
  requested_by INT NOT NULL,
  requested_by_name VARCHAR(255),
  requested_by_type ENUM('admin', 'team') NOT NULL,
  current_due_date DATETIME,
  requested_due_date DATETIME,
  reason TEXT,
  status ENUM('pending', 'approved', 'rejected') NOT NULL,
  reviewed_by INT,
  reviewed_by_name VARCHAR(255),
  reviewed_at TIMESTAMP NULL,
  review_notes TEXT,
  deleted_by INT NOT NULL,
  deleted_by_name VARCHAR(255) NOT NULL,
  deleted_by_type ENUM('admin', 'team', 'system') DEFAULT 'admin',
  deleted_at TIMESTAMP NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  INDEX idx_extension_id (extension_id),
  INDEX idx_task (task_id),
  INDEX idx_project (project_id),
  INDEX idx_requested_by (requested_by, requested_by_type),
  INDEX idx_deleted_by (deleted_by, deleted_by_type),
  INDEX idx_deleted_at (deleted_at),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Audit trail for extension request deletions';

-- ============================================
-- VERIFICATION (Run separately after migration)
-- ============================================

-- Verify tables were created (uncomment and run separately if needed)
-- SELECT 
--   table_name,
--   table_comment,
--   create_time
-- FROM information_schema.tables 
-- WHERE table_schema = DATABASE() 
--   AND table_name IN ('flag_audit_logs', 'extension_request_audit_logs');

-- ============================================
-- MIGRATION DOWN (Rollback Changes)
-- ============================================
-- Uncomment to rollback

-- DROP TABLE IF EXISTS flag_audit_logs;
-- DROP TABLE IF EXISTS extension_request_audit_logs;
