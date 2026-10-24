const test = require('node:test');
const assert = require('node:assert/strict');
const { deriveTaskMetrics, calendarDate } = require('./derived');
const { htmlToText, remarkListCounts } = require('./htmlText');

const TZ = 'Asia/Kolkata';
const completion = ['completed'];

test('today in Asia/Kolkata flips at 18:30 UTC', () => {
  assert.equal(calendarDate(new Date('2026-10-09T18:29:00Z'), TZ), '2026-10-09');
  assert.equal(calendarDate(new Date('2026-10-09T18:30:00Z'), TZ), '2026-10-10');
});

test('open task due today is not overdue; due yesterday is', () => {
  const now = new Date('2026-10-09T18:29:00Z');
  const dueToday = deriveTaskMetrics({
    status: 'in-progress', dueDate: '2026-10-09', progress: 10, estimatedHours: 8, actualHours: 1,
  }, { now, timeZone: TZ, completionStatuses: completion });
  assert.equal(dueToday.is_overdue, false);
  assert.equal(dueToday.delay_days, 0);
  assert.equal(dueToday.days_until_due, 0);

  const dueYesterday = deriveTaskMetrics({
    status: 'in-progress', dueDate: '2026-10-08', progress: 10, estimatedHours: 8, actualHours: 1,
  }, { now, timeZone: TZ, completionStatuses: completion });
  assert.equal(dueYesterday.is_overdue, true);
  assert.equal(dueYesterday.delay_days, 1);
  assert.equal(dueYesterday.days_until_due, -1);
});

test('after midnight IST the same due date becomes overdue', () => {
  const metrics = deriveTaskMetrics({
    status: 'in-progress', dueDate: '2026-10-09', progress: 0, estimatedHours: 0, actualHours: 0,
  }, { now: new Date('2026-10-09T18:30:00Z'), timeZone: TZ, completionStatuses: completion });
  assert.equal(metrics.today, '2026-10-10');
  assert.equal(metrics.is_overdue, true);
  assert.equal(metrics.delay_days, 1);
});

test('finished task uses completed_date and never returns a negative delay', () => {
  const early = deriveTaskMetrics({
    status: 'completed', dueDate: '2026-10-10', completedDate: '2026-10-08', progress: 100,
  }, { now: new Date('2026-10-20T00:00:00Z'), timeZone: TZ, completionStatuses: completion });
  assert.equal(early.is_completed, true);
  assert.equal(early.is_overdue, false);
  assert.equal(early.delay_days, 0);
  assert.equal(early.days_until_due, null);
  assert.equal(early.actual_completion_date, '2026-10-08');

  const late = deriveTaskMetrics({
    status: 'completed', dueDate: '2026-10-01', completedDate: '2026-10-05', progress: 100,
  }, { now: new Date('2026-10-20T00:00:00Z'), timeZone: TZ, completionStatuses: completion });
  assert.equal(late.delay_days, 4);
});

test('null completed_date falls back to the latest complete remark', () => {
  const metrics = deriveTaskMetrics({
    status: 'completed', dueDate: '2026-10-01', completedDate: null, completeRemarkDate: '2026-10-04', progress: 100,
  }, { now: new Date('2026-10-20T00:00:00Z'), timeZone: TZ, completionStatuses: completion });
  assert.equal(metrics.actual_completion_date, '2026-10-04');
  assert.equal(metrics.delay_days, 3);
});

test('under-review is not completed unless configured', () => {
  const open = deriveTaskMetrics({
    status: 'under-review', dueDate: '2026-01-01', progress: 90,
  }, { now: new Date('2026-10-09T12:00:00Z'), timeZone: TZ, completionStatuses: ['completed'] });
  assert.equal(open.is_completed, false);
  assert.equal(open.is_overdue, true);

  const closed = deriveTaskMetrics({
    status: 'under-review', dueDate: '2026-01-01', progress: 90,
  }, { now: new Date('2026-10-09T12:00:00Z'), timeZone: TZ, completionStatuses: ['completed', 'under-review'] });
  assert.equal(closed.is_completed, true);
  assert.equal(closed.is_overdue, false);
});

test('progress is clamped and hours are numbers', () => {
  const metrics = deriveTaskMetrics({
    status: 'in-progress', dueDate: '2026-12-01', progress: 140, estimatedHours: '8.00', actualHours: 3.5,
  }, { now: new Date('2026-10-09T12:00:00Z'), timeZone: TZ, completionStatuses: completion });
  assert.equal(metrics.progress_pct, 100);
  assert.equal(metrics.progress_raw_pct, 140);
  assert.equal(metrics.estimated_hours, 8);
  assert.equal(metrics.actual_hours, 3.5);
  assert.equal(metrics.remaining_hours, 4.5);
});

test('missing dates stay safe', () => {
  const metrics = deriveTaskMetrics({
    status: 'not-started', dueDate: null, completedDate: null, progress: null, estimatedHours: null, actualHours: null,
  }, { now: new Date('2026-10-09T12:00:00Z'), timeZone: TZ, completionStatuses: completion });
  assert.equal(metrics.is_overdue, false);
  assert.equal(metrics.delay_days, 0);
  assert.equal(metrics.days_until_due, null);
  assert.equal(metrics.actual_completion_date, null);
  assert.equal(metrics.progress_pct, 0);
  assert.equal(metrics.remaining_hours, 0);
});

test('remark html becomes plain text and list counts', () => {
  const html = '<p>Completed:</p><ul><li>One</li><li>Two</li></ul><p>Pending:</p><ul><li>Three</li></ul>';
  const plain = htmlToText(html);
  assert.equal(plain.includes('<'), false);
  assert.match(plain, /Completed:/);
  const counts = remarkListCounts(plain);
  assert.equal(counts.completed_items_count, 2);
  assert.equal(counts.pending_items_count, 1);
  assert.equal(remarkListCounts('Just a note').completed_items_count, null);
  assert.equal(htmlToText('&amp;'), '&');
  assert.equal(htmlToText('   '), null);
});
