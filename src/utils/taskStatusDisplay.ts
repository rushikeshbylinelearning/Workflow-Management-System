import type { TaskStatus } from '../types';
import { normalizeTaskStatus } from './reworkHighlight';

const STATUS_LABELS: Record<string, string> = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  'under-review': 'Under Review',
  completed: 'Completed',
  blocked: 'Blocked',
  'on-hold': 'On Hold',
  skipped: 'Skipped',
  /** Admin returned submitted work — assignee must resubmit */
  returned: 'Returned for Rework',
  'redo-requested': 'Returned for Rework',
  /** Assignee resubmitted; awaiting admin review (legacy/alternate status) */
  resubmitted: 'Under Review',
};

export function getTaskStatusLabel(status?: string): string {
  const key = normalizeTaskStatus(status);
  if (STATUS_LABELS[key]) return STATUS_LABELS[key];
  if (!key) return 'Unknown';
  return key
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function getTaskStatusBadgeVariant(
  status?: string
): 'default' | 'primary' | 'warning' | 'success' | 'danger' | 'secondary' {
  switch (normalizeTaskStatus(status)) {
    case 'in-progress':
      return 'primary';
    case 'under-review':
      return 'warning';
    case 'completed':
      return 'success';
    case 'blocked':
      return 'danger';
    case 'on-hold':
      return 'secondary';
    case 'returned':
    case 'redo-requested':
    case 'resubmitted':
      return 'warning';
    default:
      return 'default';
  }
}

export function isResubmissionWorkflowStatus(status?: string): boolean {
  const s = normalizeTaskStatus(status);
  return s === 'returned' || s === 'redo-requested' || s === 'resubmitted';
}
