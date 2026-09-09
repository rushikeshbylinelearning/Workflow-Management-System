import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import {
  Plus,
  CheckSquare,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Edit2,
  Trash2,
  Eye,
  Upload,
  RotateCcw,
  LayoutGrid,
  List as ListIcon,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { Task, TaskStatus, Priority } from '../types';
import type { FilterOptions } from '../types';
import { calculateTaskProgress } from '../utils/progressCalculator';
import { getTaskDisplayProgress } from '../utils/taskProgressDisplay';
import { getTaskStatusBadgeVariant, getTaskStatusLabel, isResubmissionWorkflowStatus, pickTaskUpdateStatus } from '../utils/taskStatusDisplay';
import {
  getTaskReworkCount,
  getReworkReviewSubLabel,
  getReworkRowClass,
  isActiveTaskForDashboard,
  isReworkActiveStatus,
  isReworkHighlightEnabled,
} from '../utils/reworkHighlight';
import { taskService, stageService, teamService, projectService, teamProjectService, skillService, gradeService, bookService, unitService, lessonService } from '../services/apiService';
import { TaskSearchFilters, TaskFilters } from './TaskSearchFilters';
import { BulkUploadModal } from './BulkUploadModal';
import { BulkTaskSelectionActions } from './BulkTaskSelectionActions';
import { TaskExportButton } from './TaskExportButton';
import { FlagEmployeeModal } from './modals/FlagEmployeeModal';
import { Flag } from 'lucide-react';
import { loadTaskManagerState, saveTaskManagerState } from '../utils/taskFilterPersistence';
import { KanbanSkeleton } from './KanbanSkeleton';
import { TaskStatSkeletonGrid } from './ui/TaskStatSkeleton';
import { useDashboardSummary, invalidateSummaryCache } from '../hooks/useDashboardSummary';
import type { SummaryFilterParams } from '../hooks/useDashboardSummary';
import {
  getTaskManagerReferenceCache,
  setTaskManagerReferenceCache,
  isTasksSessionInitialized,
  markTasksSessionInitialized,
  buildTaskStatsCacheKey,
  TASKS_LIST_REFRESH_EVENT,
} from '../utils/taskManagerCache';
import {
  buildTaskListFetchParams,
  applyTaskListResponse,
  computeNeedsAllTasks,
  type TaskListQueryState,
} from '../utils/taskListFetch';

// Lazy-load AdminKanbanView — only bundled when the user switches to Kanban view
const AdminKanbanView = lazy(() =>
  import('./AdminKanbanView').then((m) => ({ default: m.AdminKanbanView }))
);

const referenceCacheOnMount = getTaskManagerReferenceCache('');
const sessionAlreadyInitialized = isTasksSessionInitialized();

const EMPTY_TASK_FILTERS: TaskFilters = {
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
};

/** Stable empty array for filter deps — avoid `?? []` creating new refs each render */
const EMPTY_STRING_ARRAY: string[] = [];

type TaskStatCardConfig = {
  key: string;
  label: string;
  value: number;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  accent: string;
  active?: boolean;
  onClick?: () => void;
};

function TaskStatCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  accent,
  active,
  onClick,
}: Omit<TaskStatCardConfig, 'key' | 'value'> & { value: number }) {
  // Derive a ring color from the accent bar color for active state
  const activeRingClass = accent.includes('red')
    ? 'ring-2 ring-red-400/70 border-red-200 shadow-md'
    : accent.includes('blue')
    ? 'ring-2 ring-blue-400/70 border-blue-200 shadow-md'
    : accent.includes('emerald')
    ? 'ring-2 ring-emerald-400/70 border-emerald-200 shadow-md'
    : accent.includes('amber')
    ? 'ring-2 ring-amber-400/70 border-amber-200 shadow-md'
    : accent.includes('yellow')
    ? 'ring-2 ring-yellow-400/70 border-yellow-200 shadow-md'
    : accent.includes('slate')
    ? 'ring-2 ring-slate-400/70 border-slate-200 shadow-md'
    : 'ring-2 ring-indigo-400/70 border-indigo-200 shadow-md';

  const className = [
    'relative w-full rounded-xl border bg-white p-4 sm:p-5 text-left',
    'shadow-sm transition-[box-shadow,transform,border-color] duration-200 ease-out',
    onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:translate-y-0' : 'hover:shadow-md',
    active ? activeRingClass : 'border-gray-200/90',
  ].join(' ');

  const content = (
    <>
      <div className={`absolute inset-x-0 top-0 h-1 rounded-t-xl ${accent}`} aria-hidden />
      <div className="flex flex-col gap-3 pt-1">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-medium text-gray-500 leading-snug">{label}</p>
          <p className="mt-1 text-2xl sm:text-[1.75rem] font-bold text-gray-900 tabular-nums tracking-tight leading-none">
            {value.toLocaleString()}
          </p>
        </div>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className} title={`Filter by ${label}`}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

function getInitialTaskListUi(
  persisted: ReturnType<typeof loadTaskManagerState>,
  navFilters: FilterOptions
) {
  if (navFilters?.activeOnly) {
    const memberId = navFilters.teamMembers?.[0];
    return {
      filters: {
        ...EMPTY_TASK_FILTERS,
        status: 'active',
        assignees: memberId ? [String(memberId)] : [],
      },
      currentPage: 1,
      onlyOverdue: false,
    };
  }
  return {
    filters: persisted?.filters ?? EMPTY_TASK_FILTERS,
    currentPage: persisted?.currentPage ?? 1,
    onlyOverdue: persisted?.onlyOverdue ?? false,
  };
}

export function TaskManager() {
  const { state, dispatch } = useApp();
  const { user } = useAuth();
  const { isProjectManager, accessInfo } = usePermissions();
  const isAdminUser = !!user;
  const canManageTasks = isAdminUser || isProjectManager;

  const statsCacheKey = useMemo(() => {
    if (user?.id) return buildTaskStatsCacheKey({ adminUserId: user.id });
    try {
      const teamUserData = sessionStorage.getItem('teamUserData');
      if (teamUserData) {
        const parsed = JSON.parse(teamUserData);
        if (parsed?.id) return buildTaskStatsCacheKey({ teamMemberId: parsed.id });
      }
    } catch {
      // ignore invalid session data
    }
    if (accessInfo?.id) return buildTaskStatsCacheKey({ teamMemberId: accessInfo.id });
    return buildTaskStatsCacheKey({});
  }, [user?.id, accessInfo?.id]);
  const persistedState = useRef(loadTaskManagerState()).current;
  const initialUi = useRef(getInitialTaskListUi(persistedState, state.filters)).current;

  const sanitizeAssigneeFilters = (f: TaskFilters): TaskFilters => ({
    ...f,
    team: 'all',
    assignees: [],
  });

  // Employees / assignees only see their own tasks — strip admin-only filters from persisted state
  useEffect(() => {
    if (!isAdminUser) {
      setFilters((prev) => {
        const needsUpdate = (prev.assignees?.length ?? 0) > 0 || (prev.team ?? 'all') !== 'all';
        if (!needsUpdate) return prev;
        return sanitizeAssigneeFilters(prev);
      });
    }
  }, [isAdminUser]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Check if user is logged in (either admin or team member)
  const isAuthenticated = () => {
    if (user) return true;
    const teamToken = sessionStorage.getItem('teamToken');
    const teamUserData = sessionStorage.getItem('teamUserData');
    return !!(teamToken && teamUserData);
  };
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // View toggle: list (default) vs kanban
  const [taskView, setTaskView] = useState<'list' | 'kanban'>(() => {
    try {
      const saved = sessionStorage.getItem('admin_task_view');
      return saved === 'kanban' ? 'kanban' : 'list';
    } catch {
      return 'list';
    }
  });

  const handleSetTaskView = useCallback((view: 'list' | 'kanban') => {
    setTaskView(view);
    try {
      sessionStorage.setItem('admin_task_view', view);
    } catch {
      // ignore
    }
  }, []);

  // Unified filter state (search is debounced inside TaskSearchFilters)
  const [filters, setFilters] = useState<TaskFilters>(() =>
    isAdminUser ? initialUi.filters : sanitizeAssigneeFilters(initialUi.filters)
  );
  // TaskSearchFilters already debounces 300ms before calling onFiltersChange,
  // so filters.search is already the debounced value — use it directly.
  const debouncedSearch = filters.search;
  // Destructure filters for use throughout component
  const selectedStatus = filters.status;
  const selectedPriorities = filters.priorities ?? EMPTY_STRING_ARRAY;
  const selectedProject = filters.project;
  const selectedStage = filters.stage;
  const selectedDueDate = filters.dueDate;
  const selectedTeam = isAdminUser ? (filters.team ?? 'all') : 'all';
  const selectedAssignees = isAdminUser ? (filters.assignees ?? EMPTY_STRING_ARRAY) : EMPTY_STRING_ARRAY;
  const dateRangeStart = filters.dateRangeStart ?? '';
  const dateRangeEnd = filters.dateRangeEnd ?? '';
  const hasDateRange = !!dateRangeStart || !!dateRangeEnd;

  const setSelectedStage = (v: string) => setFilters(prev => ({ ...prev, stage: v }));
  const [showDebugInfo] = useState<boolean>(false);
  const [sortField, setSortField] = useState<string>(persistedState?.sortField ?? 'created_at');
  const [sortOrder, setSortOrder] = useState<string>(persistedState?.sortOrder ?? 'desc');
  const [tasks, setTasks] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>(referenceCacheOnMount?.teamMembers ?? []);
  const [teams, setTeams] = useState<any[]>(referenceCacheOnMount?.teams ?? []);
  const [stages, setStages] = useState<any[]>(referenceCacheOnMount?.stages ?? []);
  const [projectStages, setProjectStages] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>(referenceCacheOnMount?.projects ?? []);
  const [skills, setSkills] = useState<any[]>(referenceCacheOnMount?.skills ?? []);
  const [grades, setGrades] = useState<any[]>(referenceCacheOnMount?.grades ?? []);
  const [books, setBooks] = useState<any[]>(referenceCacheOnMount?.books ?? []);
  const [units, setUnits] = useState<any[]>(referenceCacheOnMount?.units ?? []);
  const [lessons, setLessons] = useState<any[]>(referenceCacheOnMount?.lessons ?? []);
  const [loading, setLoading] = useState(!sessionAlreadyInitialized);
  const [error, setError] = useState<string | null>(null);
  const [onlyOverdue, setOnlyOverdue] = useState(initialUi.onlyOverdue);
  // Active stat filter: when a KPI card is clicked, filter the list to show only matching tasks
  const [activeStatFilter, setActiveStatFilter] = useState<'total' | 'inProgress' | 'completed' | 'notStarted' | 'underReview' | 'overdue' | null>(null);
  // Loading state for project-specific stages in top-level filters
  const [loadingProjectStages, setLoadingProjectStages] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(initialUi.currentPage);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTasks, setTotalTasks] = useState(0);
  const [pageSize, setPageSize] = useState(persistedState?.pageSize ?? 10);

  // ─── Dashboard Summary (replaces allTasks loop) ────────────────────────────
  // Build filter params for the summary endpoint — mirrors what the table sends,
  // but omits status/priority/activeStatFilter so the KPI cards always show
  // global counts for the current project/team/assignee scope.
  const summaryFilterParams = useMemo((): SummaryFilterParams => {
    const p: SummaryFilterParams = {};
    if (selectedProject && selectedProject !== 'all') p.project_id = selectedProject;
    if (selectedTeam && selectedTeam !== 'all') p.team_id = selectedTeam;
    if (selectedAssignees.length === 1) p.assignee_id = selectedAssignees[0];
    else if (selectedAssignees.length > 1) p.assigneeIdIn = selectedAssignees.join(',');
    if (selectedStage && selectedStage !== 'all') p.stage_id = selectedStage;
    if (dateRangeStart) p.dateRangeStart = dateRangeStart;
    if (dateRangeEnd) p.dateRangeEnd = dateRangeEnd;
    if (debouncedSearch) p.search = debouncedSearch;
    return p;
  }, [selectedProject, selectedTeam, selectedAssignees, selectedStage, dateRangeStart, dateRangeEnd, debouncedSearch]);

  const {
    summary: dashboardSummary,
    loading: summaryLoading,
    refresh: refreshSummary,
  } = useDashboardSummary(isAuthenticated() ? summaryFilterParams : {});

  // Kanban view — full unfiltered (by page) dataset matching current filters
  const [kanbanTasks, setKanbanTasks] = useState<any[]>([]);
  const [kanbanLoading, setKanbanLoading] = useState(false);
  const kanbanFetchGenRef = useRef(0);
  
  // Task selection state for bulk operations
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flaggingMember, setFlaggingMember] = useState<{ id: number; name: string; taskId?: number; taskName?: string } | null>(null);

  const taskListQueryState: TaskListQueryState = useMemo(
    () => ({
      sortField,
      sortOrder,
      currentPage,
      pageSize,
      selectedStatus,
      selectedPriorities,
      selectedProject,
      selectedStage,
      selectedDueDate,
      selectedTeam,
      selectedAssignees,
      dateRangeStart,
      dateRangeEnd,
      debouncedSearch,
      onlyOverdue,
      activeStatFilter,
    }),
    [
      sortField,
      sortOrder,
      currentPage,
      pageSize,
      selectedStatus,
      selectedPriorities,
      selectedProject,
      selectedStage,
      selectedDueDate,
      selectedTeam,
      selectedAssignees,
      dateRangeStart,
      dateRangeEnd,
      debouncedSearch,
      onlyOverdue,
      activeStatFilter,
    ]
  );

  const needsAllTasks = computeNeedsAllTasks(taskListQueryState);

  // Ignore stale task-list responses when filters change quickly
  const fetchGenerationRef = useRef(0);

  // Helper function to get unique stages
  const getUniqueStages = (stagesData: any[]) => {
    const seen = new Set();
    return stagesData.filter((stage: any) => {
      const duplicate = seen.has(stage.id);
      seen.add(stage.id);
      return !duplicate;
    });
  };

  // Fetch reference data once per session (cached in memory for remounts)
  useEffect(() => {
    if (!isAuthenticated()) return;

    const cached = getTaskManagerReferenceCache(statsCacheKey);
    if (cached) {
      setTeamMembers(cached.teamMembers);
      setTeams(cached.teams);
      setStages(cached.stages);
      setProjects(cached.projects);
      setSkills(cached.skills);
      setGrades(cached.grades);
      setBooks(cached.books);
      setUnits(cached.units);
      setLessons(cached.lessons);
      return;
    }

    const fetchReferenceData = async () => {
      try {
        const emptyList: Promise<any> = Promise.resolve([]);
        const projectsPromise = canManageTasks
          ? projectService.getAll()
          : teamProjectService.getAll().then((data) => ({ data }));
        const [teamMembersData, teamsData, stagesData, projectsResponse, skillsData, gradesData, booksData, unitsData, lessonsData] = await Promise.all([
          canManageTasks ? teamService.getMembers() : emptyList,
          canManageTasks ? teamService.getTeams() : emptyList,
          stageService.getAll(),
          projectsPromise,
          skillService.getAll(),
          canManageTasks ? gradeService.getAll() : emptyList,
          canManageTasks ? bookService.getAll() : emptyList,
          canManageTasks ? unitService.getAll() : emptyList,
          canManageTasks ? lessonService.getAll() : emptyList,
        ]);
        const teamMembersList = teamMembersData.data || teamMembersData;
        const teamsList = teamsData.data || teamsData;
        const stagesArray = getUniqueStages(stagesData.data || stagesData);
        const projectsData = projectsResponse?.data ?? (Array.isArray(projectsResponse) ? projectsResponse : []);
        const skillsList = skillsData.data || skillsData;
        const gradesList = gradesData.data || gradesData;
        const booksList = booksData.data || booksData;
        const unitsList = unitsData.data || unitsData;
        const lessonsList = lessonsData.data || lessonsData;

        setTeamMembers(teamMembersList);
        setTeams(teamsList);
        setStages(stagesArray);
        setProjects(projectsData);
        setSkills(skillsList);
        setGrades(gradesList);
        setBooks(booksList);
        setUnits(unitsList);
        setLessons(lessonsList);

        setTaskManagerReferenceCache({
          teamMembers: teamMembersList,
          teams: teamsList,
          stages: stagesArray,
          projects: projectsData,
          skills: skillsList,
          grades: gradesList,
          books: booksList,
          units: unitsList,
          lessons: lessonsList,
          scope: statsCacheKey,
        });
      } catch (err) {
        console.error('Failed to fetch reference data:', err);
      }
    };
    fetchReferenceData();
  }, [user, canManageTasks, statsCacheKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset project filter if the selected project is not in the assignee's allowed list
  useEffect(() => {
    if (canManageTasks || filters.project === 'all') return;
    const allowed = projects.some((p) => String(p.id) === String(filters.project));
    if (!allowed) {
      setFilters((prev) => ({ ...prev, project: 'all', stage: 'all' }));
    }
  }, [canManageTasks, projects, filters.project]);

  // Fetch tasks whenever filters, sort, pagination, or debounced search changes.
  useEffect(() => {
    if (!isAuthenticated()) return;

    const generation = ++fetchGenerationRef.current;
    const showFullPageLoader = !isTasksSessionInitialized();

    const fetchTasks = async () => {
      if (showFullPageLoader) {
        setLoading(true);
      }
      try {
        const { params: fetchParams, needsAllTasks: fetchAll } =
          buildTaskListFetchParams(taskListQueryState);

        const tasksResponse = await taskService.getAll(fetchParams);
        if (generation !== fetchGenerationRef.current) return;

        const applied = applyTaskListResponse(tasksResponse, fetchAll, pageSize);
        setTasks(applied.tasks);
        setTotalTasks(applied.totalTasks);
        setTotalPages(applied.totalPages);

        setError(null);
      } catch (err: any) {
        if (generation !== fetchGenerationRef.current) return;
        console.error('Failed to fetch tasks:', err);
        setError(err.message || 'Failed to load tasks');
      } finally {
        if (generation === fetchGenerationRef.current) {
          setLoading(false);
          markTasksSessionInitialized();
        }
      }
    };

    fetchTasks();
  }, [user, taskListQueryState, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  // Single reusable refresh — same fetch rules as main effect (fixes page-2 empty after back)
  const refreshTasksList = useCallback(async () => {
    try {
      const { params, needsAllTasks: fetchAll } = buildTaskListFetchParams(taskListQueryState);
      const res = await taskService.getAll(params);
      const applied = applyTaskListResponse(res, fetchAll, pageSize);
      setTasks(applied.tasks);
      setTotalTasks(applied.totalTasks);
      setTotalPages(applied.totalPages);
    } catch (err) {
      console.error('Failed to refresh tasks:', err);
    }
  }, [taskListQueryState, pageSize]);

  // Reusable kanban refresh — used by both the scheduled effect and the event listener.
  const refreshKanbanTasks = useCallback(async () => {
    if (!isAuthenticated()) return;
    const generation = ++kanbanFetchGenRef.current;
    try {
      // Build a stripped-down query state for the kanban fetch:
      // status = 'all', no priorities, no activeStatFilter, no onlyOverdue —
      // so the backend returns tasks of every status and the bucket classifier
      // distributes them correctly across the columns.
      const kanbanQueryState: TaskListQueryState = {
        ...taskListQueryState,
        selectedStatus: 'all',
        selectedPriorities: [],
        activeStatFilter: null,
        onlyOverdue: false,
        // pagination irrelevant — we always fetch all
        currentPage: 1,
        pageSize: 9999,
      };

      const { params } = buildTaskListFetchParams(kanbanQueryState);
      const kanbanParams: Record<string, string | number> = { ...params, all: 'true' };
      delete kanbanParams.page;
      delete kanbanParams.limit;
      // Ensure status is not sent (strip any status param from the result)
      delete kanbanParams.status;

      const res = await taskService.getAll(kanbanParams);
      if (generation !== kanbanFetchGenRef.current) return;
      const data: any[] = Array.isArray(res) ? res : res?.data ?? [];
      setKanbanTasks(data);
    } catch (err) {
      console.error('Failed to fetch kanban tasks:', err);
    }
  }, [taskListQueryState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lightweight refresh when returning from task detail (list + stats, no full remount).
  // Also refreshes the kanban dataset so status changes (e.g. approve → completed) are
  // reflected immediately without requiring a manual page reload.
  useEffect(() => {
    const handleTasksListRefresh = async () => {
      await refreshTasksList();
      // Refresh kanban board data so status changes show up immediately
      if (taskView === 'kanban') {
        await refreshKanbanTasks();
      }
      // Also invalidate the dashboard summary cache so KPI counts refresh
      invalidateSummaryCache();
      refreshSummary();
    };
    const listener = () => { void handleTasksListRefresh(); };
    window.addEventListener(TASKS_LIST_REFRESH_EVENT, listener);
    return () => window.removeEventListener(TASKS_LIST_REFRESH_EVENT, listener);
  }, [refreshTasksList, refreshKanbanTasks, refreshSummary, taskView]);

  // Kanban view — fetch ALL tasks matching current filters (no pagination) whenever
  // the user is in kanban mode or switches to it.
  // IMPORTANT: For kanban we intentionally strip status/priority/activeStatFilter from
  // the server query — the kanban board classifies tasks into buckets itself, so we need
  // ALL statuses. We only keep scope filters: project, team, assignees, search, dateRange.
  useEffect(() => {
    if (taskView !== 'kanban') return;
    setKanbanLoading(true);
    refreshKanbanTasks().finally(() => setKanbanLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskView, taskListQueryState]);

  // Fetch stages for the selected project's category (top-level filters)
  const fetchProjectStagesForProject = async (projectId: string) => {
    if (!projectId || projectId === 'all') {
      setProjectStages([]);
      return;
    }

    try {
      setLoadingProjectStages(true);
      const proj = projects.find(p => p.id === parseInt(projectId) || p.id === projectId);
      let stagesData;
      if (proj?.category_id) {
        stagesData = await stageService.getByCategory(proj.category_id);
      } else {
        stagesData = await stageService.getAll(projectId);
      }
      const stagesArray = stagesData?.data || stagesData || [];
      const unique = getUniqueStages(stagesArray);
      setProjectStages(unique);
    } catch (e) {
      console.error('❌ Failed to fetch stages for selected project:', e);
      setProjectStages([]);
    } finally {
      setLoadingProjectStages(false);
    }
  };

  // When project changes (not on initial restore), reset stage filter and fetch project-specific stages
  const prevProjectRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevProjectRef.current;
    prevProjectRef.current = selectedProject;
    if (prev !== null && prev !== selectedProject) {
      setSelectedStage('all');
    }
    if (selectedProject && selectedProject !== 'all') {
      fetchProjectStagesForProject(selectedProject);
    } else {
      setProjectStages([]);
    }
  }, [selectedProject]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply filters from dashboard / team management navigation
  useEffect(() => {
    if (state.filters && Object.keys(state.filters).length > 0) {
      if (state.filters.activeOnly) {
        const memberId = state.filters.teamMembers?.[0];
        const nextFilters: TaskFilters = {
          search: '',
          status: 'active',
          priorities: [],
          project: 'all',
          stage: 'all',
          dueDate: 'all',
          team: 'all',
          assignees: isAdminUser && memberId ? [String(memberId)] : [],
          dateRangeStart: '',
          dateRangeEnd: '',
        };
        setFilters(isAdminUser ? nextFilters : sanitizeAssigneeFilters(nextFilters));
        setOnlyOverdue(false);
        setCurrentPage(1);
      } else {
        setFilters(prev => {
          const next = { ...prev };
          if (state.filters.statuses?.length === 1) next.status = state.filters.statuses[0];
          if (isAdminUser && state.filters.teamMembers?.length === 1) {
            next.assignees = [String(state.filters.teamMembers[0])];
          }
          if ((state.filters as any).priority) next.priorities = [(state.filters as any).priority];
          return isAdminUser ? next : sanitizeAssigneeFilters(next);
        });
        if ((state.filters as any).overdue) setOnlyOverdue(true);
      }
      setTimeout(() => { dispatch({ type: 'SET_FILTERS', payload: {} }); }, 0);
    }
  }, [state.filters, dispatch, isAdminUser]);

  // Reset to first page when filters or search change
  const prevFiltersRef = useRef({
    selectedStatus, selectedPriorities, selectedProject, selectedStage,
    selectedDueDate, selectedTeam, selectedAssignees, dateRangeStart, dateRangeEnd, debouncedSearch
  });

  useEffect(() => {
    const prev = prevFiltersRef.current;
    const filtersChanged =
      prev.selectedStatus !== selectedStatus ||
      JSON.stringify(prev.selectedPriorities) !== JSON.stringify(selectedPriorities) ||
      prev.selectedProject !== selectedProject ||
      prev.selectedStage !== selectedStage ||
      prev.selectedDueDate !== selectedDueDate ||
      prev.selectedTeam !== selectedTeam ||
      JSON.stringify(prev.selectedAssignees) !== JSON.stringify(selectedAssignees) ||
      prev.dateRangeStart !== dateRangeStart ||
      prev.dateRangeEnd !== dateRangeEnd ||
      prev.debouncedSearch !== debouncedSearch;

    prevFiltersRef.current = {
      selectedStatus, selectedPriorities, selectedProject, selectedStage,
      selectedDueDate, selectedTeam, selectedAssignees, dateRangeStart, dateRangeEnd, debouncedSearch
    };

    if (filtersChanged && currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [selectedStatus, selectedPriorities, selectedProject, selectedStage, selectedDueDate, selectedTeam, selectedAssignees, dateRangeStart, dateRangeEnd, debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps
  // Clear selections when filters change
  useEffect(() => {
    setSelectedTasks(new Set());
  }, [selectedStatus, selectedPriorities, selectedProject, selectedStage, selectedDueDate, selectedTeam, selectedAssignees, dateRangeStart, dateRangeEnd, debouncedSearch, currentPage]);

  // Stable callback passed to TaskSearchFilters — prevents the child from
  // re-creating its own internal callbacks on every parent render.
  const handleFiltersChange = useCallback((next: TaskFilters) => {
    setFilters(isAdminUser ? next : sanitizeAssigneeFilters(next));
    // Clear stat card filter when user manually changes the status dropdown
    setActiveStatFilter(null);
  }, [isAdminUser]);

  // Persist filters, sort, and pagination so they survive navigating to task detail and back
  useEffect(() => {
    saveTaskManagerState({
      filters,
      currentPage,
      pageSize,
      sortField,
      sortOrder,
      onlyOverdue,
    });
  }, [filters, currentPage, pageSize, sortField, sortOrder, onlyOverdue]);

  const isOverdue = useCallback((task: Task) => {
    const endDate = task.end_date || task.endDate;
    if (!endDate) return false;

    // Exclude statuses where the assignee has already submitted — not overdue
    // from the assignee's perspective (under-review, resubmitted, completed).
    const status = (task.status || '').toLowerCase().replace(/_/g, '-');
    if (status === 'completed' || status === 'under-review' || status === 'resubmitted') {
      return false;
    }

    // Get today's date at midnight (start of day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get the end date at midnight (start of day)
    const dueDate = new Date(endDate);
    dueDate.setHours(0, 0, 0, 0);

    // Task is overdue if due date is before today
    return dueDate < today;
  }, []);

  const isDueToday = useCallback((task: Task) => {
    const endDate = task.end_date || task.endDate;
    if (!endDate) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(endDate);
    dueDate.setHours(0, 0, 0, 0);

    return dueDate.getTime() === today.getTime() && task.status !== 'completed';
  }, []);

  const isDueTomorrow = useCallback((task: Task) => {
    const endDate = task.end_date || task.endDate;
    if (!endDate) return false;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const dueDate = new Date(endDate);
    dueDate.setHours(0, 0, 0, 0);

    return dueDate.getTime() === tomorrow.getTime() && task.status !== 'completed';
  }, []);

  const isDueThisWeek = useCallback((task: Task) => {
    const endDate = task.end_date || task.endDate;
    if (!endDate) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekFromNow = new Date();
    weekFromNow.setDate(today.getDate() + 7);
    weekFromNow.setHours(0, 0, 0, 0);
    const dueDate = new Date(endDate);
    dueDate.setHours(0, 0, 0, 0);

    return dueDate >= today && dueDate <= weekFromNow && task.status !== 'completed';
  }, []);

  // Apply filters to tasks
  
  
  const filteredTasksBase = useMemo(() => tasks.filter((task: any) => {
    // Apply dashboard filters only (other filters are handled by backend)
    if (state.filters?.overdue && !isOverdue(task)) return false;
    if (state.filters?.dueToday && !isDueToday(task)) return false;
    if (state.filters?.dueTomorrow && !isDueTomorrow(task)) return false;
    if (state.filters?.dueThisWeek && !isDueThisWeek(task)) return false;
    if (onlyOverdue && !isOverdue(task)) return false;

    // Apply KPI card stat filter (client-side)
    if (activeStatFilter === 'overdue' && !isOverdue(task)) return false;
    if (activeStatFilter === 'inProgress' && task.status !== 'in-progress') return false;
    if (activeStatFilter === 'completed' && task.status !== 'completed') return false;
    if (activeStatFilter === 'notStarted' && task.status !== 'not-started') return false;
    if (activeStatFilter === 'underReview' && task.status !== 'under-review') return false;
    // 'total' shows everything — no extra filter needed
    
    // Apply status filter for overdue / active (client-side)
    if (selectedStatus === 'overdue' && !isOverdue(task)) return false;
    if (selectedStatus === 'active' && !isActiveTaskForDashboard(task)) return false;

    // Apply stage filter
    if (selectedStage !== 'all') {
      const taskStageId = task.category_stage_id;
      const taskStageIdNum = taskStageId ? parseInt(taskStageId.toString()) : null;
      const selectedStageIdNum = parseInt(selectedStage);
      if (taskStageIdNum !== selectedStageIdNum) return false;
    }

    // Apply custom date range filter (by due date)
    if (hasDateRange) {
      const taskEndDate = task.end_date || task.endDate;
      if (!taskEndDate) return false;
      const dueDateStr = new Date(taskEndDate).toISOString().split('T')[0];
      if (dateRangeStart && dueDateStr < dateRangeStart) return false;
      if (dateRangeEnd && dueDateStr > dateRangeEnd) return false;
    }

    // Apply due date filter
    if (selectedDueDate !== 'all') {
      const taskEndDate = task.end_date || task.endDate;
      if (!taskEndDate) return false;
      
      const dueDate = new Date(taskEndDate);
      dueDate.setHours(0, 0, 0, 0);
      
      switch (selectedDueDate) {
        case 'overdue': if (!isOverdue(task)) return false; break;
        case 'today': if (!isDueToday(task)) return false; break;
        case 'tomorrow': if (!isDueTomorrow(task)) return false; break;
        case 'this-week': if (!isDueThisWeek(task)) return false; break;
        case 'next-week': {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const nextWeekStart = new Date();
          nextWeekStart.setDate(today.getDate() + 7);
          nextWeekStart.setHours(0, 0, 0, 0);
          const nextWeekEnd = new Date();
          nextWeekEnd.setDate(today.getDate() + 14);
          nextWeekEnd.setHours(0, 0, 0, 0);
          if (dueDate < nextWeekStart || dueDate > nextWeekEnd || task.status === 'completed') return false;
          break;
        }
        case 'no-due-date': if (taskEndDate) return false; break;
      }
    }

    return true;
  }), [tasks, state.filters, onlyOverdue, activeStatFilter, selectedStatus, selectedStage, selectedDueDate, hasDateRange, dateRangeStart, dateRangeEnd, isOverdue, isDueToday, isDueTomorrow, isDueThisWeek]);

  // Apply client-side filters to the kanban dataset.
  // NOTE: Status / priority / activeStatFilter / onlyOverdue are intentionally
  // excluded here — the kanban board classifies every task into its own bucket,
  // so filtering by status would empty out columns the user hasn't filtered for.
  // Only scope-narrowing filters are applied: stage, date range, due-date preset,
  // and nav-dashboard quick-filters (overdue/dueToday/etc.).
  const kanbanFilteredTasks = useMemo(() => kanbanTasks.filter((task: any) => {
    // Navigation quick-filters from dashboard
    if (state.filters?.overdue && !isOverdue(task)) return false;
    if (state.filters?.dueToday && !isDueToday(task)) return false;
    if (state.filters?.dueTomorrow && !isDueTomorrow(task)) return false;
    if (state.filters?.dueThisWeek && !isDueThisWeek(task)) return false;

    // Stage filter
    if (selectedStage !== 'all') {
      const taskStageIdNum = task.category_stage_id ? parseInt(task.category_stage_id.toString()) : null;
      if (taskStageIdNum !== parseInt(selectedStage)) return false;
    }

    // Custom due-date range
    if (hasDateRange) {
      const taskEndDate = task.end_date || task.endDate;
      if (!taskEndDate) return false;
      const dueDateStr = new Date(taskEndDate).toISOString().split('T')[0];
      if (dateRangeStart && dueDateStr < dateRangeStart) return false;
      if (dateRangeEnd && dueDateStr > dateRangeEnd) return false;
    }

    // Due-date preset filter
    if (selectedDueDate !== 'all') {
      const taskEndDate = task.end_date || task.endDate;
      if (!taskEndDate) return false;
      switch (selectedDueDate) {
        case 'overdue': if (!isOverdue(task)) return false; break;
        case 'today': if (!isDueToday(task)) return false; break;
        case 'tomorrow': if (!isDueTomorrow(task)) return false; break;
        case 'this-week': if (!isDueThisWeek(task)) return false; break;
        case 'next-week': {
          const today = new Date(); today.setHours(0,0,0,0);
          const nextWeekStart = new Date(); nextWeekStart.setDate(today.getDate() + 7); nextWeekStart.setHours(0,0,0,0);
          const nextWeekEnd = new Date(); nextWeekEnd.setDate(today.getDate() + 14); nextWeekEnd.setHours(0,0,0,0);
          const dueDate = new Date(taskEndDate); dueDate.setHours(0,0,0,0);
          if (dueDate < nextWeekStart || dueDate > nextWeekEnd || task.status === 'completed') return false;
          break;
        }
        case 'no-due-date': if (taskEndDate) return false; break;
      }
    }
    return true;
  }), [kanbanTasks, state.filters, selectedStage, selectedDueDate, hasDateRange, dateRangeStart, dateRangeEnd, isOverdue, isDueToday, isDueTomorrow, isDueThisWeek]);

  // Client-side filters (active, overdue, assignee, etc.) shrink the fetched list — paginate that result.
  const {
    filteredTasks,
    displayTotalTasks,
    displayTotalPages,
    effectivePage,
  } = useMemo(() => {
    if (!needsAllTasks) {
      return {
        filteredTasks: filteredTasksBase,
        displayTotalTasks: totalTasks,
        displayTotalPages: totalPages,
        effectivePage: currentPage,
      };
    }

    const count = filteredTasksBase.length;
    const pages = Math.max(1, Math.ceil(count / pageSize));
    const page = Math.min(Math.max(currentPage, 1), pages);
    const startIndex = (page - 1) * pageSize;

    return {
      filteredTasks: filteredTasksBase.slice(startIndex, startIndex + pageSize),
      displayTotalTasks: count,
      displayTotalPages: pages,
      effectivePage: page,
    };
  }, [
    needsAllTasks,
    filteredTasksBase,
    totalTasks,
    totalPages,
    currentPage,
    pageSize,
  ]);

  useEffect(() => {
    if (needsAllTasks && currentPage !== effectivePage) {
      setCurrentPage(effectivePage);
    }
  }, [needsAllTasks, currentPage, effectivePage]);



  const handleCreateTask = async (taskData: Partial<Task>) => {
    try {
      if (editingTask) {
        // Build component path for display (same logic as ProjectDetails)
        let componentPath = '';
        if (taskData.gradeId) {
          const grade = grades.find(g => g.id === parseInt(taskData.gradeId || '0'));
          if (grade) {
            componentPath = grade.name;
            if (taskData.bookId) {
              const book = books.find(b => b.id === parseInt(taskData.bookId || '0'));
              if (book) {
                componentPath += ` > ${book.name}`;
                if (taskData.unitId) {
                  const unit = units.find(u => u.id === parseInt(taskData.unitId || '0'));
                  if (unit) {
                    componentPath += ` > ${unit.name}`;
                    if (taskData.lessonId) {
                      const lesson = lessons.find(l => l.id === parseInt(taskData.lessonId || '0'));
                      if (lesson) {
                        componentPath += ` > ${lesson.name}`;
                      }
                    }
                  }
                }
              }
            }
          }
        }

        // Update existing task
        const updateData = {
          name: taskData.name,
          description: taskData.description,
          project_id: parseInt(taskData.projectId || '1'),
          category_stage_id: parseInt(taskData.stageId || ''),
          ...pickTaskUpdateStatus(taskData.status),
          priority: taskData.priority,
          start_date: taskData.startDate,
          end_date: taskData.endDate,
          estimated_hours: parseInt(String(taskData.estimatedHours || 0)),
          actual_hours: parseInt(String(taskData.actualHours || 0)),
          assignees: taskData.assignees || [],
          skills: taskData.skills,
          server_location: taskData.server_location || '',
          // Add educational hierarchy IDs
          grade_id: taskData.gradeId ? parseInt(taskData.gradeId) : null,
          book_id: taskData.bookId ? parseInt(taskData.bookId) : null,
          unit_id: taskData.unitId ? parseInt(taskData.unitId) : null,
          lesson_id: taskData.lessonId ? parseInt(taskData.lessonId) : null,
          component_path: componentPath
        };

        await taskService.update(editingTask.id, updateData);
        await refreshTasksList();
        // Invalidate KPI summary after task update
        invalidateSummaryCache();
        refreshSummary();
      } else {
        // Build component path for display
        let componentPath = '';
        if (taskData.gradeId) {
          const grade = grades.find(g => g.id === parseInt(taskData.gradeId || '0'));
          if (grade) {
            componentPath = grade.name;
            if (taskData.bookId) {
              const book = books.find(b => b.id === parseInt(taskData.bookId || '0'));
              if (book) {
                componentPath += ` > ${book.name}`;
                if (taskData.unitId) {
                  const unit = units.find(u => u.id === parseInt(taskData.unitId || '0'));
                  if (unit) {
                    componentPath += ` > ${unit.name}`;
                    if (taskData.lessonId) {
                      const lesson = lessons.find(l => l.id === parseInt(taskData.lessonId || '0'));
                      if (lesson) {
                        componentPath += ` > ${lesson.name}`;
                      }
                    }
                  }
                }
              }
            }
          }
        }

        // Convert skill names to skill IDs
        const skillIds = (taskData.skills || []).map((skillName: string) => {
          const skill = skills.find(s => s.name === skillName);
          return skill ? skill.id : null;
        }).filter(id => id !== null);

        // Create new task
        const createData = {
          name: taskData.name || '',
          description: taskData.description || '',
          project_id: parseInt(taskData.projectId || '1'),
          category_stage_id: parseInt(taskData.stageId || ''),
          status: taskData.status || 'not-started',
          priority: taskData.priority || 'medium',
          start_date: taskData.startDate || new Date().toISOString().split('T')[0],
          end_date: taskData.endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          estimated_hours: taskData.estimatedHours || 8,
          assignees: taskData.assignees || [],
          skills: skillIds,
          component_path: componentPath,
          // Add educational hierarchy IDs
          grade_id: taskData.gradeId ? parseInt(taskData.gradeId) : null,
          book_id: taskData.bookId ? parseInt(taskData.bookId) : null,
          unit_id: taskData.unitId ? parseInt(taskData.unitId) : null,
          lesson_id: taskData.lessonId ? parseInt(taskData.lessonId) : null,
          server_location: taskData.server_location || '',
        };

        await taskService.create(createData);
        await refreshTasksList();
        // Invalidate KPI summary after task creation
        invalidateSummaryCache();
        refreshSummary();
      }

      setIsCreateModalOpen(false);
      setEditingTask(null);
    } catch (error) {
      console.error('❌ Failed to save task:', error);
      setError('Failed to save task');
    }
  };

  const getStatusVariant = useCallback((status: TaskStatus) => {
    return getTaskStatusBadgeVariant(status);
  }, []);

  const getPriorityVariant = useCallback((priority: Priority) => {
    switch (priority) {
      case 'low': return 'default';
      case 'medium': return 'primary';
      case 'high': return 'warning';
      case 'urgent': return 'danger';
      default: return 'default';
    }
  }, []);

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsCreateModalOpen(true);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      // Toggle order if same field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field with default desc order
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleDeleteTask = async (task: Task) => {
    if (!confirm(`Are you sure you want to delete the task "${task.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setError(null);

      // Delete the task
      await taskService.delete(task.id);
      await refreshTasksList();
      // Invalidate KPI summary after deletion
      invalidateSummaryCache();
      refreshSummary();

    } catch (err: any) {
      console.error('❌ Delete task error:', err);
      setError(err.message || 'Failed to delete task');
    }
  };

  const handleApproveTask = async (task: Task) => {
    try {
      setError(null);
      await taskService.reviewTask(task.id, 'approve');
      await refreshTasksList();
      invalidateSummaryCache();
      refreshSummary();

    } catch (err: any) {
      console.error('❌ Approve task error:', err);
      setError(err.message || 'Failed to approve task');
    }
  };

  const handleDenyTask = async (task: Task) => {
    try {
      setError(null);
      await taskService.reviewTask(task.id, 'deny');
      await refreshTasksList();
      invalidateSummaryCache();
      refreshSummary();

    } catch (err: any) {
      console.error('❌ Deny task error:', err);
      setError(err.message || 'Failed to deny task');
    }
  };

  const openTaskDetail = useCallback((taskId: string | number) => {
    dispatch({ type: 'SET_PREVIOUS_VIEW', payload: 'tasks' });
    dispatch({ type: 'SET_SELECTED_TASK', payload: taskId.toString() });
  }, [dispatch]);

  const handleOpenFlagModal = (member: any, task?: any) => {
    setFlaggingMember({ 
      id: member.id, 
      name: member.name,
      taskId: task?.id,
      taskName: task?.name
    });
    setShowFlagModal(true);
  };
  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const selectAllTasks = () => {
    const allTaskIds = filteredTasks.map(task => task.id.toString());
    setSelectedTasks(new Set(allTaskIds));
  };

  const clearAllSelections = () => {
    setSelectedTasks(new Set());
  };

  const isAllSelected = () => {
    return filteredTasks.length > 0 && filteredTasks.every(task => selectedTasks.has(task.id.toString()));
  };

  const isPartiallySelected = () => {
    return selectedTasks.size > 0 && selectedTasks.size < filteredTasks.length;
  };

  // Bulk delete function
  const handleBulkDelete = async () => {
    if (selectedTasks.size === 0) return;

    try {
      setError(null);

      // Convert Set to Array and ensure they are numbers, filtering out invalid IDs
      const taskIds = Array.from(selectedTasks)
        .map(id => parseInt(id))
        .filter(id => !isNaN(id) && id > 0);

      // Validate we have valid IDs
      if (taskIds.length === 0) {
        setError('No valid tasks selected for deletion');
        return;
      }

      // Call bulk delete API
      await taskService.bulkDelete(taskIds);

      // Clear selections
      setSelectedTasks(new Set());
      setIsBulkDeleteModalOpen(false);
      await refreshTasksList();
      // Invalidate KPI summary — bulk delete changes all counts
      invalidateSummaryCache();
      refreshSummary();

    } catch (err: any) {
      console.error('❌ Bulk delete error:', err);
      setError(err.message || 'Failed to delete tasks');
      
      // Refresh the task list even on error to show current state
      await refreshTasksList();
      
      // Clear selections on error too
      setSelectedTasks(new Set());
      setIsBulkDeleteModalOpen(false);
    }
  };

  // Calculate task statistics — now sourced from the dedicated summary API,
  // NOT from iterating a full allTasks array. Falls back to totalTasks from
  // pagination when the summary is still loading.
  const taskStats = useMemo(() => ({
    total: dashboardSummary.totalTasks || totalTasks,
    notStarted: dashboardSummary.notStarted,
    inProgress: dashboardSummary.inProgress,
    underReview: dashboardSummary.underReview,
    completed: dashboardSummary.completed,
    overdue: dashboardSummary.overdue,
  }), [dashboardSummary, totalTasks]);

  // Debug logging for statistics



  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="text-lg font-medium text-gray-900 mb-2">Loading tasks...</div>
            <div className="text-gray-500">Please wait while we fetch your tasks</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="text-lg font-medium text-red-600 mb-2">Failed to load tasks</div>
            <div className="text-gray-500 mb-4">{error}</div>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 w-full min-w-0 max-w-full">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 text-white p-6 shadow-lg">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-14 -left-12 w-56 h-56 bg-white/10 rounded-full blur-2xl" />
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold">Task Management</h1>
            <p className="text-white/80 text-sm sm:text-base">Track and manage all project tasks</p>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 flex-shrink-0">
            {canManageTasks && (
              <>
                <TaskExportButton
                  filters={filters}
                  selectedTaskIds={Array.from(selectedTasks)}
                  hasSelection={selectedTasks.size > 0}
                />
                <Button
                  variant="dark"
                  icon={<Upload className="w-4 h-4" />}
                  onClick={() => setIsBulkUploadModalOpen(true)}
                >
                  Bulk Upload
                </Button>
                <Button icon={<Plus className="w-4 h-4" />} onClick={() => {
                  setEditingTask(null);
                  setIsCreateModalOpen(true);
                }}>
                  Create Task
                </Button>
              </>
            )}
          </div>
        </div>
      </div>


      {/* Task Stats — skeleton while summary is loading, then live counts */}
      {summaryLoading && !dashboardSummary.totalTasks ? (
        <TaskStatSkeletonGrid count={6} />
      ) : (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 w-full min-w-0">
        {([
          {
            key: 'total',
            label: 'Total Tasks',
            value: taskStats.total,
            icon: CheckSquare,
            iconBg: 'bg-slate-100',
            iconColor: 'text-slate-600',
            accent: 'bg-slate-400',
            active: activeStatFilter === 'total',
            onClick: () => { setActiveStatFilter(prev => prev === 'total' ? null : 'total'); setCurrentPage(1); },
          },
          {
            key: 'inProgress',
            label: 'In Progress',
            value: taskStats.inProgress,
            icon: Clock,
            iconBg: 'bg-blue-50',
            iconColor: 'text-blue-600',
            accent: 'bg-blue-500',
            active: activeStatFilter === 'inProgress',
            onClick: () => { setActiveStatFilter(prev => prev === 'inProgress' ? null : 'inProgress'); setCurrentPage(1); },
          },
          {
            key: 'completed',
            label: 'Completed',
            value: taskStats.completed,
            icon: CheckCircle2,
            iconBg: 'bg-emerald-50',
            iconColor: 'text-emerald-600',
            accent: 'bg-emerald-500',
            active: activeStatFilter === 'completed',
            onClick: () => { setActiveStatFilter(prev => prev === 'completed' ? null : 'completed'); setCurrentPage(1); },
          },
          {
            key: 'notStarted',
            label: 'Not Started',
            value: taskStats.notStarted,
            icon: Clock,
            iconBg: 'bg-amber-50',
            iconColor: 'text-amber-600',
            accent: 'bg-amber-500',
            active: activeStatFilter === 'notStarted',
            onClick: () => { setActiveStatFilter(prev => prev === 'notStarted' ? null : 'notStarted'); setCurrentPage(1); },
          },
          {
            key: 'underReview',
            label: 'Under Review',
            value: taskStats.underReview,
            icon: Clock,
            iconBg: 'bg-yellow-50',
            iconColor: 'text-yellow-600',
            accent: 'bg-yellow-500',
            active: activeStatFilter === 'underReview',
            onClick: () => { setActiveStatFilter(prev => prev === 'underReview' ? null : 'underReview'); setCurrentPage(1); },
          },
          {
            key: 'overdue',
            label: 'Overdue',
            value: taskStats.overdue,
            icon: AlertTriangle,
            iconBg: 'bg-red-50',
            iconColor: 'text-red-600',
            accent: 'bg-red-500',
            active: activeStatFilter === 'overdue' || onlyOverdue,
            onClick: () => {
              if (onlyOverdue) {
                setOnlyOverdue(false);
                setActiveStatFilter(prev => prev === 'overdue' ? null : 'overdue');
              } else {
                setActiveStatFilter(prev => prev === 'overdue' ? null : 'overdue');
              }
              setCurrentPage(1);
            },
          },
        ] as TaskStatCardConfig[]).map((stat) => (
          <TaskStatCard key={stat.key} {...stat} />
        ))}
      </div>
      )}

      {/* Filters */}
      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-semibold text-gray-900 tracking-tight">
            {taskView === 'kanban' ? 'Kanban Board' : 'All Tasks'}
          </h2>
          <p className="text-xs text-gray-400 font-medium">
            {taskView === 'kanban'
              ? 'Visual board — tasks organised by status'
              : 'List view — sortable and filterable task table'}
          </p>
        </div>
        {/* Segmented control */}
        <div
          className="flex items-center p-1 rounded-xl border border-gray-200 bg-gray-100/80 shadow-sm"
          role="group"
          aria-label="Task view toggle"
        >
          <button
            onClick={() => handleSetTaskView('list')}
            title="List view"
            aria-pressed={taskView === 'list'}
            className={[
              'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
              taskView === 'list'
                ? 'bg-white shadow text-gray-800 border border-gray-200/80'
                : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            <ListIcon className="w-3.5 h-3.5" aria-hidden />
            List
          </button>
          <button
            onClick={() => handleSetTaskView('kanban')}
            title="Kanban board view"
            aria-pressed={taskView === 'kanban'}
            className={[
              'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
              taskView === 'kanban'
                ? 'bg-white shadow text-blue-700 border border-blue-200/80'
                : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            <LayoutGrid className="w-3.5 h-3.5" aria-hidden />
            Kanban
          </button>
        </div>
      </div>

      {/* Filters */}
      <TaskSearchFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        projects={projects}
        projectStages={projectStages}
        teamMembers={teamMembers}
        teams={teams}
        loadingProjectStages={loadingProjectStages}
        onAddTask={canManageTasks ? () => { setEditingTask(null); setIsCreateModalOpen(true); } : undefined}
        showAssigneeFilter={isAdminUser}
        showTeamFilter={isAdminUser}
      />

      {/* Bulk Selection Controls */}
      {canManageTasks && filteredTasks.length > 0 && (
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 min-w-0">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={isAllSelected()}
                  ref={(input) => {
                    if (input) input.indeterminate = isPartiallySelected();
                  }}
                  onChange={() => {
                    if (isAllSelected()) {
                      clearAllSelections();
                    } else {
                      selectAllTasks();
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  {isAllSelected() ? 'Deselect All' : 'Select All'}
                </span>
              </div>
              
              {selectedTasks.size > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">
                    {selectedTasks.size} task{selectedTasks.size !== 1 ? 's' : ''} selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearAllSelections}
                    className="text-gray-600 hover:text-gray-800"
                  >
                    Clear Selection
                  </Button>
                </div>
              )}
            </div>

            {selectedTasks.size > 0 && (
              <BulkTaskSelectionActions
                selectedTaskIds={Array.from(selectedTasks)}
                selectedTaskNames={Array.from(selectedTasks).map((taskId) => {
                  const task = filteredTasks.find((t) => t.id.toString() === taskId);
                  return task?.name || `Task ${taskId}`;
                })}
                teamMembers={teamMembers}
                onSuccess={async () => {
                  setSelectedTasks(new Set());
                  await refreshTasksList();
                  invalidateSummaryCache();
                  refreshSummary();
                }}
                onDelete={() => setIsBulkDeleteModalOpen(true)}
              />
            )}
          </div>
        </div>
      )}

      {/* Kanban View — lazy-loaded; KanbanSkeleton shown while chunk or data loads */}
      {taskView === 'kanban' && (
        <Suspense fallback={<KanbanSkeleton />}>
          {kanbanLoading ? (
            <KanbanSkeleton />
          ) : (
            <AdminKanbanView
              tasks={kanbanFilteredTasks}
              onView={(task) => openTaskDetail(task.id)}
              onEdit={(task) => handleEditTask(task)}
              onApprove={(task) => handleApproveTask(task)}
              onDeny={(task) => handleDenyTask(task)}
              onFlag={(task) => {
                // Flag the first assignee of the task
                const assignee = task.assigneeDetails?.[0];
                if (assignee) {
                  handleOpenFlagModal({ id: assignee.id, name: assignee.name }, task);
                }
              }}
              onDelete={(task) => handleDeleteTask(task)}
            />
          )}
        </Suspense>
      )}

      {/* List View */}
      {taskView === 'list' && (
        <>
            {/* Tasks List */}
      <Card className="min-w-0 w-full overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto w-full min-w-0">
            <table className="task-table min-w-[960px]">
              <colgroup>
                {canManageTasks && <col style={{ width: '36px' }} />}
                <col style={{ width: canManageTasks ? '26%' : '28%' }} />
                <col style={{ width: '5%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: canManageTasks ? '148px' : '96px' }} />
              </colgroup>
              <thead className="bg-gray-50">
                <tr>
                  {canManageTasks && (
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        checked={isAllSelected()}
                        ref={(input) => {
                          if (input) input.indeterminate = isPartiallySelected();
                        }}
                        onChange={() => {
                          if (isAllSelected()) {
                            clearAllSelections();
                          } else {
                            selectAllTasks();
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                  )}
                  <th
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 task-table__cell-clip"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center min-w-0">
                      <span className="truncate">Task Name</span>
                      {sortField === 'name' && (
                        <span className="ml-1 text-blue-600">
                          {sortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
               
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider task-table__cell-clip">
                    <span className="truncate block">Project</span>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider task-table__cell-clip">
                    <span className="truncate block">Stage</span>
                  </th>

                  <th
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 task-table__cell-clip"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center min-w-0">
                      <span className="truncate">Status</span>
                      {sortField === 'status' && (
                        <span className="ml-1 text-blue-600">
                          {sortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 task-table__cell-clip"
                    onClick={() => handleSort('priority')}
                  >
                    <div className="flex items-center min-w-0">
                      <span className="truncate">Priority</span>
                      {sortField === 'priority' && (
                        <span className="ml-1 text-blue-600">
                          {sortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 task-table__cell-clip"
                    onClick={() => handleSort('assignees')}
                  >
                    <div className="flex items-center min-w-0">
                      <span className="truncate">Assignees</span>
                      {sortField === 'assignees' && (
                        <span className="ml-1 text-blue-600">
                          {sortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 task-table__cell-clip"
                    onClick={() => handleSort('start_date')}
                  >
                    <div className="flex items-center min-w-0">
                      <span className="truncate">Start</span>
                      {sortField === 'start_date' && (
                        <span className="ml-1 text-blue-600">
                          {sortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 task-table__cell-clip"
                    onClick={() => handleSort('end_date')}
                  >
                    <div className="flex items-center min-w-0">
                      <span className="truncate">Due</span>
                      {sortField === 'end_date' && (
                        <span className="ml-1 text-blue-600">
                          {sortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    className={`px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 task-table__progress-cell ${canManageTasks ? 'task-table__progress-cell--admin' : ''}`}
                    onClick={() => handleSort('progress')}
                  >
                    <span>Progress</span>
                    {sortField === 'progress' && (
                      <span className="ml-1 text-blue-600">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>

                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTasks.map((task) => {
                  // Use assigneeDetails from API response directly (avoids type-mismatch with teamMembers lookup)
                  // Falls back to cross-referencing teamMembers by normalizing IDs to strings
                  const assignedUsers: any[] = task.assigneeDetails && task.assigneeDetails.length > 0
                    ? task.assigneeDetails
                    : teamMembers.filter((u: any) =>
                        task.assignees &&
                        task.assignees.map((id: any) => String(id)).includes(String(u.id))
                      );
                  const overdue = isOverdue(task);
                  // Find project by ID - handle both string and number types
                  const taskProjectId = task.project_id || task.projectId;
                  const project = projects.find(p => {
                    const projectId = typeof p.id === 'string' ? parseInt(p.id) : p.id;
                    const taskId = typeof taskProjectId === 'string' ? parseInt(taskProjectId) : taskProjectId;
                    return projectId === taskId;
                  });
                  const projectName = project?.name || task.project_name;

                  // Use stage_name from API response directly
                  const stageName = task.stage_name;
                  const reworkCount = getTaskReworkCount(task);
                  const reworkRowClass =
                    isReworkHighlightEnabled() &&
                    reworkCount > 0 &&
                    isReworkActiveStatus(task.status)
                      ? getReworkRowClass(reworkCount)
                      : null;
                  const reworkBadgeTone =
                    reworkCount >= 3 ? 'red' : reworkCount === 2 ? 'orange' : reworkCount === 1 ? 'yellow' : null;
                  const displayProgress = getTaskDisplayProgress(task);
                  const taskSubtitle = task.component_path || task.description;
                  const taskSubtitleTitle = [task.component_path, task.description].filter(Boolean).join(' · ');

                  return (
                    <tr
                      key={task.id}
                      onClick={() => openTaskDetail(task.id)}
                      className={`cursor-pointer hover:bg-gray-50 ${
                        reworkRowClass ||
                        (task.status === 'under-review'
                          ? 'bg-yellow-50 border-l-4 border-yellow-400'
                          : overdue
                            ? 'bg-red-50'
                            : '')
                      }`}
                    >
                      {canManageTasks && (
                        <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedTasks.has(task.id.toString())}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleTaskSelection(task.id.toString());
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                      )}
                      <td className="px-3 py-3 align-top task-table__cell-clip">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 flex items-center gap-1 min-w-0">
                            <span className="task-table__text-ellipsis flex-1" title={task.name}>
                              {task.name}
                            </span>
                            {overdue && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                            {task.status === 'under-review' && <Clock className="w-3.5 h-3.5 text-yellow-500 shrink-0" />}
                            {reworkCount > 0 && reworkBadgeTone && (
                              <span
                                className={`inline-flex items-center shrink-0 px-1 py-0.5 rounded text-[10px] font-semibold rework-returned-badge rework-returned-badge--${reworkBadgeTone}`}
                                role="status"
                                title={`Returned for rework — ${getReworkReviewSubLabel(reworkCount)}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <RotateCcw className="w-3 h-3" aria-hidden />
                              </span>
                            )}
                          </div>
                          {taskSubtitle && (
                            <div
                              className={`mt-0.5 text-xs task-table__text-clamp-2 ${task.component_path ? 'text-purple-600' : 'text-gray-500'}`}
                              title={taskSubtitleTitle || taskSubtitle}
                            >
                              {task.component_path ? `📚 ${task.component_path}` : taskSubtitle}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 task-table__cell-clip">
                        <div className="text-sm text-gray-900 min-w-0">
                          {projectName ? (
                            <div className="font-medium text-blue-600 task-table__text-ellipsis" title={projectName}>
                              {projectName}
                            </div>
                          ) : (
                            <span className="text-gray-400">Unknown</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 task-table__cell-clip">
                        <div className="text-sm text-gray-900 min-w-0">
                          {stageName ? (
                            <div className="font-medium text-green-600 task-table__text-ellipsis" title={stageName}>
                              {stageName}
                            </div>
                          ) : (
                            <span className="text-gray-400">Unknown</span>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-3 task-table__cell-clip">
                        <Badge variant={getStatusVariant(task.status)} className="max-w-full truncate">
                          {getTaskStatusLabel(task.status)}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 task-table__cell-clip">
                        <Badge variant={getPriorityVariant(task.priority)}>
                          {task.priority}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 task-table__cell-clip">
                        <div className="min-w-0">
                          {assignedUsers.length > 0 && (
                            <div className="min-w-0">
                              <span
                                className={`inline-flex items-center max-w-full px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 truncate ${
                                  canManageTasks ? 'hover:bg-blue-200 cursor-pointer' : ''
                                }`}
                                onClick={canManageTasks && assignedUsers[0] ? (e) => {
                                  e.stopPropagation();
                                  handleOpenFlagModal(assignedUsers[0], task);
                                } : undefined}
                                title={assignedUsers.map((u) => u.name).join(', ')}
                              >
                                {assignedUsers[0].name}
                                {assignedUsers.length > 1 && ` +${assignedUsers.length - 1}`}
                                {canManageTasks && <Flag className="w-2.5 h-2.5 ml-0.5 text-blue-600 shrink-0" />}
                              </span>
                            </div>
                          )}

                          {assignedUsers.length === 0 && (
                            <span className={`text-xs truncate block ${selectedAssignees.includes('none') ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                              No assignees
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-900 task-table__cell-clip">
                        <div className="task-table__text-ellipsis" title={task.start_date || task.startDate ? new Date(task.start_date || task.startDate || '').toLocaleDateString() : 'No start date'}>
                          {task.start_date || task.startDate ? new Date(task.start_date || task.startDate || '').toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: '2-digit' }) : '—'}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-900 task-table__cell-clip">
                        <div className="task-table__text-ellipsis" title={task.end_date || task.endDate ? new Date(task.end_date || task.endDate || '').toLocaleDateString() : 'No due date'}>
                          {task.end_date || task.endDate ? new Date(task.end_date || task.endDate || '').toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: '2-digit' }) : '—'}
                        </div>
                      </td>
                      <td className={`px-3 py-3 task-table__progress-cell ${canManageTasks ? 'task-table__progress-cell--admin' : ''}`} onClick={(e) => e.stopPropagation()}>
                        <div className={`task-table__progress-inner ${canManageTasks ? 'task-table__progress-inner--admin' : ''}`}>
                          <div className="task-table__progress-bar-row">
                            <div className="task-table__progress-bar-track">
                              <div
                                className="task-table__progress-bar-fill"
                                style={{ width: `${displayProgress}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600 shrink-0 tabular-nums">{displayProgress}%</span>
                          </div>
                          <div className={`task-table__action-buttons ${canManageTasks ? 'task-table__action-buttons--admin' : ''}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="task-table__action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              openTaskDetail(task.id);
                            }}
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          
                          {canManageTasks && task.status === 'under-review' ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="task-table__action-btn text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApproveTask(task);
                                }}
                                title="Approve Task"
                              >
                                <CheckSquare className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="task-table__action-btn text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDenyTask(task);
                                }}
                                title="Deny Task"
                              >
                                <AlertTriangle className="w-4 h-4" />
                              </Button>
                            </>
                          ) : canManageTasks ? (
                            <>
                              <span className="task-table__action-slot" aria-hidden />
                              <span className="task-table__action-slot" aria-hidden />
                            </>
                          ) : null}
                          
                          {canManageTasks && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="task-table__action-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditTask(task);
                                }}
                                title="Edit Task"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="task-table__action-btn text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTask(task);
                                }}
                                title="Delete Task"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          </div>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          <div className="px-4 sm:px-6 py-4 border-t border-gray-200">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center justify-center lg:justify-start">
                {displayTotalTasks > 0 && (
                  <span className="text-sm text-gray-700 text-center lg:text-left">
                    Showing {((effectivePage - 1) * pageSize) + 1} to {Math.min(effectivePage * pageSize, displayTotalTasks)} of {displayTotalTasks} tasks
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {displayTotalPages > 1 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(1)}
                      disabled={effectivePage === 1}
                    >
                      First
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(effectivePage - 1)}
                      disabled={effectivePage === 1}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: Math.min(5, displayTotalPages) }, (_, i) => {
                        let pageNum;
                        if (displayTotalPages <= 5) {
                          pageNum = i + 1;
                        } else if (effectivePage <= 3) {
                          pageNum = i + 1;
                        } else if (effectivePage >= displayTotalPages - 2) {
                          pageNum = displayTotalPages - 4 + i;
                        } else {
                          pageNum = effectivePage - 2 + i;
                        }
                        // Clamp to valid range
                        if (pageNum < 1 || pageNum > displayTotalPages) return null;
                        return (
                          <Button
                            key={pageNum}
                            variant={effectivePage === pageNum ? "primary" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className="w-8 h-8 p-0"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(effectivePage + 1)}
                      disabled={effectivePage === displayTotalPages}
                    >
                      Next
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(displayTotalPages)}
                      disabled={effectivePage === displayTotalPages}
                    >
                      Last
                    </Button>
                  </>
                )}
              </div>
              <div className="flex items-center justify-center lg:justify-end gap-2">
                <span className="text-sm text-gray-700">Page size:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
        </>
      )}

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingTask(null);
        }}
        onSubmit={handleCreateTask}
        users={teamMembers}
        teams={teams}
        skills={skills}
        projects={projects}
        stages={stages}
        grades={grades}
        books={books}
        units={units}
        lessons={lessons}
        editingTask={editingTask}
      />

      {/* Bulk Delete Confirmation Modal */}
      <Modal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        title="Confirm Bulk Delete"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Delete {selectedTasks.size} task{selectedTasks.size !== 1 ? 's' : ''}?
              </h3>
              <p className="text-sm text-gray-500">
                This action cannot be undone. The selected tasks will be permanently deleted.
              </p>
            </div>
          </div>

          {selectedTasks.size > 0 && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Tasks to be deleted:</h4>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {Array.from(selectedTasks).map(taskId => {
                  const task = filteredTasks.find(t => t.id.toString() === taskId);
                  return task ? (
                    <div key={taskId} className="text-sm text-gray-600 flex items-center">
                      <span className="w-2 h-2 bg-red-400 rounded-full mr-2"></span>
                      {task.name}
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsBulkDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleBulkDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete {selectedTasks.size} Task{selectedTasks.size !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        isOpen={isBulkUploadModalOpen}
        onClose={() => setIsBulkUploadModalOpen(false)}
        onSuccess={async () => {
          // Refresh task list after successful bulk upload
          await refreshTasksList();
          // Invalidate KPI summary — bulk upload changes counts
          invalidateSummaryCache();
          refreshSummary();
        }}
        projects={projects}
        teamMembers={teamMembers}
      />

      {/* Flag Employee Modal */}
      {flaggingMember && (
        <FlagEmployeeModal
          isOpen={showFlagModal}
          onClose={() => {
            setShowFlagModal(false);
            setFlaggingMember(null);
          }}
          memberId={flaggingMember.id}
          memberName={flaggingMember.name}
          taskId={flaggingMember.taskId}
          taskName={flaggingMember.taskName}
          onSuccess={() => {
            refreshTasksList();
          }}
        />
      )}
    </div>
  );
}

export // Assignee search component
function AssigneeSearch({ users, selectedIds, onToggle }: {
  users: any[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(query.toLowerCase())
  );

  const selected = users.filter(u => selectedIds.includes(u.id.toString()));

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      {/* Selected tags */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selected.map(u => (
            <span key={u.id} className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
              {u.name}
              <button type="button" onClick={() => onToggle(u.id.toString())} className="hover:text-blue-900 font-bold leading-none">&times;</button>
            </span>
          ))}
        </div>
      )}
      {/* Search input */}
      <input
        type="text"
        placeholder="Search assignees..."
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 bottom-full mb-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filtered.length > 0 ? filtered.map(u => {
            const checked = selectedIds.includes(u.id.toString());
            return (
              <div
                key={u.id}
                onClick={() => onToggle(u.id.toString())}
                className={`flex items-center justify-between px-3 py-2 cursor-pointer text-sm hover:bg-blue-50 ${checked ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
              >
                <span>{u.name}</span>
                {checked && <span className="text-blue-600 font-bold">✓</span>}
              </div>
            );
          }) : (
            <div className="px-3 py-2 text-sm text-gray-400">No members found</div>
          )}
        </div>
      )}
    </div>
  );
}

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (task: Partial<Task>) => void;
  users: any[];
  teams: any[];
  skills: any[];
  projects: any[];
  stages: any[];
  grades: any[];
  books: any[];
  units: any[];
  lessons: any[];
  editingTask?: Task | null;
}

type CreateTaskFormData = {
  name: string;
  description: string;
  projectId: string;
  stageId: string;
  gradeId: string;
  bookId: string;
  unitId: string;
  lessonId: string;
  status: TaskStatus;
  assignees: string[];
  teamAssignees: string[];
  skills: string[] | any[];
  priority: Priority;
  estimatedHours: number;
  actualHours: number;
  startDate: string;
  endDate: string;
  server_location: string;
};

const createEmptyTaskFormData = (): CreateTaskFormData => ({
  name: '',
  description: '',
  projectId: '',
  stageId: '',
  gradeId: '',
  bookId: '',
  unitId: '',
  lessonId: '',
  status: 'not-started',
  assignees: [],
  teamAssignees: [],
  skills: [],
  priority: 'medium',
  estimatedHours: 8,
  actualHours: 0,
  startDate: new Date().toISOString().split('T')[0],
  endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  server_location: '',
});

const formatFormDate = (value: string | Date | undefined, fallback: string): string => {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  return value.toISOString().split('T')[0];
};

const taskToFormData = (editingTask: Task): CreateTaskFormData => {
  const skillNames = Array.isArray(editingTask.skills)
    ? editingTask.skills.map((skill: any) => {
        if (typeof skill === 'object' && skill.name) {
          return skill.name;
        }
        if (typeof skill === 'string') {
          return skill;
        }
        return '';
      }).filter(name => name !== '')
    : [];

  const assigneeIds = Array.isArray(editingTask.assignees)
    ? editingTask.assignees.map((assignee: any) => {
        if (typeof assignee === 'object' && assignee.id) {
          return assignee.id.toString();
        }
        return assignee.toString();
      })
    : [];

  return {
    name: editingTask.name,
    description: editingTask.description || '',
    projectId: String(editingTask.project_id || editingTask.projectId || ''),
    stageId: (editingTask.category_stage_id || editingTask.stage_id || editingTask.stageId || '').toString(),
    gradeId: (editingTask.grade_id || editingTask.gradeId || '').toString(),
    bookId: (editingTask.book_id || editingTask.bookId || '').toString(),
    unitId: (editingTask.unit_id || editingTask.unitId || '').toString(),
    lessonId: (editingTask.lesson_id || editingTask.lessonId || '').toString(),
    status: editingTask.status,
    assignees: assigneeIds,
    teamAssignees: Array.isArray(editingTask.teamAssignees)
      ? editingTask.teamAssignees.map((id: any) => id.toString())
      : [],
    skills: skillNames,
    priority: editingTask.priority,
    estimatedHours: editingTask.estimated_hours || editingTask.estimatedHours || 8,
    actualHours: editingTask.actual_hours || editingTask.actualHours || 0,
    startDate: formatFormDate(
      editingTask.start_date || editingTask.startDate,
      new Date().toISOString().split('T')[0]
    ),
    endDate: formatFormDate(
      editingTask.end_date || editingTask.endDate,
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    ),
    server_location: editingTask.server_location || '',
  };
};

export function CreateTaskModal({ isOpen, onClose, onSubmit, users, teams, skills, projects, stages: _stages, grades, books, units, lessons, editingTask }: CreateTaskModalProps) {
  const [formData, setFormData] = useState<CreateTaskFormData>(createEmptyTaskFormData);

  // State for project-specific stages
  const [projectStages, setProjectStages] = useState<any[]>([]);
  const [loadingStages, setLoadingStages] = useState(false);

  // Function to fetch stages for the selected project's category
  const fetchProjectStages = async (projectId: string) => {
    if (!projectId) {
      setProjectStages([]);
      return;
    }

    try {
      setLoadingStages(true);
      const selectedProject = projects.find(p => p.id === parseInt(projectId) || p.id === projectId);

      if (selectedProject && selectedProject.category_id) {
        // Fetch stages for this project's category
        const stagesData = await stageService.getByCategory(selectedProject.category_id);
        setProjectStages(stagesData);
      } else {
        setProjectStages([]);
      }
    } catch (error) {
      console.error('❌ Failed to fetch project stages:', error);
      setProjectStages([]);
    } finally {
      setLoadingStages(false);
    }
  };

  // Fetch stages when project changes
  useEffect(() => {
    if (formData.projectId) {
      fetchProjectStages(formData.projectId);
    } else {
      setProjectStages([]);
    }
  }, [formData.projectId]);

  // Reset or populate form each time the modal opens (fixes stale hierarchy on consecutive creates).
  useEffect(() => {
    if (!isOpen) return;

    if (editingTask) {
      setFormData(taskToFormData(editingTask));
    } else {
      setFormData(createEmptyTaskFormData());
    }
  }, [isOpen, editingTask]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Build educational hierarchy path for display
    let educationalPath = '';
    const selectedProject = projects.find(p => p.id === parseInt(formData.projectId) || p.id === formData.projectId);
    if (selectedProject && formData.gradeId) {
      const grade = selectedProject.grades?.find((g: any) => g.id === formData.gradeId);
      if (grade) {
        educationalPath = grade.name;
        if (formData.bookId) {
          const book = grade.books.find((b: any) => b.id === formData.bookId);
          if (book) {
            educationalPath += ` > ${book.name}`;
            if (formData.unitId) {
              const unit = book.units.find((u: any) => u.id === formData.unitId);
              if (unit) {
                educationalPath += ` > ${unit.name}`;
                if (formData.lessonId) {
                  const lesson = unit.lessons.find((l: any) => l.id === formData.lessonId);
                  if (lesson) {
                    educationalPath += ` > ${lesson.name}`;
                  }
                }
              }
            }
          }
        }
      }
    }

    // Convert skill names back to skill IDs
    const skillIds = formData.skills.map(skillName => {
      const skill = skills.find(s => s.name === skillName);
      return skill ? skill.id : null;
    }).filter(id => id !== null);

    onSubmit({
      ...formData,
      skills: skillIds, // Use skill IDs instead of names
      // progress will be auto-calculated by backend based on status
      componentPath: educationalPath, // Keep componentPath for backend compatibility
      startDate: new Date(formData.startDate),
      endDate: new Date(formData.endDate),
      server_location: formData.server_location,
    });
  };

  const toggleAssignee = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      assignees: prev.assignees.includes(userId)
        ? prev.assignees.filter(id => id !== userId)
        : [...prev.assignees, userId]
    }));
  };

  const _toggleTeamAssignee = async (teamId: string) => {

    try {
      // Fetch team members from API
      const teamMembers = await teamService.getTeamMembers(teamId);
      const teamMembersArray = teamMembers.data || teamMembers;

      setFormData(prev => {
        const isTeamSelected = prev.teamAssignees.includes(teamId);

        // Find the team
        const team = teams.find(t => t.id === parseInt(teamId));

        if (!team) {
          return prev;
        }

        // Get team member IDs from the API response
        const teamMemberIds = teamMembersArray.map((member: any) => member.id.toString());

        let newAssignees = [...prev.assignees];

        if (isTeamSelected) {
          // Remove team - uncheck all team members
          newAssignees = newAssignees.filter(id => !teamMemberIds.includes(id));
        } else {
          // Add team - check all team members (avoid duplicates)
          teamMemberIds.forEach((memberId: string) => {
            if (!newAssignees.includes(memberId)) {
              newAssignees.push(memberId);
            }
          });
        }


        return {
          ...prev,
          assignees: newAssignees,
          teamAssignees: isTeamSelected
            ? prev.teamAssignees.filter(id => id !== teamId)
            : [...prev.teamAssignees, teamId]
        };
      });
    } catch (error) {
      console.error('❌ Error fetching team members:', error);
      // Fallback to simple toggle without member expansion
      setFormData(prev => {
        const isTeamSelected = prev.teamAssignees.includes(teamId);
        return {
          ...prev,
          teamAssignees: isTeamSelected
            ? prev.teamAssignees.filter(id => id !== teamId)
            : [...prev.teamAssignees, teamId]
        };
      });
    }
  };

  const _toggleSkill = (skillName: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.includes(skillName)
        ? prev.skills.filter(s => s !== skillName)
        : [...prev.skills, skillName]
    }));
  };

  const selectedProject = projects.find(p => p.id === parseInt(formData.projectId) || p.id === formData.projectId);
  // const availableStages = selectedProject?.stages || [];
  // const availableGrades = selectedProject?.grades || [];
  // const selectedGrade = availableGrades.find((g: any) => g.id === formData.gradeId);
  // const availableBooks = selectedGrade?.books || [];
  // const selectedBook = availableBooks.find((b: any) => b.id === formData.bookId);
  // const availableUnits = selectedBook?.units || [];
  // const selectedUnit = availableUnits.find((u: any) => u.id === formData.unitId);
  // const availableLessons = selectedUnit?.lessons || [];

  // Build availableEducationalHierarchy array for the educational hierarchy selector
  const availableEducationalHierarchy: any[] = [];

  if (selectedProject) {
    // Get grades for this project
    const projectGrades = grades.filter((grade: any) => grade.project_id === parseInt(selectedProject.id));

    // Hierarchy: Project > Grade > Unit > Lesson
    projectGrades.forEach((grade: any) => {
      // Add grade-level entry
      availableEducationalHierarchy.push({
        id: `grade-${grade.id}`,
        name: grade.name,
        type: 'grade',
        gradeId: grade.id,
        bookId: null,
        unitId: null,
        lessonId: null
      });

      // Get all books for this grade
      const gradeBooks = books.filter((book: any) => book.grade_id === grade.id);

      // Iterate books to preserve Grade > Book > Unit > Lesson display
      gradeBooks.forEach((book: any) => {
        // Add book-level entry
        availableEducationalHierarchy.push({
          id: `grade-${grade.id}-book-${book.id}`,
          name: `${grade.name} > ${book.name}`,
          type: 'book',
          gradeId: grade.id,
          bookId: book.id,
          unitId: null,
          lessonId: null
        });

        const bookUnits = units.filter((unit: any) => unit.book_id === book.id);

        bookUnits.forEach((unit: any) => {
          availableEducationalHierarchy.push({
            id: `grade-${grade.id}-book-${book.id}-unit-${unit.id}`,
            name: `${grade.name} > ${book.name} > ${unit.name}`,
            type: 'unit',
            gradeId: grade.id,
            bookId: book.id,
            unitId: unit.id,
            lessonId: null
          });

          // Get lessons for this unit
          const unitLessons = lessons.filter((lesson: any) => lesson.unit_id === unit.id);

          unitLessons.forEach((lesson: any) => {
            availableEducationalHierarchy.push({
              id: `grade-${grade.id}-book-${book.id}-unit-${unit.id}-lesson-${lesson.id}`,
              name: `${grade.name} > ${book.name} > ${unit.name} > ${lesson.name}`,
              type: 'lesson',
              gradeId: grade.id,
              bookId: book.id,
              unitId: unit.id,
              lessonId: lesson.id
            });
          });
        });
      });
    });
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editingTask ? `Edit Task: ${editingTask.name}` : "Create New Task"} size="xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Task Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter task name"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="Task description"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Project *
            </label>
            <select
              required
              value={formData.projectId}
              onChange={(e) => {
                setFormData((prev) => ({
                  ...prev,
                  projectId: e.target.value,
                  stageId: '',
                  gradeId: '',
                  bookId: '',
                  unitId: '',
                  lessonId: '',
                }));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Project</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stage *
            </label>
            <select
              required
              value={formData.stageId}
              onChange={(e) => setFormData({ ...formData, stageId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={!formData.projectId || loadingStages}
            >
              <option value="">
                {loadingStages ? 'Loading stages...' : 'Select Stage'}
              </option>
              {projectStages.map(stage => (
                <option key={stage.id} value={stage.id}>
                  {stage.name} {stage.description && `- ${stage.description}`}
                </option>
              ))}
            </select>
            {!formData.projectId && (
              <p className="text-xs text-gray-500 mt-1">
                Please select a project first to load available stages
              </p>
            )}
            {formData.projectId && projectStages.length === 0 && !loadingStages && (
              <p className="text-xs text-gray-500 mt-1">
                No stages found for this project's category
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Educational Hierarchy (Optional)
            </label>
            <select
              value={(() => {
                // Find the matching educational hierarchy item based on current form data
                const formGradeId = formData.gradeId ? parseInt(formData.gradeId) : null;
                const formBookId = formData.bookId ? parseInt(formData.bookId) : null;
                const formUnitId = formData.unitId ? parseInt(formData.unitId) : null;
                const formLessonId = formData.lessonId ? parseInt(formData.lessonId) : null;

                const matchingHierarchyItem = availableEducationalHierarchy.find(c => {
                  return c.gradeId === formGradeId &&
                    c.bookId === formBookId &&
                    c.unitId === formUnitId &&
                    c.lessonId === formLessonId;
                });

                return matchingHierarchyItem ? matchingHierarchyItem.id : '';
              })()}
              onChange={(e) => {
                const selectedHierarchyItem = availableEducationalHierarchy.find(c => c.id === e.target.value);
                if (selectedHierarchyItem) {
                  setFormData({
                    ...formData,
                    gradeId: selectedHierarchyItem.gradeId ? selectedHierarchyItem.gradeId.toString() : '',
                    bookId: selectedHierarchyItem.bookId ? selectedHierarchyItem.bookId.toString() : '',
                    unitId: selectedHierarchyItem.unitId ? selectedHierarchyItem.unitId.toString() : '',
                    lessonId: selectedHierarchyItem.lessonId ? selectedHierarchyItem.lessonId.toString() : ''
                  });
                } else {
                  setFormData({
                    ...formData,
                    gradeId: '',
                    bookId: '',
                    unitId: '',
                    lessonId: ''
                  });
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={!formData.projectId}
            >
              <option value="">Project Level Task</option>
              {availableEducationalHierarchy.map(component => (
                <option key={component.id} value={component.id}>
                  {component.name} ({component.type})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Select a specific educational hierarchy item to assign this task to a particular grade, unit, or lesson
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            {editingTask && isResubmissionWorkflowStatus(editingTask.status) ? (
              <div className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
                <p className="text-sm font-medium text-gray-900">
                  {getTaskStatusLabel(editingTask.status)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Rework status is preserved when you save other fields.
                </p>
              </div>
            ) : (
              <select
                value={formData.status}
                onChange={(e) => {
                  const newStatus = e.target.value as TaskStatus;
                  setFormData({ ...formData, status: newStatus });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="not-started">Not Started</option>
                <option value="in-progress">In Progress</option>
                <option value="under-review">Under Review</option>
                <option value="completed">Completed</option>
                <option value="blocked">Blocked</option>
                <option value="on-hold">On Hold</option>
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priority
            </label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as Priority })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Progress (Auto-calculated)
              </label>
              <span className="text-sm text-blue-600 font-semibold">
                {calculateTaskProgress(formData.status)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${calculateTaskProgress(formData.status)}%` }}
              />
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Progress is automatically calculated based on task status
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estimated Hours
            </label>
            <input
              type="number"
              min="1"
              value={formData.estimatedHours}
              onChange={(e) => setFormData({ ...formData, estimatedHours: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {editingTask && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Actual Hours
              </label>
              <input
                type="number"
                min="0"
                value={formData.actualHours}
                onChange={(e) => setFormData({ ...formData, actualHours: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Due Date
            </label>
            <input
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Individual Assignees
            </label>
            <AssigneeSearch
              users={users || []}
              selectedIds={formData.assignees}
              onToggle={toggleAssignee}
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              File Location
            </label>
            <input
              type="text"
              value={formData.server_location}
              onChange={(e) => setFormData({ ...formData, server_location: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g. \\Server\Projects\Byline\Assets or /mnt/projects/byline"
            />
            <p className="text-xs text-gray-500 mt-1">
              Team members will see this path to locate the relevant files for this task.
            </p>
          </div>
        </div>

        {/* <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Team Assignees (Auto-selects all team members)
          </label>
          <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border border-gray-300 rounded-lg p-2">
            {teams.map(team => (
              <label key={team.id} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.teamAssignees.includes(team.id)}
                  onChange={() => toggleTeamAssignee(team.id)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{team.name}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Selecting a team will automatically check all its members in the Individual Assignees list above
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Required Skills
          </label>
          <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto border border-gray-300 rounded-lg p-2">
            {skills.map(skill => {
              const isChecked = formData.skills.includes(skill.name);
              return (
                <label key={skill.id} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleSkill(skill.name)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{skill.name}</span>
                </label>
              );
            })}
          </div>
        </div> */}

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            {editingTask ? 'Update Task' : 'Create Task'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}