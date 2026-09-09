/**
 * KanbanView — Assignee Kanban board for the "My Tasks" dashboard.
 *
 * Redesigned for a modern, enterprise-grade aesthetic inspired by
 * Linear, ClickUp 3.0, and Jira Cloud — while preserving all existing
 * business logic, API contracts, and bucket classification.
 *
 * Columns (left → right)
 * ──────────────────────────────────────────────────────────────────
 *  1. Active Tasks          – in-progress, not-started, assigned, etc.
 *  2. Returned for Rework   – tasks admin/PM sent back for corrections
 *  3. Overdue               – past due (excludes submitted / rework)
 *  4. Under Review          – submitted by assignee, awaiting approval
 *  5. Recent Completions    – latest 5 completed tasks
 * ──────────────────────────────────────────────────────────────────
 *  + Full-width Upcoming timeline strip below the board
 */

import { useMemo, memo } from 'react';
import {
  AlertTriangle,
  Award,
  Calendar,
  CheckCircle,
  CheckSquare,
  Clock,
  Eye,
  RotateCcw,
  Sparkles,
  User,
} from 'lucide-react';
import type { Task } from '../types';
import type { KanbanBucket } from '../utils/taskClassifier';
import {
  getActiveTasks,
  getCompletedTasks,
  getOverdueTasks,
  getReworkTasks,
  getUnderReviewTasks,
  getUpcomingTasks,
  getDaysUntilStart,
} from '../utils/taskClassifier';
import { getTaskDisplayProgress } from '../utils/taskProgressDisplay';
import { KanbanTaskCard } from './KanbanTaskCard';
import { Badge } from './ui/Badge';

// ─────────────────────────────────────────────────────────────────────────────
// Column config — visual identity per bucket
// ─────────────────────────────────────────────────────────────────────────────

interface ColumnConfig {
  key: KanbanBucket;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: {
    topBorder: string;      // border-t colour class
    headerBg: string;       // column header background
    colBg: string;          // column body background (very light tint)
    iconColor: string;      // icon colour
    titleColor: string;     // header title colour
    badgeBg: string;        // count badge background
    badgeText: string;      // count badge text
    emptyIcon: string;      // empty state icon opacity colour
  };
  emptyTitle: string;
  emptyDescription: string;
  tooltip?: string;
}

const COLUMNS: ColumnConfig[] = [
  {
    key: 'ACTIVE',
    label: 'Active Tasks',
    icon: CheckSquare,
    accent: {
      topBorder: 'border-t-blue-500',
      headerBg: 'bg-blue-50/70',
      colBg: 'bg-blue-50/30',
      iconColor: 'text-blue-600',
      titleColor: 'text-blue-900',
      badgeBg: 'bg-blue-600',
      badgeText: 'text-white',
      emptyIcon: 'text-blue-300',
    },
    emptyTitle: "You're all caught up.",
    emptyDescription: 'No active tasks assigned.',
    tooltip: 'Tasks currently in progress or not yet started',
  },
  {
    key: 'REWORK',
    label: 'Returned for Rework',
    icon: RotateCcw,
    accent: {
      topBorder: 'border-t-amber-500',
      headerBg: 'bg-amber-50/70',
      colBg: 'bg-amber-50/30',
      iconColor: 'text-amber-600',
      titleColor: 'text-amber-900',
      badgeBg: 'bg-amber-500',
      badgeText: 'text-white',
      emptyIcon: 'text-amber-300',
    },
    emptyTitle: 'No rework tasks.',
    emptyDescription: 'No tasks have been returned for corrections.',
    tooltip: 'Tasks sent back by admin or PM for corrections',
  },
  {
    key: 'OVERDUE',
    label: 'Overdue',
    icon: AlertTriangle,
    accent: {
      topBorder: 'border-t-red-500',
      headerBg: 'bg-red-50/70',
      colBg: 'bg-red-50/30',
      iconColor: 'text-red-600',
      titleColor: 'text-red-900',
      badgeBg: 'bg-red-600',
      badgeText: 'text-white',
      emptyIcon: 'text-red-300',
    },
    emptyTitle: 'No overdue tasks.',
    emptyDescription: "You're on track with all deadlines.",
    tooltip: 'Tasks past their due date that have not been submitted',
  },
  {
    key: 'UNDER_REVIEW',
    label: 'Under Review',
    icon: Eye,
    accent: {
      topBorder: 'border-t-orange-500',
      headerBg: 'bg-orange-50/70',
      colBg: 'bg-orange-50/30',
      iconColor: 'text-orange-600',
      titleColor: 'text-orange-900',
      badgeBg: 'bg-orange-500',
      badgeText: 'text-white',
      emptyIcon: 'text-orange-300',
    },
    emptyTitle: 'No submissions pending.',
    emptyDescription: 'No tasks are awaiting approval.',
    tooltip: 'Tasks you have submitted — waiting for PM / Admin approval',
  },
  {
    key: 'COMPLETED',
    label: 'Recent Completions',
    icon: Award,
    accent: {
      topBorder: 'border-t-green-500',
      headerBg: 'bg-green-50/70',
      colBg: 'bg-green-50/30',
      iconColor: 'text-green-600',
      titleColor: 'text-green-900',
      badgeBg: 'bg-green-600',
      badgeText: 'text-white',
      emptyIcon: 'text-green-300',
    },
    emptyTitle: 'No completed tasks yet.',
    emptyDescription: 'Completed tasks will appear here.',
    tooltip: 'Latest 5 approved / completed tasks',
  },
];
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  title,
  description,
  iconColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  iconColor: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-2 select-none">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-1 bg-white/60 shadow-sm`}>
        <Icon className={`w-7 h-7 ${iconColor} opacity-60`} />
      </div>
      <p className="text-sm font-semibold text-gray-600">{title}</p>
      <p className="text-xs text-gray-400 leading-relaxed max-w-[160px]">{description}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Column header
