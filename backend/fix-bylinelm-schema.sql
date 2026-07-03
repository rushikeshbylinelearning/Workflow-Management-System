-- ============================================================
-- FIX SCRIPT FOR bylinelm_workflow_db
-- ============================================================
-- This script fixes the schema mismatch causing "Failed to fetch projects" error
-- The issue: Authentication middleware expects 'team_member_permissions' table
-- which is missing in bylinelm_workflow_db but exists in legatolx_workflow_db
-- NOTE: 'role' column already exists in team_members table
-- ============================================================

-- ============================================================
-- STEP 1: Create missing team_member_permissions table
-- ============================================================
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

-- ============================================================
-- STEP 2: Initialize permissions for existing team members
-- ============================================================
INSERT IGNORE INTO team_member_permissions (team_member_id, permission_key, is_granted)
SELECT id, 'view_projects', CASE WHEN role = 'project_manager' THEN 1 ELSE 0 END FROM team_members;

INSERT IGNORE INTO team_member_permissions (team_member_id, permission_key, is_granted)
SELECT id, 'view_tasks', 1 FROM team_members;

INSERT IGNORE INTO team_member_permissions (team_member_id, permission_key, is_granted)
SELECT id, 'view_team', CASE WHEN role = 'project_manager' THEN 1 ELSE 0 END FROM team_members;

INSERT IGNORE INTO team_member_permissions (team_member_id, permission_key, is_granted)
SELECT id, 'view_analytics', CASE WHEN role = 'project_manager' THEN 1 ELSE 0 END FROM team_members;

INSERT IGNORE INTO team_member_permissions (team_member_id, permission_key, is_granted)
SELECT id, 'view_allocations', CASE WHEN role = 'project_manager' THEN 1 ELSE 0 END FROM team_members;

INSERT IGNORE INTO team_member_permissions (team_member_id, permission_key, is_granted)
SELECT id, 'view_top_performers', CASE WHEN role = 'project_manager' THEN 1 ELSE 0 END FROM team_members;

INSERT IGNORE INTO team_member_permissions (team_member_id, permission_key, is_granted)
SELECT id, 'view_notifications', 1 FROM team_members;

-- ============================================================
-- STEP 3: Verify the fix
-- ============================================================
SELECT '✅ Schema fix completed successfully!' as status;
SELECT COUNT(*) as team_members_count FROM team_members;
SELECT COUNT(*) as permissions_count FROM team_member_permissions;
SHOW COLUMNS FROM team_member_permissions;
