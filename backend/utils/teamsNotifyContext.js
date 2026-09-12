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

const BULK_REMARK_STAGE_LABELS = {
  general: 'General / In Progress',
  complete: 'Completed',
  skipped: 'Skipped',
  other: 'Other',
};

function clipTeamsCell(value, max = 160) {
  const text = stripHtml(String(value || '')).replace(/\|/g, '/');
  if (!text) return '—';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function formatBulkRemarkTeamsMessage(rows) {
  const lines = [
    `Bulk remark update — ${rows.length} task${rows.length === 1 ? '' : 's'}`,
    '',
    'Tags | Task Name | Description | Stage | File Location | File Name | Remark',
  ];
  rows.forEach((row, index) => {
    lines.push(
      `${index + 1}. ${[
        clipTeamsCell(row.tags, 80),
        clipTeamsCell(row.name, 80),
        clipTeamsCell(row.description, 100),
        clipTeamsCell(row.stageLabel, 40),
        clipTeamsCell(row.fileLocation, 80),
        clipTeamsCell(row.fileName, 80),
        clipTeamsCell(row.remark, 160),
      ].join(' | ')}`
    );
  });
  return lines.join('\n');
}

/**
 * One Teams chat post for a bulk remark submit, instead of one message per task.
 * Reuses the existing Power Automate payload keys so the flow still posts.
 */
async function notifyBulkAssigneeRemarks(user, updates) {
  if (!isAssigneeTeamsActor(user) || !Array.isArray(updates) || updates.length === 0) return;

  try {
    const ids = updates.map((row) => Number(row.taskId)).filter((id) => id > 0);
    if (ids.length === 0) return;

    const placeholders = ids.map(() => '?').join(',');
    const tasks = await db.query(
      `SELECT t.id, t.name, t.description, t.component_path, p.name AS project_name,
              g.name AS grade_name, b.name AS book_name, u.name AS unit_name, l.name AS lesson_name
       FROM tasks t
       LEFT JOIN projects p ON t.project_id = p.id
       LEFT JOIN grades g ON t.grade_id = g.id
       LEFT JOIN books b ON t.book_id = b.id
       LEFT JOIN units u ON t.unit_id = u.id
       LEFT JOIN lessons l ON t.lesson_id = l.id
       WHERE t.id IN (${placeholders})`,
      ids
    );
    const byId = {};
    for (const task of tasks) {
      byId[Number(task.id)] = task;
    }

    const tableRows = updates.map((row) => {
      const task = byId[Number(row.taskId)] || {};
      const tags = task.component_path
        || [task.grade_name, task.book_name, task.unit_name, task.lesson_name].filter(Boolean).join(' > ');
      return {
        taskId: Number(row.taskId),
        tags: tags || '—',
        name: task.name || '—',
        description: task.description || '—',
        stage: row.stage,
        stageLabel: BULK_REMARK_STAGE_LABELS[row.stage] || row.stage || '—',
        fileLocation: row.fileLocation || '—',
        fileName: row.fileName || '—',
        remark: stripHtml(row.remark) || '—',
        project: task.project_name || 'N/A',
      };
    });

    const table = formatBulkRemarkTeamsMessage(tableRows);
    const projects = [...new Set(tableRows.map((row) => row.project).filter((name) => name && name !== 'N/A'))];

    await notifyAssigneeTeams(user, ids[0], {
      project: projects.length === 1 ? projects[0] : (projects.join(', ') || 'N/A'),
      taskDetails: `Bulk remark update (${tableRows.length} tasks)`,
      taskDescription: `${tableRows.length} tasks updated in one bulk remark`,
      task_description: `${tableRows.length} tasks updated in one bulk remark`,
      serverLink: tableRows.length === 1 ? tableRows[0].fileLocation : 'See bulk table',
      fileName: tableRows.length === 1 ? tableRows[0].fileName : 'See bulk table',
      remark: table,
      status: 'Bulk update',
      type: 'remark',
      isBulk: true,
      bulkCount: tableRows.length,
      tasks: tableRows,
    });
  } catch (err) {
    console.error('[Teams] Bulk remark notification failed (non-blocking):', err.message);
  }
}

module.exports = {
  isAssigneeTeamsActor,
  resolveAssigneeTeamsNotifyContext,
  resolveTeamForNotify,
  notifyAssigneeTeams,
  notifyBulkAssigneeRemarks,
};
