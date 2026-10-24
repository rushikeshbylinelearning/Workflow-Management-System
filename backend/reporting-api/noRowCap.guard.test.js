const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ALLOW = /INTERNAL_BATCH_ONLY|SINGLE_ROW_LOOKUP|STRING_SLICE|ARRAY_COPY/;
const FORBIDDEN = /\b(limit|take|top|slice|maxRows|pageSize)\b/i;

test('reporting-api has no product row-cap keywords without allowlist comment', () => {
  const dir = __dirname;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js') && !f.endsWith('.test.js'));
  const offenders = [];

  for (const file of files) {
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!FORBIDDEN.test(line)) continue;
      // Allowlisted: comment on same line or previous non-empty line
      const prev = lines.slice(Math.max(0, i - 3), i + 1).join('\n');
      if (ALLOW.test(prev) || ALLOW.test(line)) continue;
      // Ignore pure comments / docs mentioning the forbidden words
      if (/^\s*(\*|\/\/)/.test(line)) continue;
      offenders.push(`${file}:${i + 1}: ${line.trim()}`);
    }
  }

  assert.deepEqual(offenders, [], offenders.join('\n'));
});
