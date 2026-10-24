/**
 * Streamed JSON / NDJSON writers for uncapped reporting extracts.
 *
 * INTERNAL_BATCH_ONLY: SQL LIMIT is used solely as a memory window for keyset
 * iteration. There is NO product-level row cap — iteration continues until exhausted.
 */

// INTERNAL_BATCH_ONLY — memory window, not a row cap
const INTERNAL_BATCH_SIZE = Number(process.env.REPORTING_INTERNAL_BATCH_SIZE || 1000);

const { formatIstIsoNow } = require('./reportingRules');
const { sanitizeValue } = require('./sanitize');

function getInternalBatchSize() {
  const n = INTERNAL_BATCH_SIZE;
  return Number.isInteger(n) && n > 0 ? Math.min(n, 5000) : 1000;
}

/**
 * Keyset-iterate a query factory until exhausted, with no total row cap.
 * @param {(cursor: {updatedAt: string|null, id: number|null}, batchSize: number) => Promise<object[]>} fetchBatch
 * @param {(row: object) => object} mapRow
 */
async function* iterateKeyset(fetchBatch, mapRow) {
  const batchSize = getInternalBatchSize();
  let cursor = { updatedAt: null, id: null };
  for (;;) {
    const rows = await fetchBatch(cursor, batchSize);
    if (!rows || rows.length === 0) break;
    for (const row of rows) {
      yield mapRow(row);
    }
    const last = rows[rows.length - 1];
    cursor = {
      updatedAt: last._cursorUpdatedAt != null ? last._cursorUpdatedAt : last.updated_at,
      id: last._cursorId != null ? last._cursorId : last.id,
    };
    // INTERNAL_BATCH_ONLY: stop only when the driver returns a short page (end of data)
    if (rows.length < batchSize) break;
  }
}

async function writeJsonEnvelope(res, {
  iterate,
  metaBase,
  correlationId,
}) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (correlationId) res.setHeader('X-Correlation-Id', correlationId);
  // Avoid compression buffering entire payload when possible
  res.setHeader('X-Accel-Buffering', 'no');

  res.write('{"data":[');
  let count = 0;
  let first = true;
  for await (const row of iterate) {
    const safe = sanitizeValue(row);
    const chunk = JSON.stringify(safe);
    if (!first) res.write(',');
    first = false;
    res.write(chunk);
    count += 1;
    if (count % 50 === 0 && typeof res.flush === 'function') res.flush();
  }
  const meta = {
    ...metaBase,
    count,
    generatedAt: formatIstIsoNow(),
  };
  res.write(`],"meta":${JSON.stringify(meta)}}`);
  res.end();
  return count;
}

async function writeNdjson(res, {
  iterate,
  metaBase,
  correlationId,
}) {
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (correlationId) res.setHeader('X-Correlation-Id', correlationId);
  res.setHeader('X-Accel-Buffering', 'no');

  let count = 0;
  for await (const row of iterate) {
    res.write(`${JSON.stringify(sanitizeValue(row))}\n`);
    count += 1;
  }
  const meta = {
    ...metaBase,
    count,
    generatedAt: formatIstIsoNow(),
  };
  res.write(`${JSON.stringify({ meta })}\n`);
  res.end();
  return count;
}

module.exports = {
  INTERNAL_BATCH_SIZE,
  getInternalBatchSize,
  iterateKeyset,
  writeJsonEnvelope,
  writeNdjson,
};
