const test = require('node:test');
const assert = require('node:assert/strict');
const { iterateKeyset, getInternalBatchSize } = require('./stream');

async function countIterate(total) {
  const batchSize = getInternalBatchSize();
  let served = 0;
  const fetchBatch = async (cursor, size) => {
    if (served >= total) return [];
    const n = Math.min(size, total - served);
    const rows = [];
    for (let i = 0; i < n; i += 1) {
      const id = served + i + 1;
      rows.push({
        id,
        task_id: id,
        updated_at: `2026-01-01T00:00:00Z`,
        _cursorId: id,
        _cursorUpdatedAt: `2026-01-01T00:00:00Z`,
      });
    }
    served += n;
    return rows;
  };

  let count = 0;
  for await (const row of iterateKeyset(fetchBatch, (r) => ({ taskId: r.task_id }))) {
    count += 1;
    assert.equal(row.taskId, count);
  }
  return { count, batchSize };
}

test('streams exact count for 1001 rows with no product cap', async () => {
  const { count, batchSize } = await countIterate(1001);
  assert.equal(count, 1001);
  assert.ok(batchSize > 0);
  assert.ok(1001 > batchSize, 'uses multiple internal batches');
});

test('streams exact count for 25000 rows', async () => {
  const { count } = await countIterate(25000);
  assert.equal(count, 25000);
});