// ─────────────────────────────────────────────────────────────────────────────

function ColumnHeader({
  config,
  count,
}: {
  config: ColumnConfig;
  count: number;
}) {
  const { label, icon: Icon, accent, tooltip } = config;
  return (
    <div
      className={`kanban-column-header flex items-center justify-between px-4 py-3 ${accent.headerBg} border-b border-black/5`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`p-1.5 rounded-lg bg-white/70 shadow-sm shrink-0`}>
          <Icon className={`w-3.5 h-3.5 ${accent.iconColor}`} aria-hidden />
        </div>
        <h3
          className={`text-sm font-semibold truncate ${accent.titleColor} tracking-tight`}
          title={tooltip}
        >
          {label}
        </h3>
      </div>
      <span
        className={`kanban-count-badge inline-flex items-center justify-center min-w-[26px] h-[22px] px-2 rounded-full text-xs font-bold shrink-0 ml-2 ${accent.badgeBg} ${accent.badgeText} shadow-sm`}
        aria-label={`${count} tasks`}
      >
        {count}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Kanban column
// ─────────────────────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  config: ColumnConfig;
  tasks: Task[];
  onView: (task: Task) => void;
  onAddRemark?: (task: Task) => void;
  onRequestExtension?: (task: Task) => void;
}

const KanbanColumn = memo(function KanbanColumn({
  config,
  tasks,
  onView,
  onAddRemark,
  onRequestExtension,
}: KanbanColumnProps) {
  const { key, accent, emptyTitle, emptyDescription, icon } = config;

  return (
    <section
      className={[
        'kanban-column flex flex-col rounded-2xl overflow-hidden',
        'border-t-[3px]',
        accent.topBorder,
        accent.colBg,
        'shadow-kanban',
        'w-full min-w-[272px]',
      ].join(' ')}
      aria-label={config.label}
    >
      {/* Sticky header */}
      <ColumnHeader config={config} count={tasks.length} />

      {/* Scrollable card list */}
      <div
        className="kanban-col-scroll flex-1 overflow-y-auto px-3 py-3 space-y-2.5 min-h-[200px] max-h-[calc(100vh-300px)]"
      >
        {tasks.length === 0 ? (
          <EmptyState
            icon={icon}
            title={emptyTitle}
            description={emptyDescription}
            iconColor={accent.emptyIcon}
          />
        ) : (
          tasks.map((task) => (
            <KanbanTaskCard
              key={task.id}
              task={task}
              bucket={key}
              onView={onView}
              onAddRemark={onAddRemark}
              onRequestExtension={onRequestExtension}
            />
          ))
        )}
      </div>
    </section>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Upcoming tasks timeline strip
// ─────────────────────────────────────────────────────────────────────────────

const UpcomingStrip = memo(function UpcomingStrip({
  tasks,
  onView,
}: {
  tasks: Task[];
  onView: (task: Task) => void;
}) {
  return (
    <section
      className="kanban-upcoming rounded-2xl overflow-hidden shadow-kanban border-t-[3px] border-t-blue-500"
      style={{ backgroundColor: '#EFF6FF' }}
      aria-label="Upcoming Tasks"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-black/5" style={{ backgroundColor: '#DBEAFE' }}>
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-white/70 shadow-sm shrink-0">
            <Clock className="w-3.5 h-3.5 text-blue-600" aria-hidden />
          </div>
          <h3 className="text-sm font-semibold text-blue-900 tracking-tight">
            Upcoming Tasks
          </h3>
          <span className="hidden sm:inline text-xs text-blue-400 font-normal">
            — tasks with a future start date
          </span>
        </div>
        <span className="inline-flex items-center justify-center min-w-[26px] h-[22px] px-2 rounded-full text-xs font-bold bg-blue-600 text-white shadow-sm">
          {tasks.length}
        </span>
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white/60 shadow-sm">
            <Sparkles className="w-7 h-7 text-blue-300" />
          </div>
          <p className="text-sm font-semibold text-gray-600">No upcoming work scheduled.</p>
          <p className="text-xs text-gray-400">Future tasks will appear here.</p>
        </div>
      ) : (
        <div className="px-5 py-4 overflow-x-auto kanban-col-scroll">
          <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
            {tasks.map((task) => (
              <UpcomingCard key={task.id} task={task} onView={onView} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
});

const UpcomingCard = memo(function UpcomingCard({
  task,
  onView,
}: {
  task: Task;
  onView: (task: Task) => void;
}) {
  const daysUntilStart = getDaysUntilStart(task);
  const progress = getTaskDisplayProgress(task);

  const startLabel =
    daysUntilStart === null
      ? null
      : daysUntilStart === 0
      ? 'Starts today'
      : daysUntilStart === 1
      ? 'Starts tomorrow'
      : `Starts in ${daysUntilStart}d`;

  const dueLabel = task.end_date
    ? `Due ${new Date(task.end_date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })}`
    : null;

  return (
    <article
      className="kanban-card upcoming-card flex flex-col gap-2.5 rounded-xl border border-gray-200/80 border-l-4 border-l-blue-400 shadow-card w-52 shrink-0 p-4 cursor-pointer select-none"
      style={{ backgroundColor: '#EFF6FF' }}
      onClick={() => onView(task)}
      role="button"
      tabIndex={0}
      aria-label={`View upcoming task: ${task.name}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onView(task);
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-[13px] font-semibold text-gray-900 line-clamp-2 flex-1 leading-snug">
          {task.name}
        </h4>
        <PriorityPill priority={task.priority} />
      </div>

      {task.project_name && (
        <p className="text-[11px] text-gray-400 truncate font-medium tracking-wide uppercase">
          {task.project_name}
        </p>
      )}

      {task.assigneeDetails && task.assigneeDetails.length > 0 && (
        <p
          className="text-[11px] text-blue-600 font-semibold truncate flex items-center gap-1"
          title={task.assigneeDetails.map((a) => a.name).join(', ')}
        >
          <User className="w-3 h-3 shrink-0 text-blue-400" aria-hidden />
          {task.assigneeDetails[0].name}
          {task.assigneeDetails.length > 1 && ` +${task.assigneeDetails.length - 1}`}
        </p>
      )}

      <div className="flex flex-col gap-1 text-xs">
        {startLabel && (
          <span className="flex items-center gap-1.5 text-blue-600 font-semibold">
            <Clock className="w-3 h-3 shrink-0" aria-hidden />
            {startLabel}
          </span>
        )}
        {dueLabel && (
          <span className="flex items-center gap-1.5 text-gray-400">
            <Calendar className="w-3 h-3 shrink-0" aria-hidden />
            {dueLabel}
          </span>
        )}
      </div>

      {progress > 0 && (
        <ModernProgressBar value={progress} variant="blue" />
      )}
    </article>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Shared sub-components used across KanbanView and KanbanTaskCard
// ─────────────────────────────────────────────────────────────────────────────

/** Filled pill priority badge */
export function PriorityPill({ priority }: { priority?: string }) {
  const p = (priority || 'low').toLowerCase();
  const normalized = p === 'critical' ? 'urgent' : p;

  const styles: Record<string, string> = {
    urgent: 'bg-red-100 text-red-700 border border-red-200',
    high:   'bg-orange-100 text-orange-700 border border-orange-200',
    medium: 'bg-amber-100 text-amber-700 border border-amber-200',
    low:    'bg-gray-100 text-gray-500 border border-gray-200',
  };

  const label =
    normalized === 'urgent' ? 'Urgent'
    : normalized === 'high'   ? 'High'
    : normalized === 'medium' ? 'Medium'
    : 'Low';

  return (
    <span
      className={`inline-flex items-center shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${styles[normalized] ?? styles.low}`}
    >
      {label}
    </span>
  );
}

/** Modern 8px gradient progress bar */
export function ModernProgressBar({
  value,
  variant = 'blue',
}: {
  value: number;
  variant?: 'blue' | 'red' | 'green' | 'orange' | 'purple';
}) {
  const pct = Math.min(100, Math.max(0, value));

  const gradients: Record<string, string> = {
    blue:   'from-blue-400 to-blue-600',
    red:    'from-red-400 to-red-600',
    green:  'from-green-400 to-green-600',
    orange: 'from-orange-400 to-orange-600',
    purple: 'from-purple-400 to-purple-600',
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-2 rounded-full bg-gradient-to-r ${gradients[variant] ?? gradients.blue} transition-all duration-500`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <span className="text-[11px] text-gray-400 font-medium tabular-nums w-8 text-right">
        {pct}%
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KanbanView — main export
// ─────────────────────────────────────────────────────────────────────────────

export interface KanbanViewProps {
  tasks: Task[];
  onView: (task: Task) => void;
  onAddRemark?: (task: Task) => void;
  onRequestExtension?: (task: Task) => void;
}

export function KanbanView({
  tasks,
  onView,
  onAddRemark,
  onRequestExtension,
}: KanbanViewProps) {
  // Bucket classification — all memoised (logic unchanged)
  const activeTasks = useMemo(() => getActiveTasks(tasks), [tasks]);

  const reworkTasks = useMemo(
    () =>
      getReworkTasks(tasks).sort((a, b) => {
        const aDate = a.updated_at || '';
        const bDate = b.updated_at || '';
        return bDate.localeCompare(aDate);
      }),
    [tasks]
  );

  const overdueTasks = useMemo(
    () =>
      getOverdueTasks(tasks).sort((a, b) => {
        const aEnd = a.end_date || '';
        const bEnd = b.end_date || '';
        return aEnd.localeCompare(bEnd);
      }),
    [tasks]
  );

  const underReviewTasks = useMemo(() => getUnderReviewTasks(tasks), [tasks]);

  const completedTasks = useMemo(() => {
    const all = getCompletedTasks(tasks);
    return all
      .slice()
      .sort((a, b) => {
        const aDate = a.updated_at || a.end_date || '';
        const bDate = b.updated_at || b.end_date || '';
        return bDate.localeCompare(aDate);
      })
      .slice(0, 5);
  }, [tasks]);

  const upcomingTasks = useMemo(
    () =>
      getUpcomingTasks(tasks).sort((a, b) =>
        (a.start_date || '').localeCompare(b.start_date || '')
      ),
    [tasks]
  );

  const bucketMap: Partial<Record<KanbanBucket, Task[]>> = {
    ACTIVE: activeTasks,
    REWORK: reworkTasks,
    OVERDUE: overdueTasks,
    UNDER_REVIEW: underReviewTasks,
    COMPLETED: completedTasks,
  };

  return (
    <div className="kanban-workspace flex flex-col gap-5">
      {/* 5-column board — horizontal scroll on smaller viewports */}
      <div
        className="kanban-board-scroll overflow-x-auto pb-2 -mx-1 px-1"
        role="region"
        aria-label="Kanban board"
      >
        <div
          className={[
            'grid gap-5',
            'grid-cols-1',
            'sm:grid-cols-2',
            'lg:grid-cols-3',
            'xl:grid-cols-5',
            'xl:min-w-[1440px]',
          ].join(' ')}
        >
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.key}
              config={col}
              tasks={bucketMap[col.key] ?? []}
              onView={onView}
              onAddRemark={onAddRemark}
              onRequestExtension={onRequestExtension}
            />
          ))}
        </div>
      </div>

      {/* Upcoming timeline strip */}
      <UpcomingStrip tasks={upcomingTasks} onView={onView} />
    </div>
  );
}
