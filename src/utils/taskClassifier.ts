/**
 * Centralized task classification utility.
 *
 * All Kanban bucket logic lives here so the dashboard and
 * any future views share exactly one source of truth.
 *
 * BUSINESS RULES (authoritative):
 * ─────────────────────────────────────────────────────────
 * UNDER_REVIEW  → status is "under-review" OR "resubmitted"
 *                 (submitted by assignee, waiting PM/Admin approval)
 *                 Checked FIRST — a submitted task is NEVER overdue.
 *
 *   • "under-review"  = first-time submission by the assignee
 *   • "resubmitted"   = re-submission after admin returned the task for rework
 *
 * ACTIVE        → status in {not-started, in-progress, assigned, reopened,
 *                             blocked}
 *                 AND end_date >= today  (or no end_date)
 *
 * OVERDUE       → end_date < today
 *                 AND status NOT IN {under-review, resubmitted, completed, skipped, on-hold}
 *                 AND NOT a rework-returned active rework task
 *
 * COMPLETED     → status === "completed"
 *
 * UPCOMING      → start_date > today  (task has not yet started)
 *                 Shown as a separate horizontal strip below the board.
 *
 * ON_HOLD / REWORK are retained for backward-compatible callers but are
 * not surfaced as separate Kanban columns.
 * ─────────────────────────────────────────────────────────
 */

import type { Task } from '../types';
import { getTaskReworkCount, isOnHoldTask, normalizeTaskStatus } from './reworkHighlight';

export type KanbanBucket =
  | 'ACTIVE'
  | 'ALL_TASKS'
  | 'OVERDUE'
  | 'UNDER_REVIEW'
  | 'COMPLETED'
  | 'UPCOMING'
  | 'ON_HOLD'
  | 'REWORK';

/** Status values that belong in the "Under Review / Submitted" bucket.
 *  - "under-review"  = first-time submission by the assignee (pending admin/PM approval)
 *  - "resubmitted"   = re-submitted after being returned for rework
 *  Both are pending on the ADMIN/PM side, NOT on the assignee's side.
 *  These tasks must NEVER appear in Overdue or Active columns. */
const SUBMITTED_STATUSES = new Set(['under-review', 'resubmitted']);

/** Status values that are considered "active" regardless of dates.
 *  Note: 'under-review' and 'resubmitted' are intentionally excluded —
 *  those go to UNDER_REVIEW bucket (submitted, pending admin approval). */
const ACTIVE_STATUSES = new Set([
  'not-started',
  'in-progress',
  'assigned',
  'reopened',
  'returned',
  'redo-requested',
  'blocked',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Date helpers (IST-safe: compare YYYY-MM-DD strings without timezone shift)
// ─────────────────────────────────────────────────────────────────────────────

/** Returns today as "YYYY-MM-DD" in local time. */
export function getTodayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse a date-only string or Date into a comparable "YYYY-MM-DD" string. */
function toDateString(raw: string | Date | undefined | null): string | null {
  if (!raw) return null;
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Returns true if the task's due date (end_date) is strictly before today. */
export function isTaskOverdue(task: Task): boolean {
  const endDate = toDateString(task.end_date);
  if (!endDate) return false;
  const today = getTodayString();
  return endDate < today;
}

/** Returns true if the task's start date is strictly after today. */
export function isTaskUpcoming(task: Task): boolean {
  const startDate = toDateString(task.start_date);
  if (!startDate) return false;
  const today = getTodayString();
  return startDate > today;
}

/**
 * Returns the number of calendar days until the task's due date.
 * Negative = overdue, 0 = due today.
 */
export function getDaysUntilDue(task: Task): number | null {
  const endDate = toDateString(task.end_date);
  if (!endDate) return null;
  const today = getTodayString();
  const msPerDay = 86_400_000;
  const diff =
    new Date(endDate).setHours(0, 0, 0, 0) -
    new Date(today).setHours(0, 0, 0, 0);
  return Math.round(diff / msPerDay);
}

/**
 * Returns the number of calendar days since the task's start date.
 * e.g. "Starts in 3 days".
 */
export function getDaysUntilStart(task: Task): number | null {
  const startDate = toDateString(task.start_date);
  if (!startDate) return null;
  const today = getTodayString();
  const msPerDay = 86_400_000;
  const diff =
    new Date(startDate).setHours(0, 0, 0, 0) -
    new Date(today).setHours(0, 0, 0, 0);
  return Math.round(diff / msPerDay);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main classifier
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classify a single task into one Kanban bucket.
 *
 * Call order matters — UNDER_REVIEW is checked before OVERDUE so that
 * submitted tasks (under-review / resubmitted) are never classified as overdue.
 */
export function classifyTask(task: Task): KanbanBucket {
  const status = normalizeTaskStatus(task.status);

  // 1. Completed
  if (status === 'completed') return 'COMPLETED';

  // 2. On-hold — separate bucket (not shown as a Kanban column)
  if (isOnHoldTask(task)) return 'ON_HOLD';

  // 3. Under Review — submitted tasks waiting for PM/Admin approval.
  //    Covers BOTH first-time submissions ('under-review') and re-submissions
  //    after rework ('resubmitted').
  //    MUST be checked before overdue so submitted tasks never appear there.
  if (SUBMITTED_STATUSES.has(status)) return 'UNDER_REVIEW';

  // 4. Returned for Rework — admin/PM sent the task back for corrections
  //    Includes: returned, redo-requested (with OR without rework_count)
  if (status === 'returned' || status === 'redo-requested') {
    return 'REWORK';
  }

  // 5. Upcoming — start_date is in the future (task hasn't started yet)
  if (isTaskUpcoming(task)) return 'UPCOMING';

  // 6. Overdue — past due AND none of the "safe" statuses
  if (isTaskOverdue(task)) return 'OVERDUE';

  // 7. Active — all remaining non-terminal statuses
  if (ACTIVE_STATUSES.has(status)) return 'ACTIVE';

  // Fallback
  return 'ACTIVE';
}

// ─────────────────────────────────────────────────────────────────────────────
// Bucket filters (convenience wrappers used by the Kanban view)
// ─────────────────────────────────────────────────────────────────────────────

export function getActiveTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => classifyTask(t) === 'ACTIVE');
}

export function getReworkTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => classifyTask(t) === 'REWORK');
}

export function getOverdueTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => classifyTask(t) === 'OVERDUE');
}

export function getUnderReviewTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => classifyTask(t) === 'UNDER_REVIEW');
}

export function getCompletedTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => classifyTask(t) === 'COMPLETED');
}

export function getUpcomingTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => classifyTask(t) === 'UPCOMING');
}

export function getOnHoldTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => classifyTask(t) === 'ON_HOLD');
}
