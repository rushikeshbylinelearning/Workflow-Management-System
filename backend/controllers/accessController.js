const db = require('../db');

// All available permission keys with their display labels
const PERMISSION_DEFINITIONS = [
  { key: 'view_projects', label: 'View Projects', description: 'Access the Projects section', category: 'Projects' },
  { key: 'view_tasks', label: 'View Tasks', description: 'Access the Tasks section', category: 'Tasks' },
  { key: 'view_team', label: 'View Team', description: 'Access the Team Management section', category: 'Team' },
  { key: 'view_analytics', label: 'View Analytics', description: 'Access the Analytics section', category: 'Analytics' },
  { key: 'view_allocations', label: 'View Allocations', description: 'Access the Daily Allocations section', category: 'Allocations' },
  { key: 'view_top_performers', label: 'View Top Performers', description: 'Access the Top Performers section', category: 'Reports' },
  { key: 'view_notifications', label: 'View Notifications', description: 'Access the Notifications / Activities section', category: 'Notifications' },
  { key: 'view_dashboard', label: 'View Dashboard', description: 'Access the main Dashboard overview', category: 'Dashboard' },
];

// Default permissions per role
const ROLE_DEFAULT_PERMISSIONS = {
  employee: {
    view_dashboard: true,
    view_tasks: true,
    view_notifications: true,
    view_projects: false,
    view_team: false,
    view_analytics: false,
    view_allocations: false,
    view_top_performers: false,
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
  },
};

// Helper: ensure permissions rows exist for a team member
const ensurePermissionsExist = async (teamMemberId, role = 'employee') => {
  const defaults = ROLE_DEFAULT_PERMISSIONS[role] || ROLE_DEFAULT_PERMISSIONS.employee;

  for (const [key, isGranted] of Object.entries(defaults)) {
    // INSERT IGNORE so we don't overwrite existing custom permissions
    await db.execute(
      `INSERT IGNORE INTO team_member_permissions (team_member_id, permission_key, is_granted)
       VALUES (?, ?, ?)`,
      [teamMemberId, key, isGranted ? 1 : 0]
    );
  }
};

// GET /api/access/permissions-definitions
const getPermissionDefinitions = async (req, res) => {
  try {
    res.json({ success: true, data: PERMISSION_DEFINITIONS });
  } catch (error) {
    console.error('getPermissionDefinitions error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch permission definitions' });
  }
};

