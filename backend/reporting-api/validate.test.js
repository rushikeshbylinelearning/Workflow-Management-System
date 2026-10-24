const test = require('node:test');
const assert = require('node:assert/strict');
const { parseFields, resolveProjectIds, parseListQuery } = require('./validate');
const { ReportingError } = require('./errors');

const key = { projectIds: [58, 59], allProjects: false, fieldGroups: ['core', 'dates', 'derived', 'hierarchy', 'assignee', 'effort', 'org'] };

test('unknown fields → 400 listing invalid names', () => {
  assert.throws(
    () => parseFields('taskId;DROP TABLE x', 'tasks'),
    (err) => err instanceof ReportingError && err.status === 400 && err.extras.invalidFields.includes('taskId;DROP TABLE x')
  );
  assert.throws(() => parseFields('*', 'tasks'), (err) => err.status === 400);
});

test('injection-like projectIds rejected', () => {
  assert.throws(
    () => resolveProjectIds('58 OR 1=1', key.projectIds, false),
    (err) => err.status === 400
  );
});

test('unauthorized project → 403', () => {
  assert.throws(
    () => resolveProjectIds('99', key.projectIds, false),
    (err) => err.status === 403
  );
});

test('projectIds all uses key scope', () => {
  const scope = resolveProjectIds('all', key.projectIds, false);
  assert.equal(scope.mode, 'list');
  assert.deepEqual(scope.ids, [58, 59]);
});

test('default fields include projectId/projectName', () => {
  const q = parseListQuery({}, 'tasks', key);
  assert.ok(q.fields.includes('projectId'));
  assert.ok(q.fields.includes('projectName'));
  assert.ok(q.fields.includes('taskId'));
});
