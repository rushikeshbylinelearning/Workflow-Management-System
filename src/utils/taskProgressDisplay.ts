import { calculateTaskProgress } from './progressCalculator';

import { normalizeTaskStatus } from './reworkHighlight';



/** Prefer stored progress from API when status-based calc would under-report (e.g. returned @ 50%). */

export function getTaskDisplayProgress(task: { status?: string; progress?: number }): number {

  const status = normalizeTaskStatus(task.status);

  const fromStatus = calculateTaskProgress(status);

  const stored = Number(task.progress);



  // Submitted for review — never show stale 50% left from a prior "returned" state

  if (status === 'under-review') {

    const storedRounded = Number.isFinite(stored) ? Math.round(stored) : 0;

    return Math.max(fromStatus, storedRounded);

  }



  if (Number.isFinite(stored) && stored > 0) {

    return Math.max(fromStatus, Math.min(100, Math.round(stored)));

  }

  return fromStatus;

}

