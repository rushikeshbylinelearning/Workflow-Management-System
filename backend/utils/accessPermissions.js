const db = require('../db');

const PERMISSION_DEFINITIONS = [
  { key: 'view_projects', label: 'View Projects', description: 'Access the Projects section', category: 'Projects' },
  { key: 'view_tasks', label: 'View All Tasks', description: 'Access the All Tasks section. Use team access below to show other people\'s tasks.', category: 'Tasks' },
  { key: 'view_team', label: 'View Team', description: 'Access the Team Management section', category: 'Team' },
  { key: 'view_analytics', label: 'View Analytics', description: 'Access the Analytics section', category: 'Analytics' },
  { key: 'view_allocations', label: 'View Allocations', description: 'Access the Daily Allocations section', category: 'Allocations' },
  { key: 'view_top_performers', label: 'View Top Performers', description: 'Access the Top Performers / reports section', category: 'Reports' },
  { key: 'view_notifications', label: 'View Notifications', description: 'Access the Notifications / Activities section', category: 'Notifications' },
  { key: 'view_dashboard', label: 'View Dashboard', description: 'Access the main Dashboard overview', category: 'Dashboard' },
];

const ROLE_DEFAULT_PERMISSIONS = {
  employee: {
    view_dashboard: false,
    view_tasks: true,
    view_notifications: true,
    view_projects: false,
    view_team: false,
    view_analytics: false,
    view_allocations: false,
    view_top_performers: false,
    write_access: false,
    all_teams_access: false,
  },
  project_manager: {
    view_dashboard: true,
    view_tasks: true,
    view_notifications: true,
    view_projects: true,
    view_team: true,
    view_analytics: true,
    view_allocations: true,
    view_top_performers: true,
    write_access: true,
    all_teams_access: true,
  },
};

const ELEVATED_VIEW_KEYS = [
  'view_projects',
  'view_team',
  'view_analytics',
  'view_allocations',
  'view_top_performers',
  'view_dashboard',
];

const ALL_PERMISSION_KEYS = [
  ...PERMISSION_DEFINITIONS.map((item) => item.key),
  'write_access',
  'all_teams_access',
];

function mergePermissionDefaults(role, stored = {}) {
  const defaults = ROLE_DEFAULT_PERMISSIONS[role] || ROLE_DEFAULT_PERMISSIONS.employee;
  const merged = { ...defaults };
  Object.entries(stored || {}).forEach(([key, value]) => {
    merged[key] = !!value;
  });
  return merged;
}

async function ensurePermissionsExist(teamMemberId, role = 'employee') {
  const defaults = ROLE_DEFAULT_PERMISSIONS[role] || ROLE_DEFAULT_PERMISSIONS.employee;
  for (const [key, isGranted] of Object.entries(defaults)) {
    try {
      await db.execute(
        `INSERT IGNORE INTO team_member_permissions (team_member_id, permission_key, is_granted)
         VALUES (?, ?, ?)`,
        [teamMemberId, key, isGranted ? 1 : 0]
      );
    } catch (error) {
      console.error('ensurePermissionsExist error:', error.message);
    }
  }
}

