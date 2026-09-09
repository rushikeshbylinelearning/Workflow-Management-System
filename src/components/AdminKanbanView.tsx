/**
 * AdminKanbanView — Kanban board for the Admin / Project Manager Tasks page.
 *
 * Columns (left → right)
 * ──────────────────────────────────────────────────────────────────
 *  1. All Tasks          – every task that is not in a specialised bucket
 *                          (active, not-started, in-progress, blocked,
 *                           on-hold, overdue — anything that still needs work)
 *  2. Returned for Rework – all tasks returned by admin/PM for corrections
 *                           (status: returned | redo-requested)
 *  3. Overdue             – all tasks past their due date
 *  4. Under Review        – all tasks awaiting admin/PM approval
 *                           (status: under-review | resubmitted)
 *  5. Completed           – ALL completed tasks (no recency cap)
 * ──────────────────────────────────────────────────────────────────
 *  + Full-width Upcoming timeline strip below the board
 *    (tasks whose start_date is in the future)
 *
 * Intentional differences from the team-member KanbanView:
 *  • "Active Tasks" column is replaced by "All Tasks"
 *  • Completed column shows every completed task (not just latest 5)
 *  • No "Add Remark" / "Request Extension" actions (admin doesn't use those)
 *  • Each card's left-border colour reflects its *real* bucket (overdue = red,
 *    under-review = orange, etc.) even when the card sits in "All Tasks"
 */

import { useMemo, memo } from 'react';
import {
  AlertTriangle,
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
  classifyTask,
  getCompletedTasks,
  getOverdueTasks,
  getReworkTasks,
  getUnderReviewTasks,
  getUpcomingTasks,
  getDaysUntilStart,
} from '../utils/taskClassifier';
import { getTaskDisplayProgress } from '../utils/taskProgressDisplay';
import { KanbanTaskCard } from './KanbanTaskCard';
import { PriorityPill, ModernProgressBar } from './KanbanView';

// ─────────────────────────────────────────────────────────────────────────────
// Column config
// ─────────────────────────────────────────────────────────────────────────────

interface AdminColumnConfig {
  key: KanbanBucket;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: {
    topBorder: string;
    headerBg: string;
    colBg: string;
    iconColor: string;
    titleColor: string;
    badgeBg: string;
    badgeText: string;
    emptyIcon: string;
  };
  emptyTitle: string;
  emptyDescription: string;
  tooltip?: string;
}

