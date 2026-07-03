const db = require('../db');

/**
 * Ensures active team-member assignees exist in project_members for a project.
 * Existing members are preserved; only missing assignees are inserted.
 */
async function ensureTeamMembersOnProject(projectId, assigneeIds, { role = 'member' } = {}) {
  if (!projectId || !assigneeIds?.length) {
    return { added: [] };
  }

  const uniqueIds = [
    ...new Set(
      assigneeIds
        .map((id) => parseInt(id, 10))
        .filter((id) => !Number.isNaN(id) && id > 0)
    ),
  ];

  if (uniqueIds.length === 0) {
    return { added: [] };
  }

  const placeholders = uniqueIds.map(() => '?').join(',');
  const teamMembers = await db.query(
    `SELECT id FROM team_members WHERE id IN (${placeholders}) AND is_active = true`,
    uniqueIds
  );

  if (teamMembers.length === 0) {
    return { added: [] };
  }

  const added = [];
  for (const member of teamMembers) {
    const existing = await db.query(
      'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
      [projectId, member.id]
    );

    if (existing.length === 0) {
      await db.insert(
        'INSERT INTO project_members (project_id, user_id, user_type, role) VALUES (?, ?, ?, ?)',
        [projectId, member.id, 'team', role]
      );
      added.push(member.id);
    }
  }

  return { added };
}

module.exports = { ensureTeamMembersOnProject };
