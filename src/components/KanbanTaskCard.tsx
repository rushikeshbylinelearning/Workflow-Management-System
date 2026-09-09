/**
 * KanbanTaskCard — reusable card for any Kanban column.
 *
 * Redesigned for a modern, enterprise-grade aesthetic while preserving
 * all existing business logic, bucket classification, and action handlers.
 */
import { memo } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  CheckSquare,
  Clock,
  Eye,
  Flag,
  MessageSquare,
  Pencil,
  RotateCcw,
  Trash2,
  User,
  XCircle,
} from 'lucide-react';
import { ResubmissionDeadlineBanner } from './ResubmissionDeadlineBanner';
import { PriorityPill, ModernProgressBar } from './KanbanView';
import type { KanbanBucket } from '../utils/taskClassifier';
import { getDaysUntilDue, getDaysUntilStart } from '../utils/taskClassifier';
import {
  getReworkCardClass,
  getReworkReviewSubLabel,
  getTaskReworkCount,
  isOnHoldTask,
} from '../utils/reworkHighlight';
import { getTaskDisplayProgress } from '../utils/taskProgressDisplay';
import { getTaskStatusLabel } from '../utils/taskStatusDisplay';
import type { Task } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface KanbanTaskCardProps {
  task: Task;
  bucket: KanbanBucket;
  onView: (task: Task) => void;
  onAddRemark?: (task: Task) => void;
  onRequestExtension?: (task: Task) => void;
  /** When true, renders an explicit eye/view button in the card footer (admin kanban) */
  showViewButton?: boolean;
  /** Called when the edit (pencil) button is clicked — admin kanban only */
  onEdit?: (task: Task) => void;
  /** Called when the approve/complete (check-square) button is clicked — admin kanban only */
  onApprove?: (task: Task) => void;
  /** Called when the deny/reject button is clicked — Under Review column only */
  onDeny?: (task: Task) => void;
  /** Called when the flag (alert-triangle) button is clicked — admin kanban only */
  onFlag?: (task: Task) => void;
  /** Called when the delete (trash) button is clicked — admin kanban only */
  onDelete?: (task: Task) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Status chip — modern pill with border
// ─────────────────────────────────────────────────────────────────────────────

function StatusChip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: 'orange' | 'green' | 'red' | 'amber' | 'blue' | 'gray';
}) {
  const styles: Record<string, string> = {
    orange: 'bg-orange-50 text-orange-700 border border-orange-200',
    green:  'bg-green-50 text-green-700 border border-green-200',
    red:    'bg-red-50 text-red-700 border border-red-200',
    amber:  'bg-amber-50 text-amber-700 border border-amber-200',
    blue:   'bg-blue-50 text-blue-700 border border-blue-200',
    gray:   'bg-gray-100 text-gray-500 border border-gray-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${styles[tone]}`}>
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Action button — compact outline style, fills on hover
// ─────────────────────────────────────────────────────────────────────────────

function ActionBtn({
  onClick,
  icon: Icon,
  label,
  variant = 'default',
  ariaLabel,
  iconOnly = false,
}: {
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  variant?: 'default' | 'danger' | 'success' | 'warning';
  ariaLabel: string;
  iconOnly?: boolean;
}) {
  const base =
    'inline-flex items-center justify-center gap-1 h-7 text-[11px] font-semibold rounded-lg border transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 whitespace-nowrap';
  const sizeClass = iconOnly ? 'w-7 px-0' : 'px-2.5';
  const styles =
    variant === 'danger'
      ? 'border-red-200 text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600 focus:ring-red-400'
      : variant === 'success'
      ? 'border-green-200 text-green-600 hover:bg-green-600 hover:text-white hover:border-green-600 focus:ring-green-400'
      : variant === 'warning'
      ? 'border-orange-200 text-orange-600 hover:bg-orange-500 hover:text-white hover:border-orange-500 focus:ring-orange-400'
      : 'border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 focus:ring-blue-400';

  return (
    <button
      onClick={onClick}
      className={`${base} ${sizeClass} ${styles}`}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <Icon className="w-3.5 h-3.5" aria-hidden />
      {!iconOnly && label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const KanbanTaskCard = memo(function KanbanTaskCard({
  task,
  bucket,
  onView,
  onAddRemark,
  onRequestExtension,
  showViewButton = false,
  onEdit,
  onApprove,
  onDeny,
  onFlag,
  onDelete,
}: KanbanTaskCardProps) {
  const reworkCount = getTaskReworkCount(task);
  const onHold = isOnHoldTask(task);
  const reworkCardClass = onHold
    ? 'task-card--on-hold'
    : getReworkCardClass(reworkCount);

  const progress = getTaskDisplayProgress(task);
  const daysUntilDue = getDaysUntilDue(task);
  const daysUntilStart = getDaysUntilStart(task);

  // Bucket flags
  const isOverdue     = bucket === 'OVERDUE';
  const isCompleted   = bucket === 'COMPLETED';
  const isUnderReview = bucket === 'UNDER_REVIEW';
  const isUpcoming    = bucket === 'UPCOMING';
  const isRework      = bucket === 'REWORK';

  // Left-border accent per bucket (overridden by rework CSS if applicable)
  const bucketAccentClass = isOverdue
    ? 'border-l-[3px] border-l-red-400'
    : isUnderReview
    ? 'border-l-[3px] border-l-orange-400'
    : isCompleted
    ? 'border-l-[3px] border-l-green-400'
    : isUpcoming
    ? 'border-l-[3px] border-l-blue-400'
    : isRework
    ? 'border-l-[3px] border-l-amber-400'
    : 'border-l-[3px] border-l-blue-400';

  // Progress bar colour
  const progressVariant: 'blue' | 'red' | 'green' | 'orange' = isOverdue
    ? 'red'
    : isCompleted
    ? 'green'
    : isUnderReview
    ? 'orange'
    : 'blue';

  // Rework badge escalation colour
  const reworkBadgeTone =
    reworkCount >= 3 ? 'red' : reworkCount === 2 ? 'orange' : reworkCount === 1 ? 'yellow' : null;

  // Due date copy
  const dueDateDisplay = (() => {
    if (!task.end_date) return null;
    const d = new Date(task.end_date);
    const formatted = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (isCompleted) return { label: `Completed ${formatted}`, className: 'text-green-600 font-medium' };
    if (isOverdue && daysUntilDue !== null) {
      const days = Math.abs(daysUntilDue);
      return { label: `${days}d overdue`, className: 'text-red-600 font-semibold' };
    }
    if (daysUntilDue === 0) return { label: 'Due today', className: 'text-orange-600 font-semibold' };
    if (daysUntilDue === 1) return { label: 'Due tomorrow', className: 'text-yellow-600 font-semibold' };
    return { label: `Due ${formatted}`, className: 'text-gray-400' };
  })();

  // Upcoming start date copy
  const startDateDisplay = (() => {
    if (!isUpcoming || !task.start_date) return null;
    if (daysUntilStart === null) return null;
    if (daysUntilStart === 1) return 'Starts tomorrow';
    if (daysUntilStart === 0) return 'Starts today';
    return `Starts in ${daysUntilStart}d`;
  })();

  // Submitted / review date
  const submittedAt = (task as any).submitted_at || (task as any).updated_at;
  const submittedDate = submittedAt
    ? new Date(submittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;

  return (
    <article
      className={[
        'kanban-card group relative bg-white rounded-xl border border-gray-200/80',
        'cursor-pointer select-none',
        // rework CSS class overrides border-left if present
        reworkCardClass ? reworkCardClass : bucketAccentClass,
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => onView(task)}
      role="button"
      tabIndex={0}
      aria-label={`View task: ${task.name}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onView(task);
        }
      }}
    >
      <div className="p-4 space-y-3">

        {/* ── Top: title + priority pill ── */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="text-[14px] font-semibold text-gray-900 line-clamp-2 leading-snug">
              {task.name}
            </h4>
            {(task.component_path || task.grade_name) && (
              <div
                className="mt-0.5 text-xs text-purple-600 truncate"
                title={task.component_path || task.grade_name}
              >
                📚 {task.component_path || task.grade_name}
              </div>
            )}
          </div>
          <PriorityPill priority={task.priority} />
        </div>

        {/* ── Rework escalation badge ── */}
        {reworkCount > 0 && reworkBadgeTone && !onHold && (
          <div>
            <span
              className={`rework-returned-badge rework-returned-badge--${reworkBadgeTone}`}
              role="status"
              title={`Returned for rework — ${getReworkReviewSubLabel(reworkCount)}`}
            >
              <span className="inline-flex items-center gap-0.5">
                <RotateCcw className="w-3 h-3 shrink-0" aria-hidden />
                Returned For Rework
              </span>
              <span className="rework-returned-badge__round">
                {getReworkReviewSubLabel(reworkCount)}
              </span>
            </span>
          </div>
        )}

        {/* ── Under Review chip ── */}
        {isUnderReview && (
          <div className="flex items-center gap-2 flex-wrap">
            <StatusChip tone="orange">
              <Eye className="w-3 h-3" aria-hidden />
              Waiting for Approval
            </StatusChip>
            {submittedDate && (
              <span className="text-[11px] text-gray-400">· {submittedDate}</span>
            )}
          </div>
        )}

        {/* ── On-hold chip ── */}
        {onHold && (
          <StatusChip tone="gray">
            {getTaskStatusLabel('on-hold')}
          </StatusChip>
        )}

        {/* ── Completed chip ── */}
        {isCompleted && (
          <StatusChip tone="green">
            <CheckCircle className="w-3 h-3" aria-hidden />
            Completed
          </StatusChip>
        )}

        {/* ── Performance flag ── */}
        {task.performance_flag_type && (
          <div
            className={`flex items-center gap-1 text-[11px] font-bold ${
              task.performance_flag_type === 'red'    ? 'text-red-600'
              : task.performance_flag_type === 'orange' ? 'text-orange-600'
              : task.performance_flag_type === 'yellow' ? 'text-yellow-600'
              : 'text-green-600'
            }`}
          >
            <Flag className="w-3 h-3 shrink-0" aria-hidden />
            <span className="uppercase tracking-wide">{task.performance_flag_type} Flag</span>
          </div>
        )}

        {/* ── Resubmission deadline ── */}
        <ResubmissionDeadlineBanner
          deadline={task.resubmission_deadline ?? task.resubmissionDeadline}
          remainingTime={task.remainingTime}
          resubmissionOverdue={task.resubmissionOverdue}
        />

        {/* ── Project name ── */}
        {task.project_name && (
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400 truncate font-medium tracking-wide uppercase">
            <User className="w-3 h-3 shrink-0 text-gray-300" aria-hidden />
            <span className="truncate">{task.project_name}</span>
          </div>
        )}

        {/* ── Assignee name(s) ── */}
        {task.assigneeDetails && task.assigneeDetails.length > 0 ? (
          <div className="flex items-center gap-1.5 text-[11px] text-blue-600 font-semibold truncate">
            <User className="w-3 h-3 shrink-0 text-blue-400" aria-hidden />
            <span className="truncate" title={task.assigneeDetails.map((a) => a.name).join(', ')}>
              {task.assigneeDetails[0].name}
              {task.assigneeDetails.length > 1 && ` +${task.assigneeDetails.length - 1}`}
            </span>
          </div>
        ) : null}

        {/* ── Progress bar ── */}
        {!(isUpcoming && progress === 0) && (
          <ModernProgressBar value={progress} variant={progressVariant} />
        )}

        {/* ── Footer: dates + actions ── */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex flex-col gap-0.5 min-w-0 text-xs">
            {dueDateDisplay && (
              <span className={`flex items-center gap-1.5 ${dueDateDisplay.className}`}>
                <Calendar className="w-3 h-3 shrink-0" aria-hidden />
                {dueDateDisplay.label}
              </span>
            )}
            {startDateDisplay && (
              <span className="text-blue-600 font-semibold flex items-center gap-1.5">
                <Clock className="w-3 h-3 shrink-0" aria-hidden />
                {startDateDisplay}
              </span>
            )}
          </div>

          {/* Action buttons — only shown when applicable */}
          {(!isCompleted && !isUnderReview && !onHold && !isUpcoming && (onAddRemark || isOverdue && onRequestExtension)) || showViewButton ? (
            <div
              className="flex items-center gap-1.5 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Team-member actions (non-admin) */}
              {!isCompleted && !isUnderReview && !onHold && !isUpcoming && onAddRemark && (
                <ActionBtn
                  onClick={() => onAddRemark(task)}
                  icon={MessageSquare}
                  label="Remark"
                  variant="default"
                  ariaLabel={`Add remark to ${task.name}`}
                />
              )}
              {!isCompleted && !isUnderReview && !onHold && !isUpcoming && isOverdue && onRequestExtension && (
                <ActionBtn
                  onClick={() => onRequestExtension(task)}
                  icon={Clock}
                  label="Extend"
                  variant="danger"
                  ariaLabel={`Request extension for ${task.name}`}
                />
              )}

              {/* Admin icon-only action strip */}
              {showViewButton && (
                <>
                  {/* View — always shown */}
                  <ActionBtn
                    onClick={() => onView(task)}
                    icon={Eye}
                    label="View"
                    variant="default"
                    iconOnly
                    ariaLabel={`View task: ${task.name}`}
                  />

                  {/* Approve */}
                  {onApprove && (
                    <ActionBtn
                      onClick={() => onApprove(task)}
                      icon={CheckSquare}
                      label="Approve"
                      variant="success"
                      iconOnly
                      ariaLabel={`Approve task: ${task.name}`}
                    />
                  )}

                  {/* Under Review: Deny button (replaces Flag) */}
                  {isUnderReview && onDeny && (
                    <ActionBtn
                      onClick={() => onDeny(task)}
                      icon={XCircle}
                      label="Deny"
                      variant="danger"
                      iconOnly
                      ariaLabel={`Deny task: ${task.name}`}
                    />
                  )}

                  {/* Non-review columns: Flag button */}
                  {!isUnderReview && onFlag && (
                    <ActionBtn
                      onClick={() => onFlag(task)}
                      icon={AlertTriangle}
                      label="Flag"
                      variant="warning"
                      iconOnly
                      ariaLabel={`Flag task: ${task.name}`}
                    />
                  )}

                  {/* Edit */}
                  {onEdit && (
                    <ActionBtn
                      onClick={() => onEdit(task)}
                      icon={Pencil}
                      label="Edit"
                      variant="default"
                      iconOnly
                      ariaLabel={`Edit task: ${task.name}`}
                    />
                  )}

                  {/* Delete */}
                  {onDelete && (
                    <ActionBtn
                      onClick={() => onDelete(task)}
                      icon={Trash2}
                      label="Delete"
                      variant="danger"
                      iconOnly
                      ariaLabel={`Delete task: ${task.name}`}
                    />
                  )}
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
});