const ADMIN_COLUMNS: AdminColumnConfig[] = [
  {
    key: 'ALL_TASKS',
    label: 'All Tasks',
    icon: CheckSquare,
    accent: {
      topBorder: 'border-t-slate-500',
      headerBg: 'bg-slate-50/70',
      colBg: 'bg-slate-50/30',
      iconColor: 'text-slate-600',
      titleColor: 'text-slate-900',
      badgeBg: 'bg-slate-600',
      badgeText: 'text-white',
      emptyIcon: 'text-slate-300',
    },
    emptyTitle: 'No tasks found.',
    emptyDescription: 'All tasks matching the current filters will appear here.',
    tooltip: 'All tasks — active, not-started, blocked, on-hold, overdue',
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
    tooltip: 'Tasks returned by admin / PM for corrections (returned | redo-requested)',
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
    emptyDescription: 'All tasks are on track.',
    tooltip: 'Tasks past their due date that have not been submitted or completed',
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
    emptyTitle: 'No tasks under review.',
    emptyDescription: 'No submissions are awaiting approval.',
    tooltip: 'Tasks submitted by assignees awaiting admin / PM approval',
  },
  {
    key: 'COMPLETED',
    label: 'Completed',
    icon: CheckCircle,
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
    tooltip: 'All approved / completed tasks',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
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
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-1 bg-white/60 shadow-sm">
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
  config: AdminColumnConfig;
  count: number;
}) {
  const { label, icon: Icon, accent, tooltip } = config;
  return (
    <div
      className={`kanban-column-header flex items-center justify-between px-4 py-3 ${accent.headerBg} border-b border-black/5`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="p-1.5 rounded-lg bg-white/70 shadow-sm shrink-0">
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
// Column — for the "All Tasks" column we pass each card's *real* bucket
// so it retains its correct border colour, rather than forcing 'ACTIVE'.
// ─────────────────────────────────────────────────────────────────────────────

interface AdminKanbanColumnProps {
  config: AdminColumnConfig;
  /** tasks to display in this column */
  tasks: Task[];
  /** when true, each card receives its real classified bucket (used for All Tasks) */
  usePerTaskBucket?: boolean;
  onView: (task: Task) => void;
  onEdit: (task: Task) => void;
  onApprove?: (task: Task) => void;
  onDeny?: (task: Task) => void;
  onFlag?: (task: Task) => void;
  onDelete?: (task: Task) => void;
}

const AdminKanbanColumn = memo(function AdminKanbanColumn({
  config,
  tasks,
  usePerTaskBucket = false,
  onView,
  onEdit,
  onApprove,
  onDeny,
  onFlag,
  onDelete,
}: AdminKanbanColumnProps) {
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
      <ColumnHeader config={config} count={tasks.length} />

      <div className="kanban-col-scroll flex-1 overflow-y-auto px-3 py-3 space-y-2.5 min-h-[200px] max-h-[calc(100vh-300px)]">
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
              bucket={usePerTaskBucket ? classifyTask(task) : key}
              onView={onView}
              onEdit={onEdit}
              onApprove={onApprove}
              onDeny={onDeny}
              onFlag={onFlag}
              onDelete={onDelete}
              showViewButton
            />
          ))
        )}
      </div>
    </section>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Upcoming strip (identical to the one in KanbanView)
// ─────────────────────────────────────────────────────────────────────────────

const AdminUpcomingStrip = memo(function AdminUpcomingStrip({
  tasks,
  onView,
}: {
  tasks: Task[];
  onView: (task: Task) => void;
}) {
  return (
    <section
      className="kanban-upcoming rounded-2xl overflow-hidden shadow-kanban border-t-[3px] border-t-indigo-500"
      style={{ backgroundColor: '#EEF2FF' }}
      aria-label="Upcoming Tasks"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b border-black/5"
        style={{ backgroundColor: '#E0E7FF' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-white/70 shadow-sm shrink-0">
            <Clock className="w-3.5 h-3.5 text-indigo-600" aria-hidden />
          </div>
          <h3 className="text-sm font-semibold text-indigo-900 tracking-tight">
            Upcoming Tasks
          </h3>
          <span className="hidden sm:inline text-xs text-indigo-400 font-normal">
            — tasks with a future start date
          </span>
        </div>
        <span className="inline-flex items-center justify-center min-w-[26px] h-[22px] px-2 rounded-full text-xs font-bold bg-indigo-600 text-white shadow-sm">
          {tasks.length}
        </span>
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white/60 shadow-sm">
            <Sparkles className="w-7 h-7 text-indigo-300" />
          </div>
          <p className="text-sm font-semibold text-gray-600">No upcoming tasks scheduled.</p>
          <p className="text-xs text-gray-400">Tasks with a future start date will appear here.</p>
        </div>
      ) : (
        <div className="px-5 py-4 overflow-x-auto kanban-col-scroll">
          <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
            {tasks.map((task) => (
              <AdminUpcomingCard key={task.id} task={task} onView={onView} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
});

const AdminUpcomingCard = memo(function AdminUpcomingCard({
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
      className="kanban-card upcoming-card flex flex-col gap-2.5 rounded-xl border border-gray-200/80 border-l-4 border-l-indigo-400 shadow-card w-52 shrink-0 p-4 cursor-pointer select-none"
      style={{ backgroundColor: '#EEF2FF' }}
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
          className="text-[11px] text-indigo-600 font-semibold truncate flex items-center gap-1"
          title={task.assigneeDetails.map((a) => a.name).join(', ')}
        >
          <User className="w-3 h-3 shrink-0 text-indigo-400" aria-hidden />
          {task.assigneeDetails[0].name}
          {task.assigneeDetails.length > 1 && ` +${task.assigneeDetails.length - 1}`}
        </p>
      )}

      <div className="flex flex-col gap-1 text-xs">
        {startLabel && (
          <span className="flex items-center gap-1.5 text-indigo-600 font-semibold">
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

      {progress > 0 && <ModernProgressBar value={progress} variant="blue" />}
    </article>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// AdminKanbanView — main export
// ─────────────────────────────────────────────────────────────────────────────

export interface AdminKanbanViewProps {
  tasks: Task[];
  onView: (task: Task) => void;
  onEdit: (task: Task) => void;
  onApprove?: (task: Task) => void;
  onDeny?: (task: Task) => void;
  onFlag?: (task: Task) => void;
  onDelete?: (task: Task) => void;
}

export function AdminKanbanView({ tasks, onView, onEdit, onApprove, onDeny, onFlag, onDelete }: AdminKanbanViewProps) {
  // ── "All Tasks" column ──
  // Everything that is NOT in a specialised bucket (rework / under-review /
  // completed / upcoming).  Overdue tasks DO appear here (in addition to the
  // dedicated Overdue column) so admins can see their full workload in one place.
  const allColumnTasks = useMemo(
    () =>
      tasks.filter((t) => {
        const bucket = classifyTask(t);
        return (
          bucket !== 'REWORK' &&
          bucket !== 'UNDER_REVIEW' &&
          bucket !== 'COMPLETED' &&
          bucket !== 'UPCOMING'
        );
      }),
    [tasks]
  );

  // ── Returned for Rework — ALL returned tasks, sorted by most recent update ──
  const reworkTasks = useMemo(
    () =>
      getReworkTasks(tasks).sort((a, b) =>
        (b.updated_at || '').localeCompare(a.updated_at || '')
      ),
    [tasks]
  );

  // ── Overdue — all overdue, sorted oldest due-date first ──
  const overdueTasks = useMemo(
    () =>
      getOverdueTasks(tasks).sort((a, b) =>
        (a.end_date || '').localeCompare(b.end_date || '')
      ),
    [tasks]
  );

  // ── Under Review — all pending submissions ──
  const underReviewTasks = useMemo(() => getUnderReviewTasks(tasks), [tasks]);

  // ── Completed — ALL completed, sorted most-recently-completed first ──
  const completedTasks = useMemo(
    () =>
      getCompletedTasks(tasks).sort((a, b) =>
        (b.updated_at || b.end_date || '').localeCompare(
          a.updated_at || a.end_date || ''
        )
      ),
    [tasks]
  );

  // ── Upcoming — tasks with a future start date ──
  const upcomingTasks = useMemo(
    () =>
      getUpcomingTasks(tasks).sort((a, b) =>
        (a.start_date || '').localeCompare(b.start_date || '')
      ),
    [tasks]
  );

  const bucketTaskMap: Partial<Record<KanbanBucket, Task[]>> = {
    ALL_TASKS: allColumnTasks,
    REWORK: reworkTasks,
    OVERDUE: overdueTasks,
    UNDER_REVIEW: underReviewTasks,
    COMPLETED: completedTasks,
  };

  return (
    <div className="kanban-workspace flex flex-col gap-5">
      {/* 5-column board */}
      <div
        className="kanban-board-scroll overflow-x-auto pb-2 -mx-1 px-1"
        role="region"
        aria-label="Admin Kanban board"
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
          {ADMIN_COLUMNS.map((col) => (
            <AdminKanbanColumn
              key={col.key}
              config={col}
              tasks={bucketTaskMap[col.key] ?? []}
              // "All Tasks" column — use each card's real bucket for border colour
              usePerTaskBucket={col.key === 'ALL_TASKS'}
              onView={onView}
              onEdit={onEdit}
              // Approve: All Tasks + Under Review
              onApprove={col.key === 'ALL_TASKS' || col.key === 'UNDER_REVIEW' ? onApprove : undefined}
              // Deny: Under Review only
              onDeny={col.key === 'UNDER_REVIEW' ? onDeny : undefined}
              // Flag: All Tasks only
              onFlag={col.key === 'ALL_TASKS' ? onFlag : undefined}
              // Delete: All Tasks + Under Review
              onDelete={col.key === 'ALL_TASKS' || col.key === 'UNDER_REVIEW' ? onDelete : undefined}
            />
          ))}
        </div>
      </div>

      {/* Upcoming timeline strip */}
      <AdminUpcomingStrip tasks={upcomingTasks} onView={onView} />
    </div>
  );
}
