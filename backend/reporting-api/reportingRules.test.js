const test = require('node:test');
const assert = require('node:assert/strict');
const {
  deriveTaskMetrics,
  calendarDateIST,
  COMPLETED_STATUSES,
} = require('./reportingRules');

test('completed statuses include completed and under-review', () => {
  assert.deepEqual(COMPLETED_STATUSES, ['completed', 'under-review']);
});

test('IST midnight boundary around 18:30 UTC', () => {
  assert.equal(calendarDateIST(new Date('2026-10-09T18:29:00Z')), '2026-10-09');
  assert.equal(calendarDateIST(new Date('2026-10-09T18:30:00Z')), '2026-10-10');
});

test('on-time completion: delayDays 0', () => {
  const m = deriveTaskMetrics({
    status: 'completed',
    dueDate: '2026-10-10',
    submissionDate: '2026-10-10',
    progress: 100,
  }, { now: new Date('2026-10-20T00:00:00Z') });
  assert.equal(m.delayDays, 0);
  assert.equal(m.overdueFlag, false);
  assert.equal(m.actualCompletionDate, '2026-10-10');
  assert.equal(m.completionPercent, 100);
});

test('early completion: delayDays 0', () => {
  const m = deriveTaskMetrics({
    status: 'under-review',
    dueDate: '2026-10-10',
    submissionDate: '2026-10-08',
    progress: 100,
  }, { now: new Date('2026-10-20T00:00:00Z') });
  assert.equal(m.delayDays, 0);
  assert.equal(m.actualCompletionDate, '2026-10-08');
  assert.equal(m.isCompleted, true);
});

test('1-day late completion', () => {
  const m = deriveTaskMetrics({
    status: 'completed',
    dueDate: '2026-10-09',
    submissionDate: '2026-10-10',
    progress: 100,
  }, { now: new Date('2026-10-20T00:00:00Z') });
  assert.equal(m.delayDays, 1);
  assert.equal(m.overdueFlag, false);
});

test('open overdue', () => {
  const m = deriveTaskMetrics({
    status: 'in-progress',
    dueDate: '2026-10-08',
    submissionDate: null,
    progress: 40,
  }, { now: new Date('2026-10-09T18:29:00Z') });
  assert.equal(m.overdueFlag, true);
  assert.equal(m.delayDays, 1);
  assert.equal(m.completionPercent, 40);
});

test('open not yet due', () => {
  const m = deriveTaskMetrics({
    status: 'in-progress',
    dueDate: '2026-10-15',
    submissionDate: null,
    progress: 10,
  }, { now: new Date('2026-10-09T18:29:00Z') });
  assert.equal(m.overdueFlag, false);
  assert.equal(m.delayDays, 0);
});

test('null due date', () => {
  const m = deriveTaskMetrics({
    status: 'in-progress',
    dueDate: null,
    submissionDate: null,
    progress: 0,
  }, { now: new Date('2026-10-09T18:29:00Z') });
  assert.equal(m.delayDays, 0);
  assert.equal(m.overdueFlag, false);
});

test('null submission date for completed task', () => {
  const m = deriveTaskMetrics({
    status: 'completed',
    dueDate: '2026-10-09',
    submissionDate: null,
    progress: 100,
  }, { now: new Date('2026-10-20T00:00:00Z') });
  assert.equal(m.actualCompletionDate, null);
  assert.equal(m.delayDays, 0);
  assert.equal(m.completionPercent, 100);
});

test('ignores stored completed_date-style input — only submissionDate', () => {
  const m = deriveTaskMetrics({
    status: 'completed',
    dueDate: '2026-10-09',
    submissionDate: '2026-10-08',
    // If a caller mistakenly passed approval date as something else, we only read submissionDate
    progress: 100,
  }, { now: new Date('2026-10-20T00:00:00Z') });
  assert.equal(m.actualCompletionDate, '2026-10-08');
});
