-- ============================================
-- Add Missing Tables Migration (SAFE VERSION)
-- This version creates tables WITHOUT foreign keys to avoid constraint errors
-- Run this if the main script fails
-- ============================================

-- Check if we're in the right database
SELECT DATABASE() as current_database;

-- ============================================
-- 1. Team Member Assignments Table (NO FOREIGN KEYS)
-- ============================================
CREATE TABLE IF NOT EXISTS team_member_assignments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  team_id INT NOT NULL,
  member_id INT NOT NULL,
  role VARCHAR(50) DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_team_member (team_id, member_id),
  INDEX idx_team (team_id),
  INDEX idx_member (member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 2. Task Comments Table (NO FOREIGN KEYS)
-- ============================================
CREATE TABLE IF NOT EXISTS task_comments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  task_id INT NOT NULL,
  user_id INT NOT NULL,
  user_type ENUM('admin', 'member') NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_task (task_id),
  INDEX idx_user (user_id, user_type),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 3. Time Logs Table (NO FOREIGN KEYS)
-- ============================================
CREATE TABLE IF NOT EXISTS time_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  task_id INT NOT NULL,
  member_id INT NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME,
  duration_minutes INT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_task (task_id),
  INDEX idx_member (member_id),
  INDEX idx_dates (start_time, end_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 4. Notifications Table
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  user_type ENUM('admin', 'member') NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  link VARCHAR(500),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id, user_type),
  INDEX idx_read (is_read),
  INDEX idx_created (created_at),
  INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 5. Activity Logs Table
-- ============================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  user_type ENUM('admin', 'member') NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INT,
  details JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id, user_type),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_action (action),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Verify Tables Created
-- ============================================
SELECT 
  'team_member_assignments' as table_name,
  COUNT(*) as exists_check
FROM information_schema.tables 
WHERE table_schema = DATABASE() 
  AND table_name = 'team_member_assignments'

UNION ALL

SELECT 
  'task_comments' as table_name,
  COUNT(*) as exists_check
FROM information_schema.tables 
WHERE table_schema = DATABASE() 
  AND table_name = 'task_comments'

UNION ALL

SELECT 
  'time_logs' as table_name,
  COUNT(*) as exists_check
FROM information_schema.tables 
WHERE table_schema = DATABASE() 
  AND table_name = 'time_logs'

UNION ALL

SELECT 
  'notifications' as table_name,
  COUNT(*) as exists_check
FROM information_schema.tables 
WHERE table_schema = DATABASE() 
  AND table_name = 'notifications'

UNION ALL

SELECT 
  'activity_logs' as table_name,
  COUNT(*) as exists_check
FROM information_schema.tables 
WHERE table_schema = DATABASE() 
  AND table_name = 'activity_logs';

-- Success message
SELECT '✅ Missing tables have been created successfully (without foreign keys)!' AS message;
SELECT 'Tables created: team_member_assignments, task_comments, time_logs, notifications, activity_logs' AS details;
SELECT 'Run this query to verify: SHOW TABLES;' AS next_step;
