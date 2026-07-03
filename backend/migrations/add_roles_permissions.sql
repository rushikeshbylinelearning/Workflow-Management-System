-- Migration: Add role and permissions to team_members
-- Run this migration to enable Access Management feature

-- Add role column to team_members (employee | project_manager)
ALTER TABLE team_members 
  ADD COLUMN IF NOT EXISTS role ENUM('employee', 'project_manager') NOT NULL DEFAULT 'employee' AFTER name;

-- Add permissions JSON column to team_members
ALTER TABLE team_members 
  ADD COLUMN IF NOT EXISTS permissions JSON NULL AFTER role;

-- Create a dedicated permissions table for granular control
CREATE TABLE IF NOT EXISTS team_member_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_member_id INT NOT NULL,
  permission_key VARCHAR(100) NOT NULL,
  is_granted TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_member_permission (team_member_id, permission_key),
  FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Default permissions for all existing employees (all denied)
INSERT IGNORE INTO team_member_permissions (team_member_id, permission_key, is_granted)
SELECT id, 'view_projects', 0 FROM team_members WHERE role = 'employee';

INSERT IGNORE INTO team_member_permissions (team_member_id, permission_key, is_granted)
SELECT id, 'view_tasks', 1 FROM team_members;

INSERT IGNORE INTO team_member_permissions (team_member_id, permission_key, is_granted)
SELECT id, 'view_team', 0 FROM team_members WHERE role = 'employee';

INSERT IGNORE INTO team_member_permissions (team_member_id, permission_key, is_granted)
SELECT id, 'view_analytics', 0 FROM team_members WHERE role = 'employee';

INSERT IGNORE INTO team_member_permissions (team_member_id, permission_key, is_granted)
SELECT id, 'view_allocations', 0 FROM team_members WHERE role = 'employee';

INSERT IGNORE INTO team_member_permissions (team_member_id, permission_key, is_granted)
SELECT id, 'view_top_performers', 0 FROM team_members WHERE role = 'employee';

INSERT IGNORE INTO team_member_permissions (team_member_id, permission_key, is_granted)
SELECT id, 'view_notifications', 1 FROM team_members;

-- Default permissions for project managers (most granted)
UPDATE team_members SET role = 'employee' WHERE role IS NULL;
