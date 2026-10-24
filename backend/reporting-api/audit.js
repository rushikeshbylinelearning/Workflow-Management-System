/**
 * Audit logger — never stores API keys or response bodies.
 */

async function writeAudit(database, entry) {
  try {
    await database.execute(
      `INSERT INTO reporting_audit_log
        (key_id, user_id, endpoint, project_ids, fields, filters, row_count, duration_ms, status_code, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.keyId || null,
        entry.userId || null,
        entry.endpoint,
        JSON.stringify(entry.projectIds || []),
        JSON.stringify(entry.fields || []),
        JSON.stringify(entry.filters || {}),
        entry.rowCount == null ? null : Number(entry.rowCount),
        entry.durationMs == null ? null : Number(entry.durationMs),
        entry.statusCode || null,
        entry.ip ? String(entry.ip).slice(0, 64) : null, // STRING_SLICE
      ]
    );
  } catch {
    // Never fail the request because audit write failed
  }
}

module.exports = { writeAudit };