async function ensureAccessTeamsTable() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS team_member_access_teams (
      id INT AUTO_INCREMENT PRIMARY KEY,
      team_member_id INT NOT NULL,
      team_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_member_access_team (team_member_id, team_id),
      INDEX idx_access_member (team_member_id),
      INDEX idx_access_team (team_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function loadStoredPermissions(memberId) {
  try {
    return await db.query(
      'SELECT permission_key, is_granted FROM team_member_permissions WHERE team_member_id = ?',
      [memberId]
    );
  } catch (error) {
    console.error('loadStoredPermissions error:', error.message);
    return null;
  }
}

async function loadAccessTeamIds(memberId) {
  try {
    await ensureAccessTeamsTable();
    const rows = await db.query(
      'SELECT team_id FROM team_member_access_teams WHERE team_member_id = ?',
      [memberId]
    );
    return rows.map((row) => Number(row.team_id)).filter((id) => Number.isFinite(id) && id > 0);
  } catch (error) {
    console.error('loadAccessTeamIds error:', error.message);
    return [];
  }
}

async function loadMemberAccess(memberId, role = 'employee') {
  let perms = await loadStoredPermissions(memberId);
  if (perms && perms.length === 0) {
    await ensurePermissionsExist(memberId, role);
    perms = await loadStoredPermissions(memberId);
  }

  const stored = {};
  if (Array.isArray(perms)) {
    perms.forEach((row) => {
      stored[row.permission_key] = !!row.is_granted;
    });
  }

  const permissions = mergePermissionDefaults(role, stored);
  const accessTeamIds = await loadAccessTeamIds(memberId);

  return {
    permissions,
    writeAccess: !!permissions.write_access,
    allTeamsAccess: !!permissions.all_teams_access,
    accessTeamIds,
  };
}

function applyAccessToUser(user, access) {
  if (!user || !access) return user;
  user.permissions = access.permissions;
  user.writeAccess = access.writeAccess;
  user.allTeamsAccess = access.allTeamsAccess;
  user.accessTeamIds = access.accessTeamIds || [];
  return user;
}

function isElevatedTeamUser(user) {
  if (!user || user.type !== 'team') return false;
  if (user.role === 'project_manager') return true;
  if (user.writeAccess || user.permissions?.write_access) return true;
  if (user.allTeamsAccess || user.permissions?.all_teams_access) return true;
  if (user.accessTeamIds && user.accessTeamIds.length > 0) return true;
  return ELEVATED_VIEW_KEYS.some((key) => user.permissions?.[key]);
}

function canManageTasks(user) {
  if (!user) return false;
  if (user.type === 'admin') return true;
  if (user.type !== 'team') return false;
  const write = user.writeAccess === true || user.permissions?.write_access === true;
  if (!write) return false;
  return (
    user.allTeamsAccess === true ||
    user.permissions?.all_teams_access === true ||
    user.role === 'project_manager' ||
    (Array.isArray(user.accessTeamIds) && user.accessTeamIds.length > 0)
  );
}

function getTaskListScope(user) {
  if (!user || user.type === 'admin') {
    return { type: 'all' };
  }
  if (user.type !== 'team') {
    return { type: 'all' };
  }
  if (user.allTeamsAccess || user.permissions?.all_teams_access) {
    return { type: 'all' };
  }
  const teamIds = Array.isArray(user.accessTeamIds)
    ? [...new Set(user.accessTeamIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))]
    : [];
  if (teamIds.length > 0) {
    return { type: 'teams', teamIds, memberId: user.id };
  }
  return { type: 'own', memberId: user.id };
}

function getTaskScopeCondition(user, taskAlias = 't') {
  const scope = getTaskListScope(user);
  if (scope.type === 'all') {
    return { sql: '', params: [] };
  }
  if (scope.type === 'own') {
    return {
      sql: `EXISTS (
        SELECT 1 FROM task_assignees ta_scope
        WHERE ta_scope.task_id = ${taskAlias}.id
          AND ta_scope.assignee_id = ?
          AND ta_scope.assignee_type = 'team'
      )`,
      params: [scope.memberId],
    };
  }

  const placeholders = scope.teamIds.map(() => '?').join(',');
  return {
    sql: `(
      EXISTS (
        SELECT 1 FROM task_assignees ta_own
        WHERE ta_own.task_id = ${taskAlias}.id
          AND ta_own.assignee_id = ?
          AND ta_own.assignee_type = 'team'
      )
      OR EXISTS (
        SELECT 1 FROM task_assignees ta_team
        INNER JOIN team_members_teams tmt
          ON ta_team.assignee_id = tmt.team_member_id
         AND ta_team.assignee_type = 'team'
         AND tmt.is_active = 1
        WHERE ta_team.task_id = ${taskAlias}.id
          AND tmt.team_id IN (${placeholders})
      )
    )`,
    params: [scope.memberId, ...scope.teamIds],
  };
}

async function getAccessibleTeamMemberIds(user) {
  const scope = getTaskListScope(user);
  if (scope.type === 'all') return null;
  if (scope.type === 'own') return [Number(user.id)];

  try {
    const placeholders = scope.teamIds.map(() => '?').join(',');
    const rows = await db.query(
      `SELECT DISTINCT team_member_id
       FROM team_members_teams
       WHERE is_active = 1 AND team_id IN (${placeholders})`,
      scope.teamIds
    );
    const ids = new Set(rows.map((row) => Number(row.team_member_id)));
    ids.add(Number(user.id));
    return [...ids];
  } catch (error) {
    console.error('getAccessibleTeamMemberIds error:', error.message);
    return [Number(user.id)];
  }
}

async function replaceAccessTeams(memberId, teamIds) {
  await ensureAccessTeamsTable();
  await db.execute('DELETE FROM team_member_access_teams WHERE team_member_id = ?', [memberId]);
  const uniqueIds = [...new Set((teamIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];
  for (const teamId of uniqueIds) {
    await db.execute(
      'INSERT INTO team_member_access_teams (team_member_id, team_id) VALUES (?, ?)',
      [memberId, teamId]
    );
  }
  return uniqueIds;
}

module.exports = {
  PERMISSION_DEFINITIONS,
  ROLE_DEFAULT_PERMISSIONS,
  ALL_PERMISSION_KEYS,
  ensurePermissionsExist,
  ensureAccessTeamsTable,
  mergePermissionDefaults,
  loadMemberAccess,
  applyAccessToUser,
  isElevatedTeamUser,
  canManageTasks,
  getTaskListScope,
  getTaskScopeCondition,
  getAccessibleTeamMemberIds,
  replaceAccessTeams,
};
