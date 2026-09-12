import type { TaskFilters } from '../components/TaskSearchFilters';

const STORAGE_KEY = 'admin_task_manager_state';

export interface PersistedTaskManagerState {
  filters: TaskFilters;
  currentPage: number;
  pageSize: number;
  sortField: string;
  sortOrder: string;
  onlyOverdue: boolean;
}

const DEFAULT_FILTERS: TaskFilters = {
  search: '',
  status: 'all',
  priorities: [],
  project: 'all',
  stage: 'all',
  dueDate: 'all',
  team: 'all',
  assignees: [],
  dateRangeStart: '',
  dateRangeEnd: '',
  gradeId: '',
  bookId: '',
  unitId: '',
  lessonId: '',
};

function isValidFilters(value: unknown): value is TaskFilters {
  if (!value || typeof value !== 'object') return false;
  const f = value as TaskFilters;
  return (
    typeof f.search === 'string' &&
    typeof f.status === 'string' &&
    Array.isArray(f.priorities) &&
    typeof f.project === 'string' &&
    typeof f.stage === 'string' &&
    typeof f.dueDate === 'string' &&
    typeof f.team === 'string' &&
    Array.isArray(f.assignees)
  );
}

export function loadTaskManagerState(): PersistedTaskManagerState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedTaskManagerState>;
    if (!parsed.filters || !isValidFilters(parsed.filters)) return null;
    return {
      filters: {
        ...DEFAULT_FILTERS,
        ...parsed.filters,
        team: parsed.filters.team ?? 'all',
        dateRangeStart: parsed.filters.dateRangeStart ?? '',
        dateRangeEnd: parsed.filters.dateRangeEnd ?? '',
        gradeId: parsed.filters.gradeId ?? '',
        bookId: parsed.filters.bookId ?? '',
        unitId: parsed.filters.unitId ?? '',
        lessonId: parsed.filters.lessonId ?? '',
      },
      currentPage: typeof parsed.currentPage === 'number' && parsed.currentPage >= 1 ? parsed.currentPage : 1,
      pageSize: typeof parsed.pageSize === 'number' && parsed.pageSize >= 1 ? parsed.pageSize : 10,
      sortField: typeof parsed.sortField === 'string' ? parsed.sortField : 'created_at',
      sortOrder: parsed.sortOrder === 'asc' || parsed.sortOrder === 'desc' ? parsed.sortOrder : 'desc',
      onlyOverdue: !!parsed.onlyOverdue,
    };
  } catch {
    return null;
  }
}

export function saveTaskManagerState(state: PersistedTaskManagerState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / private mode errors
  }
}
