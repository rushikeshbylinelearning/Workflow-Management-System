const db = require('../db');
const { postToTeams } = require('./teamsNotifier');
const { stripHtml } = require('./sanitizeRemark');

/** Only employee assignees may trigger Teams — never admin or project managers. */
function isAssigneeTeamsActor(user) {
  return !!user && user.type === 'team' && user.role !== 'project_manager';
}

function logTeamsSkip(taskId, user, reason) {
  if (user?.type !== 'team') return;
  console.log(
    `[Teams] Skipped task=${taskId} user=${user.id} role=${user.role || 'unknown'}: ${reason}`
  );
}

/**
 * Resolve Teams webhook context only when the acting user is an assigned team member.
 */
async function resolveAssigneeTeamsNotifyContext(user, taskId) {
  if (!user) {
    return null;
  }
  if (user.type !== 'team') {
    return null;
  }
  if (user.role === 'project_manager') {
    logTeamsSkip(taskId, user, 'project managers do not trigger Teams notifications');
    return null;
  }

  const assigneeRows = await db.query(
    `SELECT 1 FROM task_assignees
     WHERE task_id = ? AND assignee_id = ? AND assignee_type = 'team'
     LIMIT 1`,
    [taskId, user.id]
  );
  if (assigneeRows.length === 0) {
    logTeamsSkip(taskId, user, 'not a direct task assignee');
    return null;
  }

  const teamRow = await resolveTeamForNotify(user.id, taskId);
  if (!teamRow?.teamName) {
    logTeamsSkip(taskId, user, 'could not resolve team name for Power Automate routing');
    return null;
  }

  const webhookUrl = teamRow.teamsWebhookUrl || process.env.TEAMS_WEBHOOK_URL;
  if (!webhookUrl) {
    logTeamsSkip(taskId, user, 'no webhook URL on team or in TEAMS_WEBHOOK_URL');
    return null;
  }

  return {
    name: user.name || 'N/A',
    teamName: teamRow.teamName,
    webhookUrl,
  };
}

/**
 * Power Automate routes by teamName — prefer the project-assigned team the member belongs to.
 */
async function resolveTeamForNotify(teamMemberId, taskId) {
  const projectTeams = await db.query(
    `SELECT t.teams_webhook_url AS teamsWebhookUrl, t.name AS teamName
     FROM tasks tk
     INNER JOIN project_teams pt ON pt.project_id = tk.project_id
     INNER JOIN teams t ON t.id = pt.team_id AND t.is_active = 1
     INNER JOIN team_members_teams tmt ON tmt.team_id = t.id AND tmt.team_member_id = ? AND tmt.is_active = 1
     WHERE tk.id = ?
     ORDER BY (t.teams_webhook_url IS NOT NULL AND t.teams_webhook_url != '') DESC, t.name ASC
     LIMIT 1`,
    [teamMemberId, taskId]
  );
  if (projectTeams.length > 0) return projectTeams[0];

  const memberTeams = await db.query(
    `SELECT t.teams_webhook_url AS teamsWebhookUrl, t.name AS teamName
     FROM teams t
     INNER JOIN team_members_teams tmt ON t.id = tmt.team_id AND tmt.is_active = 1
     WHERE tmt.team_member_id = ? AND t.is_active = 1
     ORDER BY (t.teams_webhook_url IS NOT NULL AND t.teams_webhook_url != '') DESC, t.name ASC
     LIMIT 1`,
    [teamMemberId]
  );
  return memberTeams[0] || null;
}

/**
 * Single entry point for Teams chat posts from task actions.
 * Admin/PM actions are ignored; only assigned team employees may notify.
 */
async function notifyAssigneeTeams(user, taskId, payload) {
  try {
    const ctx = await resolveAssigneeTeamsNotifyContext(user, taskId);
    if (!ctx) return;

    const numericTaskId = Number(taskId);
    let remark = payload?.remark;
    if (remark && typeof remark === 'string' && remark.includes('<')) {
      remark = stripHtml(remark) || remark;
    }

    const teamsPayload = {
      ...payload,
      name: ctx.name,
      teamName: ctx.teamName,
      date: new Date().toLocaleDateString('en-GB'),
      taskId: numericTaskId,
      task_id: numericTaskId,
      remark: remark ?? payload?.remark ?? 'N/A',
    };
    console.log('[Teams DEBUG] Routing teamName:', ctx.teamName);
    console.log('[Teams DEBUG] Payload being sent:', JSON.stringify(teamsPayload, null, 2));
    if (typeof postToTeams !== 'function') {
      console.error('[Teams] teamsNotifier.js export missing — redeploy backend/utils/teamsNotifier.js');
      return;
    }
    postToTeams(ctx.webhookUrl, teamsPayload).catch((err) => {
      console.error('[Teams] postToTeams rejected:', err?.message || err);
    });
  } catch (err) {
    console.error('[Teams] Notification setup error (non-blocking):', err.message);
  }
}

module.exports = {
  isAssigneeTeamsActor,
  resolveAssigneeTeamsNotifyContext,
  resolveTeamForNotify,
  notifyAssigneeTeams,
};
