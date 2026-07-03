const db = require('../db');

/**
 * SQL-backed Team accessor (teams table).
 * teamsWebhookUrl maps to teams_webhook_url (see migrations/add_teams_webhook_url.sql).
 */
function mapTeamRow(row) {
  if (!row) return null;
  return {
    ...row,
    teamsWebhookUrl: row.teams_webhook_url ?? null,
  };
}

const Team = {
  async findByIdAndUpdate(teamId, update, options = {}) {
    const { teamsWebhookUrl } = update;
    const existing = await db.query('SELECT id FROM teams WHERE id = ?', [teamId]);
    if (existing.length === 0) return null;

    await db.query(
      'UPDATE teams SET teams_webhook_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [teamsWebhookUrl, teamId]
    );

    if (options.new) {
      const rows = await db.query('SELECT * FROM teams WHERE id = ?', [teamId]);
      return mapTeamRow(rows[0]);
    }

    return mapTeamRow({ id: teamId, teams_webhook_url: teamsWebhookUrl });
  },
};

// === ADDITIVE SCHEMA FIELD (SQL column teams_webhook_url) ===
// teamsWebhookUrl: {
//   type: String,
//   default: null,
//   // Power Automate HTTP webhook URL for this team's Teams group chat
//   // e.g. "https://<env>.powerplatform.com/powerautomate/automations/..."
// }

module.exports = Team;
