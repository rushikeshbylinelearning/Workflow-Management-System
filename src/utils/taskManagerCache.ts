/**
 * In-memory cache for TaskManager reference data and session flags.
 * Survives TaskManager unmount (e.g. leaving Tasks via sidebar) without refetching
 * on every remount within the same browser session.
 */

const CACHE_TTL_MS = 5 * 60 * 1000;

export interface TaskManagerReferenceCache {
  teamMembers: any[];
  teams: any[];
  stages: any[];
  projects: any[];
  skills: any[];
  grades: any[];
  books: any[];
  units: any[];
  lessons: any[];
  loadedAt: number;
  scope: string;
}

let referenceCache: TaskManagerReferenceCache | null = null;
let tasksSessionInitialized = false;
let allTasksCache: any[] = [];
let allTasksCacheKey: string | null = null;

export function buildTaskStatsCacheKey(opts: {
  adminUserId?: number | null;
  teamMemberId?: number | null;
}): string {
  if (opts.adminUserId) return `admin:${opts.adminUserId}`;
  if (opts.teamMemberId) return `team:${opts.teamMemberId}`;
  return 'guest';
}

export function getTaskManagerReferenceCache(scope?: string): TaskManagerReferenceCache | null {
  if (!referenceCache) return null;
  if (scope && referenceCache.scope !== scope) return null;
  if (Date.now() - referenceCache.loadedAt > CACHE_TTL_MS) {
    referenceCache = null;
    return null;
  }
  return referenceCache;
}

export function setTaskManagerReferenceCache(
  data: Omit<TaskManagerReferenceCache, 'loadedAt'>,
): void {
  referenceCache = { ...data, loadedAt: Date.now() };
}

export function clearTaskManagerReferenceCache(): void {
  referenceCache = null;
}

export function isTasksSessionInitialized(): boolean {
  return tasksSessionInitialized;
}

export function markTasksSessionInitialized(): void {
  tasksSessionInitialized = true;
}

export function getAllTasksCache(cacheKey?: string): any[] | null {
  if (!cacheKey || cacheKey !== allTasksCacheKey) return null;
  return allTasksCache;
}

export function setAllTasksCache(cacheKey: string, tasks: any[]): void {
  allTasksCacheKey = cacheKey;
  allTasksCache = tasks;
}

export function clearTaskManagerSessionCache(): void {
  referenceCache = null;
  tasksSessionInitialized = false;
  allTasksCacheKey = null;
  allTasksCache = [];
}

export const TASKS_LIST_REFRESH_EVENT = 'tasks-list-refresh';
export const PROJECT_TASKS_REFRESH_EVENT = 'project-tasks-refresh';

export interface ProjectTasksRefreshDetail {
  projectId: string | number;
  taskId?: string | number | null;
  action?: string;
}

export function requestTasksListRefresh(): void {
  window.dispatchEvent(new CustomEvent(TASKS_LIST_REFRESH_EVENT));
}

export function requestProjectTasksRefresh(
  projectId: string | number,
  detail?: Omit<ProjectTasksRefreshDetail, 'projectId'>
): void {
  window.dispatchEvent(
    new CustomEvent<ProjectTasksRefreshDetail>(PROJECT_TASKS_REFRESH_EVENT, {
      detail: {
        projectId,
        ...detail,
      },
    })
  );
}
