const axios = require('axios');
const https = require('https');

/**
 * Posts a notification to a Microsoft Teams group chat
 * via Power Automate HTTP webhook.
 * ALWAYS fire-and-forget. Never throws. Never blocks.
 *
 * IMPORTANT: This file must only export postToTeams.
 * Run tests via: node scripts/test-teams-webhook.js
 */

/** Shared hosting often has broken IPv6 — curl works (IPv4) while Node times out on IPv6 first. */
function createWebhookHttpsAgent() {
  if (process.env.TEAMS_WEBHOOK_FORCE_IPV4 === 'false') return undefinACed;
  return new https.Agent({ family: 4, keepAlive: true });
}

async function postToTeams(webhookUrl, payload) {
  const timeoutMs = Number(process.env.TEAMS_WEBHOOK_TIMEOUT_MS) || 20000;

  try {
    // Ensure outbound webhook body is always valid JSON with stable keys.
    const teamsPayload = {
      name: payload?.name || 'N/A',
      teamName: payload?.teamName || 'N/A',
      date: payload?.date || new Date().toLocaleDateString('en-GB'),
      taskId: payload?.taskId ?? payload?.task_id ?? null,
      task_id: payload?.task_id ?? payload?.taskId ?? null,
      project: payload?.project || 'N/A',
      taskDetails: payload?.taskDetails || 'N/A',
      status: payload?.status || 'N/A',
      serverLink: payload?.serverLink || 'N/A',
      remark: payload?.remark || 'N/A',
      type: payload?.type || 'remark',
      imageUrl: payload?.imageUrl || null,
      ...payload,
    };

    if (!teamsPayload.teamName || teamsPayload.teamName === 'N/A') {
      console.warn('[Teams] Warning: teamName is missing — Power Automate may not route to the correct group');
    }

    console.log('[Teams DEBUG] Webhook URL:', webhookUrl ? 'SET' : 'NOT SET');
    console.log('[Teams DEBUG] Outbound payload:', JSON.stringify(teamsPayload, null, 2));

    const response = await axios.post(webhookUrl, teamsPayload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: timeoutMs,
      validateStatus: () => true,
      httpsAgent: createWebhookHttpsAgent(),
    });
    if (response.status >= 200 && response.status < 300) {
      console.log('[Teams] Notification sent successfully', `(HTTP ${response.status})`);
      return true;
    }
    console.error('[Teams] Notification failed (non-blocking):', {
      httpStatus: response.status,
      body: response.data,
    });
    return false;
  } catch (err) {
    console.error('[Teams] Notification failed (non-blocking):', {
      message: err.message,
      code: err.code,
      status: err.response?.status,
      body: err.response?.data,
    });
    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
      console.error(
        '[Teams] ETIMEDOUT from Node (curl may still work). ' +
        'Usually broken IPv6 on the host — we force IPv4 by default. ' +
        'Retry after redeploy; test POST with: node scripts/test-teams-webhook.js "IT Developers"'
      );
    } else if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      console.error('[Teams] DNS/connect error: server may block outbound HTTPS to Microsoft Power Platform.');
    }
    return false;
  }
}

module.exports = { postToTeams };
