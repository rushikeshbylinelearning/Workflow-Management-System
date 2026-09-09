import type { Task } from '../types';

export type ReworkSeverity = 'yellow' | 'orange' | 'red';

/** Statuses where a returned task stays in Active Tasks (not Overdue section). */
export const REWORK_ACTIVE_STATUSES = new Set([
  'in-progress',
  'returned',
  'redo-requested',
  'resubmitted',
  'under-review', // included for backwards compatibility
]);

/** Active task statuses for dashboard list view.
 *  Note: 'under-review' and 'resubmitted' are submitted tasks and should
 *  technically go to "Under Review", but this set is used by legacy list
 *  views that may still rely on it. The Kanban view uses taskClassifier.ts
 *  which properly separates submitted tasks. */
export const ACTIVE_TASK_STATUSES = new Set([
  'not-started',
  'in-progress',
  'under-review',
  'blocked',
  'on-hold',
  'returned',
  'redo-requested',
  'resubmitted',
]);

export function isOnHoldTask(task: Pick<Task, 'status'> | { status?: string }): boolean {
  return normalizeTaskStatus(task.status) === 'on-hold';
}

export function isReworkHighlightEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_REWORK_HIGHLIGHT !== 'false';
}

export function normalizeTaskStatus(status?: string): string {
  return (status || '').toLowerCase().replace(/_/g, '-');
}

export function getTaskReworkCount(task: Task): number {
  const raw = task.reworkCount ?? (task as Task & { rework_count?: number }).rework_count;
  const count = Number(raw);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

export function isReworkActiveStatus(status?: string): boolean {
  return REWORK_ACTIVE_STATUSES.has(normalizeTaskStatus(status));
}

/** Active Tasks bucket — returned/rework tasks never use Overdue bucket. */
export function isActiveTaskForDashboard(task: Task): boolean {
  const status = normalizeTaskStatus(task.status);
  const rework = getTaskReworkCount(task);
  if (rework > 0 && isReworkActiveStatus(status)) return true;
  return ACTIVE_TASK_STATUSES.has(status);
}

/** Overdue sidebar: informational only; exclude submitted, rework-returned and on-hold tasks. */
export function belongsInOverdueSection(task: Task, isOverdue: (t: Task) => boolean): boolean {
  if (isOnHoldTask(task)) return false;
  const status = normalizeTaskStatus(task.status);
  // Submitted tasks (pending admin/PM approval) must never appear in overdue
  if (status === 'under-review' || status === 'resubmitted') return false;
  if (getTaskReworkCount(task) > 0 && isReworkActiveStatus(task.status)) return false;
  return isOverdue(task) && (task.progress ?? 0) > 0;
}

export function getTaskReworkSeverity(task: Task): ReworkSeverity | null {
  const count = getTaskReworkCount(task);
  if (count <= 0) return null;
  if (task.reworkSeverity === 'yellow' || task.reworkSeverity === 'orange' || task.reworkSeverity === 'red') {
    return task.reworkSeverity;
  }
  if (count >= 3) return 'red';
  if (count === 2) return 'orange';
  return 'yellow';
}

export function getReworkCardClass(count: number): string | null {
  if (count >= 3) return 'task-card--rework-red';
  if (count === 2) return 'task-card--rework-orange';
  if (count === 1) return 'task-card--rework-yellow';
  return null;
}

/** Table row variant for admin task list (same palette as assignee cards). */
export function getReworkRowClass(count: number): string | null {
  if (count >= 3) return 'task-row--rework-red';
  if (count === 2) return 'task-row--rework-orange';
  if (count === 1) return 'task-row--rework-yellow';
  return null;
}

export function getReworkReviewSubLabel(count: number): string {
  if (count >= 3) return '3rd+ Review';
  if (count === 2) return '2nd Review';
  return '1st Review';
}

export function getReworkSortRank(task: Task, isOverdue: (t: Task) => boolean): number {
  if (isOnHoldTask(task)) return 6;
  const count = getTaskReworkCount(task);
  if (count >= 3) return 1;
  if (count === 2) return 2;
  if (count === 1) return 3;
  if (isOverdue(task)) return 4;
  return 5;
}

/** Sort: red → orange → yellow → overdue → normal, then updated_at DESC. */
export function compareActiveTasksForDisplay(
  a: Task,
  b: Task,
  isOverdue: (t: Task) => boolean,
  secondaryCompare: (a: Task, b: Task) => number
): number {
  const rankA = getReworkSortRank(a, isOverdue);
  const rankB = getReworkSortRank(b, isOverdue);
  if (rankA !== rankB) return rankA - rankB;

  const aUpdated = a.updated_at ? new Date(a.updated_at).getTime() : 0;
  const bUpdated = b.updated_at ? new Date(b.updated_at).getTime() : 0;
  if (aUpdated !== bUpdated) return bUpdated - aUpdated;

  return secondaryCompare(a, b);
}
