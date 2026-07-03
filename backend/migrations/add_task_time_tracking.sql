-- Task Time Tracking Migration
-- Run this migration to add time tracking support

-- 1. Add time tracking columns to tasks table
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS total_time_seconds INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS timer_status ENUM('not_started', 'in_progress', 'paused', 'completed') DEFAULT 'not_started';

-- 2. Create task_time_logs table
CREATE TABLE IF NOT EXISTS task_time_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  user_id INT NOT NULL,
  user_type ENUM('admin', 'team') DEFAULT 'team',
  start_time DATETIME NOT NULL,
  end_time DATETIME NULL,
  duration_seconds INT DEFAULT 0,
  status ENUM('running', 'paused', 'completed') DEFAULT 'running',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_time_logs_task_id ON task_time_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_user_id ON task_time_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_status ON task_time_logs(status);
