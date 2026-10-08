const db = require('../db');
const {
  PERMISSION_DEFINITIONS,
  ROLE_DEFAULT_PERMISSIONS,
  ALL_PERMISSION_KEYS,
  ensurePermissionsExist,
  mergePermissionDefaults,
  loadMemberAccess,
  replaceAccessTeams,
} = require('../utils/accessPermissions');

const getPermissionDefinitions = async (req, res) => {
  try {
    res.json({ success: true, data: PERMISSION_DEFINITIONS });
  } catch (error) {
    console.error('getPermissionDefinitions error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch permission definitions' });
  }
};

const formatMemberAccess = (member, access) => ({
  ...member,
  permissions: access.permissions,
  access_level: access.writeAccess ? 'write' : 'read',
  all_teams_access: access.allTeamsAccess,
  access_team_ids: access.accessTeamIds,
});

const getMembersWithPermissions = async (req, res) => {
  try {
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

    let assignedByMember = {};
    let assignedFieldsByMember = {};
    try {
      const remarkOptions = require('../services/remarkOptionsService');
      assignedByMember = await remarkOptions.getAssignedOptionIdsByMember(members.map((member) => member.id));
    } catch (error) {
      console.error('Remark option assignment lookup failed:', error.message);
    }
    try {
      const remarkFields = require('../services/remarkFieldsService');
      assignedFieldsByMember = await remarkFields.getAssignedFieldIdsByMember(members.map((member) => member.id));
    } catch (error) {
      console.error('Remark field assignment lookup failed:', error.message);
    }

    const data = [];
    for (const member of members) {
      member.skills = member.skills ? member.skills.split(',') : [];
      const assignedIds = assignedByMember[member.id] || [];
      member.remark_option_ids = assignedIds;
      member.uses_default_remark_options = assignedIds.length === 0;
      member.remark_field_ids = assignedFieldsByMember[member.id] || [];
      const access = await loadMemberAccess(member.id, member.role || 'employee');
      data.push(formatMemberAccess(member, access));
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('getMembersWithPermissions error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch members with permissions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

const updateMemberRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['employee', 'project_manager'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role. Must be employee or project_manager' });
    }

    await db.execute('UPDATE team_members SET role = ? WHERE id = ?', [role, id]);

    const defaults = ROLE_DEFAULT_PERMISSIONS[role];
    for (const [key, isGranted] of Object.entries(defaults)) {
      await db.execute(
        `INSERT INTO team_member_permissions (team_member_id, permission_key, is_granted)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE is_granted = VALUES(is_granted)`,
        [id, key, isGranted ? 1 : 0]
      );
    }

    const access = await loadMemberAccess(id, role);
    res.json({
      success: true,
      message: 'Role updated successfully',
      data: {
        role,
        permissions: access.permissions,
        access_level: access.writeAccess ? 'write' : 'read',
        all_teams_access: access.allTeamsAccess,
        access_team_ids: access.accessTeamIds,
      },
    });
  } catch (error) {
    console.error('updateMemberRole error:', error);
    res.status(500).json({ success: false, message: 'Failed to update role' });
  }
};

const updateMemberPermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions, access_team_ids } = req.body;

    if (permissions && typeof permissions === 'object') {
      const allowedKeys = new Set(ALL_PERMISSION_KEYS);
      for (const [key, isGranted] of Object.entries(permissions)) {
        if (!allowedKeys.has(key)) continue;
        await db.execute(
          `INSERT INTO team_member_permissions (team_member_id, permission_key, is_granted)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE is_granted = VALUES(is_granted)`,
          [id, key, isGranted ? 1 : 0]
        );
      }
    } else if (access_team_ids === undefined) {
      return res.status(400).json({ success: false, message: 'permissions object is required' });
    }

    let savedTeamIds;
    if (Array.isArray(access_team_ids)) {
      savedTeamIds = await replaceAccessTeams(id, access_team_ids);
    }

    const member = await db.queryFirst('SELECT role FROM team_members WHERE id = ?', [id]);
    const access = await loadMemberAccess(id, member?.role || 'employee');
    res.json({
      success: true,
      message: 'Permissions updated successfully',
      data: {
        permissions: access.permissions,
        access_level: access.writeAccess ? 'write' : 'read',
        all_teams_access: access.allTeamsAccess,
        access_team_ids: savedTeamIds || access.accessTeamIds,
      },
    });
  } catch (error) {
    console.error('updateMemberPermissions error:', error);
    res.status(500).json({ success: false, message: 'Failed to update permissions' });
  }
};

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

    const role = member.role || 'employee';
    
    try {
      const access = await loadMemberAccess(memberId, role);

      res.json({
        success: true,
        data: {
          id: member.id,
          name: member.name,
          email: member.email,
          role,
          access_level: access.writeAccess ? 'write' : 'read',
          write_access: access.writeAccess,
          all_teams_access: access.allTeamsAccess,
          access_team_ids: access.accessTeamIds,
          permissions: access.permissions,
        },
      });
    } catch (accessError) {
      console.error('Error loading access permissions:', accessError);
      // Return defaults if access loading fails
      const defaults = ROLE_DEFAULT_PERMISSIONS[role] || ROLE_DEFAULT_PERMISSIONS.employee;
      res.json({
        success: true,
        data: {
          id: member.id,
          name: member.name,
          email: member.email,
          role,
          access_level: defaults.write_access ? 'write' : 'read',
          write_access: defaults.write_access || false,
          all_teams_access: defaults.all_teams_access || false,
          access_team_ids: [],
          permissions: defaults,
        },
      });
    }
  } catch (error) {
    console.error('getMyPermissions error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch permissions', error: error.message });
  }
};

const getAccessTeams = async (req, res) => {
  try {
    const teams = await db.query(`
      SELECT id, name, description, is_active
      FROM teams
      WHERE is_active = 1
      ORDER BY name ASC
    `);

    res.json({ success: true, data: teams });
  } catch (error) {
    console.error('getAccessTeams error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch teams' });
  }
};

module.exports = {
  getPermissionDefinitions,
  getMembersWithPermissions,
  updateMemberRole,
  updateMemberPermissions,
  getMyPermissions,
  getAccessTeams,
  ensurePermissionsExist,
  PERMISSION_DEFINITIONS,
  ROLE_DEFAULT_PERMISSIONS,
  mergePermissionDefaults,
};
