/**
 * useDashboardSummary
 *
 * Fetches aggregated task counts from GET /api/tasks/dashboard-summary.
 * Never loads the full task list — just returns the 8 counts the KPI
 * cards need.
 *
 * Features:
 *  - Debounced requests (300 ms) so rapid filter changes don't hammer the API
 *  - AbortController cancels in-flight requests when filters change
 *  - Client-side TTL cache (60 s) to avoid redundant refetches
 *  - Manual `refresh()` function for post-mutation invalidation
 */

import { useEffect, useRef, useCallback, useState } from 'react';

export interface DashboardSummary {
  totalTasks: number;
  notStarted: number;
  inProgress: number;
  underReview: number;
  completed: number;
  overdue: number;
  resubmitted: number;
  returned: number;
}

const EMPTY_SUMMARY: DashboardSummary = {
  totalTasks: 0,
  notStarted: 0,
  inProgress: 0,
  underReview: 0,
  completed: 0,
  overdue: 0,
  resubmitted: 0,
  returned: 0,
};

const DEBOUNCE_MS = 300;
const CLIENT_TTL_MS = 60_000; // 60 s — matches server-side cache TTL

// ─── Tiny client-side cache ────────────────────────────────────────────────
interface CacheEntry {
  data: DashboardSummary;
  expiresAt: number;
}
const summaryCache = new Map<string, CacheEntry>();

function getCached(key: string): DashboardSummary | null {
  const entry = summaryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    summaryCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key: string, data: DashboardSummary): void {
  summaryCache.set(key, { data, expiresAt: Date.now() + CLIENT_TTL_MS });
}

export function invalidateSummaryCache(): void {
  summaryCache.clear();
}

// ─── Build query string from filters ──────────────────────────────────────
function buildQueryString(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && v !== 'all' && v !== '') qs.set(k, v);
  }
  return qs.toString();
}

// ─── Auth headers (mirrors apiService.ts) ─────────────────────────────────
function getAuthHeaders(): Record<string, string> {
  const token =
    sessionStorage.getItem('access_token') ||
    sessionStorage.getItem('teamToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ─── API base URL (mirrors apiService.ts) ─────────────────────────────────
const API_URL = (() => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) {
    return (import.meta as any).env.VITE_API_URL as string;
  }
  return 'https://workflow.bylinelms.com/api';
})();

// ─── Filter params type ───────────────────────────────────────────────────
export interface SummaryFilterParams {
  project_id?: string;
  team_id?: string;
  assignee_id?: string;
  assigneeIdIn?: string;
  stage_id?: string;
  grade_id?: string;
  book_id?: string;
  unit_id?: string;
  lesson_id?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  search?: string;
  priority?: string;
  priorityIn?: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────
export function useDashboardSummary(filters: SummaryFilterParams = {}) {
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs so the effect closure always sees the latest values without
  // causing re-subscriptions.
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [refreshTick, setRefreshTick] = useState(0); // bump to force a refresh

  const filterKey = buildQueryString(filters as Record<string, string | undefined>);

  const fetchSummary = useCallback(
    async (signal: AbortSignal, key: string) => {
      // Check client-side cache first
      const cached = getCached(key);
      if (cached) {
        setSummary(cached);
        setLoading(false);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        const endpoint = key
          ? `${API_URL}/tasks/dashboard-summary?${key}`
          : `${API_URL}/tasks/dashboard-summary`;

        const res = await fetch(endpoint, {
          method: 'GET',
          headers: getAuthHeaders(),
          cache: 'no-store',
          signal,
        });

        if (signal.aborted) return;

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error?.message || `HTTP ${res.status}`);
        }

        const json = await res.json();
        const data: DashboardSummary = json?.data ?? EMPTY_SUMMARY;

        setCached(key, data);
        setSummary(data);
        setError(null);
      } catch (err: any) {
        if (err.name === 'AbortError' || signal.aborted) return;
        console.error('[useDashboardSummary] fetch error:', err);
        setError(err.message || 'Failed to load summary');
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [] // stable — no deps needed because we use params directly
  );

  useEffect(() => {
    // Cancel previous debounce timer
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();

    // Show loading immediately so skeleton appears right away
    setLoading(true);

    debounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;
      void fetchSummary(controller.signal, filterKey);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [filterKey, fetchSummary, refreshTick]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Force a fresh fetch (call after task mutations).
   * Clears the client cache for the current filter key and re-fetches.
   */
  const refresh = useCallback(() => {
    invalidateSummaryCache();
    setRefreshTick((t) => t + 1);
  }, []);

  return { summary, loading, error, refresh };
}
