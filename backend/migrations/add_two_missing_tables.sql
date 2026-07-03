-- ============================================
-- Add 2 Missing Tables: task_time_logs and team_member_permissions
-- Corrected schema to match application controllers and middleware
-- ============================================

-- Check current database
SELECT DATABASE() as current_database;

-- ============================================
-- 1. task_time_logs Table
-- ============================================
CREATE TABLE IF NOT EXISTS task_time_logs (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 2. team_member_permissions Table
-- ============================================
CREATE TABLE IF NOT EXISTS team_member_permissions (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Verify Tables Created
-- ============================================
SELECT 
  'task_time_logs' as table_name,
  COUNT(*) as exists_check
FROM information_schema.tables 
WHERE table_schema = DATABASE() 
  AND table_name = 'task_time_logs'

UNION ALL

SELECT 
  'team_member_permissions' as table_name,
  COUNT(*) as exists_check
FROM information_schema.tables 
WHERE table_schema = DATABASE() 
  AND table_name = 'team_member_permissions';

-- Success message
SELECT '✅ Tables created successfully with correct schema!' AS message;
SELECT 'Created: task_time_logs, team_member_permissions' AS details;
