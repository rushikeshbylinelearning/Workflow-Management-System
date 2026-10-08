-- Team-scoped Access Management: which teams a member may view/manage
CREATE TABLE IF NOT EXISTS team_member_access_teams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_member_id INT NOT NULL,
  team_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_member_access_team (team_member_id, team_id),
  INDEX idx_access_member (team_member_id),
  INDEX idx_access_team (team_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO team_member_permissions (team_member_id, permission_key, is_granted)
SELECT id, 'write_access', IF(role = 'project_manager', 1, 0) FROM team_members;

INSERT IGNORE INTO team_member_permissions (team_member_id, permission_key, is_granted)
SELECT id, 'all_teams_access', IF(role = 'project_manager', 1, 0) FROM team_members;
