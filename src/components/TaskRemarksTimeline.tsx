import { useCallback, useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { formatTimeAgo } from '../utils/formatTimeAgo';
import { formatTimelineTimestamp } from '../utils/formatTimelineTimestamp';

export interface RemarkTimelineEntry {
  id: string;
  user: string;
  role: string;
  action: string;
  action_type?: string;
  remark: string;
  timestamp: string;
  rework_count?: number | null;
}

interface RemarksHistoryFetcher {
  getRemarksHistory: (
    taskId: string | number,
    params?: { page?: number; limit?: number }
  ) => Promise<{ timeline: RemarkTimelineEntry[]; pagination?: { hasMore?: boolean } }>;
}

interface TaskRemarksTimelineProps {
  taskId: number;
  fetcher: RemarksHistoryFetcher;
  refreshToken?: number;
  optimisticEntry?: RemarkTimelineEntry | null;
}

function actionBadgeClass(actionType?: string, actionLabel?: string): string {
  const key = (actionType || actionLabel || '').toLowerCase();
  if (key.includes('approved') || key === 'completed') {
    return 'bg-green-100 text-green-800 border-green-200';
  }
  if (key.includes('denied')) {
    return 'bg-red-100 text-red-800 border-red-200';
  }
  if (key.includes('submitted')) {
    return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  }
  if (key.includes('remark')) {
    return 'bg-blue-100 text-blue-800 border-blue-200';
  }
  if (key.includes('reopened')) {
    return 'bg-orange-100 text-orange-800 border-orange-200';
  }
  if (key.includes('returned_for_rework') || key.includes('returned for redo') || key.includes('resubmit')) {
    return 'bg-amber-100 text-amber-900 border-amber-200';
  }
  return 'bg-gray-100 text-gray-700 border-gray-200';
}

function TimelineSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-hidden>
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3">
          <div className="w-9 h-9 rounded-full bg-gray-200 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-gray-200 rounded w-2/3" />
            <div className="h-3 bg-gray-200 rounded w-full" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TaskRemarksTimeline({
  taskId,
  fetcher,
  refreshToken = 0,
  optimisticEntry = null,
}: TaskRemarksTimelineProps) {
  const [entries, setEntries] = useState<RemarkTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mergeOptimistic = useCallback(
    (list: RemarkTimelineEntry[]) => {
      if (!optimisticEntry) return list;
      if (list.some((e) => e.id === optimisticEntry.id)) return list;
      return [...list, optimisticEntry];
    },
    [optimisticEntry]
  );

  const loadTimeline = useCallback(
    async (pageNum: number, append: boolean) => {
      try {
        if (append) setLoadingMore(true);
        else setLoading(true);
        setError(null);

        const result = await fetcher.getRemarksHistory(taskId, { page: pageNum, limit: 20 });
        const timeline = result.timeline || [];

        setEntries((prev) => {
          const merged = append ? [...prev, ...timeline] : timeline;
          const seen = new Set<string>();
          return mergeOptimistic(merged.filter((item) => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          }));
        });
        setHasMore(!!result.pagination?.hasMore);
        setPage(pageNum);
      } catch (err) {
        console.error('Failed to load remarks timeline:', err);
        setError('Could not load review history.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [taskId, fetcher, mergeOptimistic]
  );

  useEffect(() => {
    loadTimeline(1, false);
  }, [taskId, refreshToken, loadTimeline]);

  useEffect(() => {
    if (!optimisticEntry) return;
    setEntries((prev) => mergeOptimistic(prev));
  }, [optimisticEntry, mergeOptimistic]);

  const initials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
  };

  return (
    <Card className="w-full lg:sticky lg:top-4 lg:self-start border-gray-200 shadow-sm min-h-[280px]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="w-5 h-5 text-gray-600" />
          <span>Review &amp; Remarks History</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <TimelineSkeleton />
        ) : error ? (
          <p className="text-sm text-red-600 text-center py-6">{error}</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No remarks yet</p>
        ) : (
          <div
            className="max-h-[min(70vh,520px)] overflow-y-auto pr-1 -mr-1 space-y-0"
            role="log"
            aria-label="Task remarks timeline"
          >
            {entries.map((entry, index) => (
              <div
                key={entry.id}
                className={`relative pl-6 pb-5 ${index < entries.length - 1 ? 'border-l-2 border-gray-200 ml-4' : 'ml-4'}`}
              >
                <span
                  className="absolute left-0 top-1 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-gray-300"
                  aria-hidden
                />
                <div className="flex gap-3">
                  <div
                    className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-semibold shrink-0"
                    aria-hidden
                  >
                    {initials(entry.user)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className="text-sm font-medium text-gray-900 truncate">{entry.user}</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {entry.role}
                      </Badge>
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${actionBadgeClass(entry.action_type, entry.action)}`}
                      >
                        {entry.action}
                      </span>
                    </div>
                    {entry.action_type === 'returned_for_rework' && entry.rework_count != null && entry.rework_count > 0 ? (
                      <p className="text-xs font-medium text-amber-800 mb-1">
                        Rework round {entry.rework_count}
                      </p>
                    ) : null}
                    {entry.remark ? (
                      <p className="text-sm text-gray-700 whitespace-pre-wrap break-words mb-2">
                        {entry.remark}
                      </p>
                    ) : null}
                    <div className="text-xs text-gray-500">
                      <span>{formatTimelineTimestamp(entry.timestamp)}</span>
                      <span className="mx-1.5 text-gray-300">·</span>
                      <span>{formatTimeAgo(entry.timestamp)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && hasMore && (
          <div className="pt-3 border-t border-gray-100 mt-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              disabled={loadingMore}
              onClick={() => loadTimeline(page + 1, true)}
            >
              {loadingMore ? 'Loading…' : 'Load older entries'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