// GET /api/access/members
const getMembersWithPermissions = async (req, res) => {
  try {
    // Get all team members with their permissions
    const members = await db.query(`
      SELECT 
        tm.id,
        tm.name,
        tm.email,
        tm.role,
        tm.is_active,
        tm.passcode,
        GROUP_CONCAT(DISTINCT s.name SEPARATOR ',') as skills
      FROM team_members tm
      LEFT JOIN team_member_skills tms ON tm.id = tms.team_member_id
      LEFT JOIN skills s ON tms.skill_id = s.id
      WHERE tm.is_active = 1
      GROUP BY tm.id, tm.name, tm.email, tm.role, tm.is_active, tm.passcode
      ORDER BY tm.name ASC
    `);

    const remarkOptions = require('../services/remarkOptionsService');
    const assignedByMember = await remarkOptions.getAssignedOptionIdsByMember(
      members.map((member) => member.id)
    );

    // For each member, get permissions
    for (const member of members) {
      member.skills = member.skills ? member.skills.split(',') : [];
      const assignedIds = assignedByMember[member.id] || [];
      member.remark_option_ids = assignedIds;
      member.uses_default_remark_options = assignedIds.length === 0;

      const perms = await db.query(
        'SELECT permission_key, is_granted FROM team_member_permissions WHERE team_member_id = ?',
        [member.id]
      );

      // Ensure permissions rows exist (lazy init)
      if (perms.length === 0) {
        await ensurePermissionsExist(member.id, member.role || 'employee');
        const freshPerms = await db.query(
          'SELECT permission_key, is_granted FROM team_member_permissions WHERE team_member_id = ?',
          [member.id]
        );
        member.permissions = {};
        freshPerms.forEach(p => { member.permissions[p.permission_key] = !!p.is_granted; });
      } else {
        member.permissions = {};
        perms.forEach(p => { member.permissions[p.permission_key] = !!p.is_granted; });
      }
    }

    res.json({ success: true, data: members });
  } catch (error) {
    console.error('getMembersWithPermissions error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch members with permissions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// PUT /api/access/members/:id/role
const updateMemberRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['employee', 'project_manager'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role. Must be employee or project_manager' });
    }

    // Update role
    await db.execute('UPDATE team_members SET role = ? WHERE id = ?', [role, id]);

    // Apply default permissions for the new role (overwrite all existing)
    const defaults = ROLE_DEFAULT_PERMISSIONS[role];
    for (const [key, isGranted] of Object.entries(defaults)) {
      await db.execute(
        `INSERT INTO team_member_permissions (team_member_id, permission_key, is_granted)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE is_granted = VALUES(is_granted)`,
        [id, key, isGranted ? 1 : 0]
      );
    }

    // Return updated permissions
    const perms = await db.query(
      'SELECT permission_key, is_granted FROM team_member_permissions WHERE team_member_id = ?',
      [id]
    );
    const permissions = {};
    perms.forEach(p => { permissions[p.permission_key] = !!p.is_granted; });

    res.json({ success: true, message: 'Role updated successfully', data: { role, permissions } });
  } catch (error) {
    console.error('updateMemberRole error:', error);
    res.status(500).json({ success: false, message: 'Failed to update role' });
  }
};

// PUT /api/access/members/:id/permissions
const updateMemberPermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body; // { view_projects: true, view_tasks: false, ... }

    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({ success: false, message: 'permissions object is required' });
    }

    // Upsert each permission
    for (const [key, isGranted] of Object.entries(permissions)) {
      await db.execute(
        `INSERT INTO team_member_permissions (team_member_id, permission_key, is_granted)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE is_granted = VALUES(is_granted)`,
        [id, key, isGranted ? 1 : 0]
      );
    }

    res.json({ success: true, message: 'Permissions updated successfully', data: { permissions } });
  } catch (error) {
    console.error('updateMemberPermissions error:', error);
    res.status(500).json({ success: false, message: 'Failed to update permissions' });
  }
};

// GET /api/access/my-permissions  (called by logged-in team member)
const getMyPermissions = async (req, res) => {
  try {
    const memberId = req.user.id;

    const member = await db.queryFirst(
      'SELECT id, name, email, role, is_active FROM team_members WHERE id = ? AND is_active = 1',
      [memberId]
    );

    if (!member) {
      return res.status(404).json({ success: false, message: 'Team member not found' });
    }

    let perms = await db.query(
      'SELECT permission_key, is_granted FROM team_member_permissions WHERE team_member_id = ?',
      [memberId]
    );

    if (perms.length === 0) {
      await ensurePermissionsExist(memberId, member.role || 'employee');
      perms = await db.query(
        'SELECT permission_key, is_granted FROM team_member_permissions WHERE team_member_id = ?',
        [memberId]
      );
    }

    const permissions = {};
    perms.forEach(p => { permissions[p.permission_key] = !!p.is_granted; });

    res.json({
      success: true,
      data: {
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role || 'employee',
        permissions,
      },
    });
  } catch (error) {
    console.error('getMyPermissions error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch permissions' });
  }
};

module.exports = {
  getPermissionDefinitions,
  getMembersWithPermissions,
  updateMemberRole,
  updateMemberPermissions,
  getMyPermissions,
  ensurePermissionsExist,
  PERMISSION_DEFINITIONS,
  ROLE_DEFAULT_PERMISSIONS,
};
