#!/usr/bin/env node
/**
 * Standalone Teams webhook test — run from backend/:
 *   node scripts/test-teams-webhook.js "IT Developers"
 *
 * Power Automate routes messages by teamName — always pass the exact group name.
 * Optional: set TEAMS_TEST_TEAM_NAME in .env
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const teamsNotifier = require('../utils/teamsNotifier');
const { postToTeams } = teamsNotifier;

if (typeof postToTeams !== 'function') {
  console.error('❌ teamsNotifier.js is broken on this server.');
  console.error('   Expected: module.exports = { postToTeams };');
  console.error('   Fix: redeploy backend/utils/teamsNotifier.js from repo, then restart PM2.');
  process.exit(1);
}

const teamNameArg = process.argv[2] || process.env.TEAMS_TEST_TEAM_NAME;

async function resolveWebhookForTeam(teamName) {
  if (!teamName) return { teamName: null, webhookUrl: process.env.TEAMS_WEBHOOK_URL || null };

  try {
    const db = require('../db');
    const rows = await db.query(
      `SELECT name AS teamName, teams_webhook_url AS teamsWebhookUrl
       FROM teams
       WHERE is_active = 1 AND name = ?
       LIMIT 1`,
      [teamName]
    );
    if (rows[0]) {
      return {
        teamName: rows[0].teamName,
        webhookUrl: rows[0].teamsWebhookUrl || process.env.TEAMS_WEBHOOK_URL || null,
      };
    }
    console.warn(`⚠️  Team "${teamName}" not found in DB — using name as-is with TEAMS_WEBHOOK_URL fallback`);
    return { teamName, webhookUrl: process.env.TEAMS_WEBHOOK_URL || null };
  } catch (err) {
    console.warn(`⚠️  DB lookup failed (${err.message}) — using TEAMS_WEBHOOK_URL only`);
    return { teamName, webhookUrl: process.env.TEAMS_WEBHOOK_URL || null };
  }
}

(async () => {
  const { teamName, webhookUrl } = await resolveWebhookForTeam(teamNameArg);

  if (!teamName) {
    console.error('❌ teamName is required for Power Automate routing.');
    console.error('   Usage: node scripts/test-teams-webhook.js "IT Developers"');
    console.error('   Or set TEAMS_TEST_TEAM_NAME in backend/.env');
    process.exit(1);
  }

  if (!webhookUrl) {
    console.error('❌ No webhook URL — set teams_webhook_url on the team or TEAMS_WEBHOOK_URL in .env');
    process.exit(1);
  }

  const testPayload = {
    name: 'Test User',
    teamName,
    date: new Date().toLocaleDateString('en-GB'),
    taskId: 1,
    task_id: 1,
    project: 'Workflow App',
    taskDetails: 'Testing Teams integration',
    status: 'In Progress',
    serverLink: 'localhost',
    remark: 'This is a test message sent from the backend',
    type: 'remark',
  };

  console.log('Sending test notification to Teams...');
  console.log('[Teams DEBUG] Routing teamName:', teamName);
  console.log('[Teams DEBUG] Payload being sent:', JSON.stringify(testPayload, null, 2));

  const ok = await postToTeams(webhookUrl, testPayload);
  if (!ok) {
    console.error('❌ Test failed — webhook was not accepted from this server.');
    console.error('   If code is ETIMEDOUT, your host blocks/slow-routes outbound calls to Power Automate.');
    console.error('   If curl -I returns 200 but Node fails, redeploy teamsNotifier.js (IPv4 fix).');
    console.error('   POST test: curl -sS -m 20 -X POST -H "Content-Type: application/json" \\');
    console.error('     -d \'{"teamName":"' + teamName + '","name":"curl test","type":"remark"}\' \\');
    console.error('     "$(grep TEAMS_WEBHOOK_URL .env | cut -d= -f2-)"');
    process.exit(1);
  }
  console.log('✅ Test complete. Check the Teams group for:', teamName);
  process.exit(0);
})().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
