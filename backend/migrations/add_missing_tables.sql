-- ============================================
-- Add Missing Tables Migration
-- Run this to add tables that are missing from your database
-- ============================================

-- Check if we're in the right database
SELECT DATABASE() as current_database;

-- Disable foreign key checks temporarily to avoid constraint issues
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================
-- 1. Team Member Assignments Table
-- ============================================
-- Drop table if it exists (to recreate it fresh)
DROP TABLE IF EXISTS team_member_assignments;

CREATE TABLE team_member_assignments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  team_id INT NOT NULL,
  member_id INT NOT NULL,
  role VARCHAR(50) DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_team_member (team_id, member_id),
  INDEX idx_team (team_id),
  INDEX idx_member (member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add foreign keys after table creation
ALTER TABLE team_member_assignments 
  ADD CONSTRAINT fk_tma_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_tma_member FOREIGN KEY (member_id) REFERENCES team_members(id) ON DELETE CASCADE;

-- ============================================
-- 2. Task Comments Table
-- ============================================
DROP TABLE IF EXISTS task_comments;

CREATE TABLE task_comments (
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

-- Add foreign key after table creation
ALTER TABLE task_comments 
  ADD CONSTRAINT fk_tc_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;

-- ============================================
-- 3. Time Logs Table (if not using task_time_logs)
-- ============================================
DROP TABLE IF EXISTS time_logs;

CREATE TABLE time_logs (
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

-- Add foreign keys after table creation
ALTER TABLE time_logs
  ADD CONSTRAINT fk_tl_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_tl_member FOREIGN KEY (member_id) REFERENCES team_members(id) ON DELETE CASCADE;

-- ============================================
-- 4. Notifications Table
-- ============================================
DROP TABLE IF EXISTS notifications;

CREATE TABLE notifications (
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
-- 5. Activity Logs Table (if not using audit_logs)
-- ============================================
DROP TABLE IF EXISTS activity_logs;

CREATE TABLE activity_logs (
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

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

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
SELECT '✅ Missing tables have been created successfully!' AS message;
SELECT 'Run this query to verify: SHOW TABLES;' AS next_step;
