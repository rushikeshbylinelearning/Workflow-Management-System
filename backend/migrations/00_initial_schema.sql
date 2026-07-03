-- Initial Database Schema for Workflow LMS
-- Run this first to create all base tables

-- Admin Users Table
CREATE TABLE admin_users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role ENUM('super_admin', 'admin', 'manager') DEFAULT 'admin',
  is_active BOOLEAN DEFAULT true,
  last_login DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Team Members Table
CREATE TABLE IF NOT EXISTS team_members (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  employee_id VARCHAR(50) UNIQUE,
  department VARCHAR(100),
  position VARCHAR(100),
  phone VARCHAR(20),
  avatar_url VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  last_login DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT,
  INDEX idx_email (email),
  INDEX idx_employee_id (employee_id),
  INDEX idx_active (is_active),
  FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Teams Table
CREATE TABLE IF NOT EXISTS teams (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  team_lead_id INT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT,
  INDEX idx_name (name),
  INDEX idx_active (is_active),
  FOREIGN KEY (team_lead_id) REFERENCES team_members(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Team Members Junction Table (no foreign keys initially to avoid circular dependency)
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

-- Projects Table
CREATE TABLE IF NOT EXISTS projects (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status ENUM('planning', 'active', 'on_hold', 'completed', 'cancelled') DEFAULT 'planning',
  priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
  start_date DATE,
  end_date DATE,
  budget DECIMAL(15, 2),
  progress INT DEFAULT 0,
  team_id INT,
  project_manager_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT,
  INDEX idx_status (status),
  INDEX idx_priority (priority),
  INDEX idx_dates (start_date, end_date),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
  FOREIGN KEY (project_manager_id) REFERENCES team_members(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Stages Table
CREATE TABLE IF NOT EXISTS stages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  project_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  stage_order INT DEFAULT 0,
  status ENUM('pending', 'in_progress', 'completed', 'blocked') DEFAULT 'pending',
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_project (project_id),
  INDEX idx_status (status),
  INDEX idx_order (stage_order),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  project_id INT NOT NULL,
  stage_id INT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status ENUM('todo', 'in_progress', 'review', 'completed', 'blocked') DEFAULT 'todo',
  priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
  assigned_to INT,
  estimated_hours DECIMAL(10, 2),
  actual_hours DECIMAL(10, 2) DEFAULT 0,
  progress INT DEFAULT 0,
  due_date DATE,
  completed_at DATETIME,
  tags JSON,
  attachments JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT,
  INDEX idx_project (project_id),
  INDEX idx_stage (stage_id),
  INDEX idx_status (status),
  INDEX idx_priority (priority),
  INDEX idx_assigned (assigned_to),
  INDEX idx_due_date (due_date),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to) REFERENCES team_members(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Task Comments Table
CREATE TABLE IF NOT EXISTS task_comments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  task_id INT NOT NULL,
  user_id INT NOT NULL,
  user_type ENUM('admin', 'member') NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_task (task_id),
  INDEX idx_user (user_id, user_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Time Tracking Table
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

-- Notifications Table
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
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Activity Logs Table
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
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add foreign keys to task_comments after all tables are created
ALTER TABLE task_comments 
  ADD CONSTRAINT fk_tc_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;

-- Add foreign keys to time_logs after all tables are created
ALTER TABLE time_logs
  ADD CONSTRAINT fk_tl_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_tl_member FOREIGN KEY (member_id) REFERENCES team_members(id) ON DELETE CASCADE;

-- Add foreign keys to team_member_assignments after all tables are created
ALTER TABLE team_member_assignments 
  ADD CONSTRAINT fk_tma_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_tma_member FOREIGN KEY (member_id) REFERENCES team_members(id) ON DELETE CASCADE;

-- Insert default admin user (password: admin123)
INSERT INTO admin_users (email, password, full_name, role, is_active) 
VALUES (
  'admin@workflow.com', 
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIeWEHaSuu',
  'System Administrator',
  'super_admin',
  true
) ON DUPLICATE KEY UPDATE email=email;

-- Success message
SELECT 'Database schema created successfully!' AS message;
