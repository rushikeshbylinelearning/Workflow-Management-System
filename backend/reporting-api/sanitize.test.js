const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeString, sanitizeValue, REDACTED } = require('./sanitize');

test('strips UNC paths', () => {
  assert.equal(sanitizeString('see \\\\nas01\\share\\x.docx please'), `see ${REDACTED} please`);
});

test('strips internal HTTP URLs and IPs', () => {
  const out = sanitizeString('http://10.0.0.5/secret and 192.168.1.10');
  assert.ok(!out.includes('10.0.0.5'));
  assert.ok(!out.includes('192.168.1.10'));
  assert.ok(out.includes(REDACTED));
});

test('strips drive and volume paths', () => {
  assert.ok(!sanitizeString('C:\\data\\file.docx').includes('C:\\'));
  assert.ok(!sanitizeString('/volume1/projects/a').includes('/volume1'));
});

test('sanitizeValue walks objects', () => {
  const out = sanitizeValue({ remark: 'path \\\\fileserver\\x', nested: { a: '127.0.0.1' } });
  assert.equal(out.remark.includes('fileserver'), false);
  assert.equal(out.nested.a, REDACTED);
});
