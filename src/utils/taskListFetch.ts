/**
 * Shared task-list query building for TaskManager.
 * Main fetch and refresh/back-navigation must use the same rules or pagination breaks
 * (e.g. page 2 empty when needsAllTasks mode replaces full list with one server page).
 */

export interface TaskListQueryState {
  sortField: string;
  sortOrder: string;
  currentPage: number;
  pageSize: number;
  selectedStatus: string;
  selectedPriorities: string[];
  selectedProject: string;
  selectedStage: string;
  selectedDueDate: string;
  selectedTeam: string;
  selectedAssignees: string[];
  dateRangeStart: string;
  dateRangeEnd: string;
  debouncedSearch: string;
  onlyOverdue: boolean;
}

export function computeNeedsAllTasks(state: TaskListQueryState): boolean {
  const hasDateRange = !!state.dateRangeStart || !!state.dateRangeEnd;
  return (
    state.selectedStatus === 'overdue' ||
    state.selectedStatus === 'active' ||
    state.selectedPriorities.length > 0 ||
    state.selectedStage !== 'all' ||
    state.selectedDueDate !== 'all' ||
    state.selectedTeam !== 'all' ||
    state.selectedAssignees.length > 0 ||
    hasDateRange ||
    !!state.debouncedSearch ||
    state.onlyOverdue
  );
}

export function buildTaskListFetchParams(
  state: TaskListQueryState
): { params: Record<string, string | number>; needsAllTasks: boolean } {
  const needsAllTasks = computeNeedsAllTasks(state);
  const params: Record<string, string | number> = {
    sort: state.sortField,
    order: state.sortOrder,
  };

  if (!needsAllTasks) {
    params.page = state.currentPage;
    params.limit = state.pageSize;
  } else {
    params.all = 'true';
  }

  if (
    state.selectedStatus !== 'all' &&
    state.selectedStatus !== 'overdue' &&
    state.selectedStatus !== 'active'
  ) {
    params.status = state.selectedStatus;
  }
  if (state.selectedPriorities.length === 1) {
    params.priority = state.selectedPriorities[0];
  } else if (state.selectedPriorities.length > 1) {
    params.priorityIn = state.selectedPriorities.join(',');
  }
  if (state.selectedStage !== 'all') {
    params.stage_id = state.selectedStage;
  } else if (state.selectedProject !== 'all') {
    params.project_id = state.selectedProject;
  }
  if (state.selectedDueDate !== 'all') {
    params.due_date = state.selectedDueDate;
  }
  if (state.selectedTeam !== 'all') {
    params.team_id = state.selectedTeam;
  }
  if (state.selectedAssignees.length === 1 && state.selectedAssignees[0] === 'none') {
    params.assignee_id = 'none';
  } else if (state.selectedAssignees.length === 1) {
    params.assignee_id = state.selectedAssignees[0];
  } else if (state.selectedAssignees.length > 1) {
    params.assigneeIdIn = state.selectedAssignees.join(',');
  }
  if (state.dateRangeStart) params.dateRangeStart = state.dateRangeStart;
  if (state.dateRangeEnd) params.dateRangeEnd = state.dateRangeEnd;
  if (state.debouncedSearch) params.search = state.debouncedSearch;

  return { params, needsAllTasks };
}

export function applyTaskListResponse(
  tasksResponse: { data?: any[]; pagination?: { total?: number; pages?: number } } | any[] | null | undefined,
  needsAllTasks: boolean,
  pageSize: number
): { tasks: any[]; totalTasks: number; totalPages: number } {
  const data = Array.isArray(tasksResponse)
    ? tasksResponse
    : tasksResponse?.data ?? [];

  if (needsAllTasks) {
    return {
      tasks: data,
      totalTasks: data.length,
      totalPages: Math.max(1, Math.ceil(data.length / pageSize)),
    };
  }

  return {
    tasks: data,
    totalTasks: tasksResponse?.pagination?.total ?? data.length,
    totalPages: tasksResponse?.pagination?.pages ?? 1,
  };
}
