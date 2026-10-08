/**
 * Shared helpers for the Bulk Add Remark modal.
 *
 * Stage maps to the existing single-task Add Remark "Remark Type" dropdown
 * (General / In Progress, Completed, Skipped, Other) because that is the
 * field that writes Stage/status/progress via the remark append path.
 */

// Max tasks that can be selected for bulk add remark in one submit.
export const MAX_BULK_ROWS = 50;
export const MAX_BULK_ROWS_ADMIN = 100;

export function getBulkSelectionLimit(isAdminSide: boolean): number {
  return isAdminSide ? MAX_BULK_ROWS_ADMIN : MAX_BULK_ROWS;
}

export const SYSTEM_REMARK_OPTIONS: Array<{ value: string; label: string; statusEffect?: string; isSystem?: boolean }> = [
  { value: 'general', label: 'General / In Progress', statusEffect: 'in-progress', isSystem: true },
  { value: 'complete', label: 'Completed', statusEffect: 'under-review', isSystem: true },
  { value: 'skipped', label: 'Skipped', statusEffect: 'skipped', isSystem: true },
  { value: 'other', label: 'Other', statusEffect: 'none', isSystem: true },
];

export const BULK_REMARK_STAGE_OPTIONS = SYSTEM_REMARK_OPTIONS;

export const EDITABLE_BULK_REMARK_COLUMNS = ['stage', 'fileLocation', 'fileName', 'remark'] as const;
export type BulkRemarkEditableColumn = string;

export function getBulkRemarkEditableColumns(extraSlugs: string[] = []): string[] {
  return ['stage', 'fileLocation', 'fileName', ...extraSlugs, 'remark'];
}

function asTagText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'object' && (value as { type?: string; data?: number[] }).type === 'Buffer') {
    const data = (value as { data?: number[] }).data;
    if (Array.isArray(data)) {
      try {
        return String.fromCharCode(...data).trim();
      } catch {
        return '';
      }
    }
  }
  return '';
}

export function formatTaskTags(task: {
  tags?: unknown;
  component_path?: unknown;
  componentPath?: unknown;
  grade_name?: unknown;
  gradeName?: unknown;
  book_name?: unknown;
  bookName?: unknown;
  unit_name?: unknown;
  unitName?: unknown;
  lesson_name?: unknown;
  lessonName?: unknown;
} | null | undefined): string {
  if (!task) return '';
  const direct = asTagText(task.tags) || asTagText(task.component_path) || asTagText(task.componentPath);
  if (direct) return direct;
  return [
    task.grade_name ?? task.gradeName,
    task.book_name ?? task.bookName,
    task.unit_name ?? task.unitName,
    task.lesson_name ?? task.lessonName,
  ]
    .map((part) => asTagText(part))
    .filter(Boolean)
    .join(' > ');
}

export function statusToRemarkStage(status?: string): string {
  const key = String(status || '').toLowerCase();
  if (key === 'skipped') return 'skipped';
  if (key === 'completed' || key === 'under-review' || key === 'resubmitted') return 'complete';
  return 'general';
}

export function remarkStatusEffect(
  value: string,
  options: Array<{ value: string; statusEffect?: string }> = SYSTEM_REMARK_OPTIONS
): string {
  return options.find((option) => option.value === value)?.statusEffect
    || SYSTEM_REMARK_OPTIONS.find((option) => option.value === value)?.statusEffect
    || 'none';
}

export function remarkStageLabel(
  value?: string,
  options: Array<{ value: string; label: string }> = SYSTEM_REMARK_OPTIONS
): string {
  const key = String(value || '').trim().toLowerCase();
  const match = options.find((option) => option.value.toLowerCase() === key);
  return match?.label || SYSTEM_REMARK_OPTIONS.find((option) => option.value === key)?.label || value || '—';
}

export function matchRemarkStage(
  pasted: string,
  options: Array<{ value: string; label: string }> = SYSTEM_REMARK_OPTIONS
): string | null {
  const normalized = pasted.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  if (!normalized) return null;
  const aliases: Record<string, string> = {
    general: 'general',
    'in progress': 'general',
    'general / in progress': 'general',
    'general/in progress': 'general',
    complete: 'complete',
    completed: 'complete',
    skipped: 'skipped',
    skip: 'skipped',
    other: 'other',
  };
  if (aliases[normalized]) return aliases[normalized];
  const catalog = options.length > 0 ? options : SYSTEM_REMARK_OPTIONS;
  const match = catalog.find((option) => (
    option.value.toLowerCase() === normalized
    || option.label.toLowerCase() === normalized
    || option.label.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ') === normalized
  ));
  return match ? match.value : null;
}

export function parseClipboardGrid(text: string): string[][] {
  const raw = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = raw.split('\n');
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines.map((line) => line.split('\t'));
}

export function applyPasteGrid<T extends { taskId?: string | number; extra?: Record<string, string> }>(
  rows: T[],
  startRow: number,
  startCol: string,
  grid: string[][],
  stageOptions: Array<{ value: string; label: string }> = SYSTEM_REMARK_OPTIONS,
  extraSlugs: string[] = []
): { rows: T[]; invalidStageCells: Set<string>; validStageCells: Set<string> } {
  const next = rows.map((row) => ({ ...row, extra: { ...(row.extra || {}) } }));
  const invalidStageCells = new Set<string>();
  const validStageCells = new Set<string>();
  const columns = getBulkRemarkEditableColumns(extraSlugs);
  const startColIndex = columns.indexOf(startCol);
  if (startColIndex < 0) return { rows: next, invalidStageCells, validStageCells };

  for (let r = 0; r < grid.length; r += 1) {
    const targetRow = startRow + r;
    if (targetRow >= next.length) break;
    const pastedRow = grid[r] || [];
    for (let c = 0; c < pastedRow.length; c += 1) {
      const targetColIndex = startColIndex + c;
      if (targetColIndex >= columns.length) break;
      const column = columns[targetColIndex];
      const pastedValue = pastedRow[c] ?? '';
      if (column === 'stage') {
        const matched = matchRemarkStage(pastedValue, stageOptions);
        const cellKey = String(next[targetRow].taskId ?? targetRow);
        if (matched) {
          next[targetRow] = { ...next[targetRow], stage: matched };
          validStageCells.add(cellKey);
        } else if (pastedValue.trim()) {
          invalidStageCells.add(cellKey);
        }
      } else if (extraSlugs.includes(column)) {
        next[targetRow] = {
          ...next[targetRow],
          extra: { ...(next[targetRow].extra || {}), [column]: pastedValue },
        };
      } else {
        next[targetRow] = { ...next[targetRow], [column]: pastedValue };
      }
    }
  }

  return { rows: next, invalidStageCells, validStageCells };
}
