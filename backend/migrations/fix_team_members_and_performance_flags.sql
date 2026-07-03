-- Migration: fix_team_members_and_performance_flags
-- Description: Adds missing role column to team_members and initializes performance flags system

-- ======================================================
-- 1. Fix team_members table (Add role if missing)
-- ======================================================
SET @dbname = DATABASE();
SET @tablename = "team_members";
SET @columnname = "role";
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname
     AND TABLE_NAME = @tablename
     AND COLUMN_NAME = @columnname) > 0,
  "SELECT 'Column role already exists' AS status",
  "ALTER TABLE team_members ADD COLUMN role ENUM('employee', 'project_manager') DEFAULT 'employee' AFTER name"
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ======================================================
-- 2. Create performance_flags table
-- ======================================================
CREATE TABLE IF NOT EXISTS performance_flags (
  id INT PRIMARY KEY AUTO_INCREMENT,
  team_member_id INT NOT NULL,
  task_id INT NULL,
  type ENUM('red', 'orange', 'yellow', 'green') NOT NULL,
  reason TEXT NOT NULL,
  added_by VARCHAR(255) NOT NULL,
  added_by_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
  INDEX idx_pf_member (team_member_id),
  INDEX idx_pf_task (task_id),
  INDEX idx_pf_type (type),
  INDEX idx_pf_created (created_at),
  INDEX idx_pf_added_by (added_by_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ======================================================
-- 3. Verify Schema
-- ======================================================
SELECT '✅ Migration successful' as message;
SHOW COLUMNS FROM team_members;
SHOW COLUMNS FROM performance_flags;


-- 1. Add missing 'role' column to team_members table
-- This fixes the 500 error during employee login
ALTER TABLE team_members ADD COLUMN role VARCHAR(50) DEFAULT 'Team Member' AFTER name;
-- 2. Optimize performance_flags table with indexes for faster loading
CREATE INDEX idx_performance_flags_team_member ON performance_flags(team_member_id);
CREATE INDEX idx_performance_flags_task ON performance_flags(task_id);
CREATE INDEX idx_performance_flags_type ON performance_flags(type);
-- 3. Ensure the 'added_by_id' column exists (used for tracking who issued the flag)
-- (Run this if you get an error about missing added_by_id)
-- ALTER TABLE performance_flags ADD COLUMN added_by_id INT AFTER added_by;