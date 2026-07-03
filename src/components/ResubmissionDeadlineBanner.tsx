import { Clock, AlertTriangle } from 'lucide-react';
import {
  formatResubmissionCountdown,
  formatResubmissionDisplay,
  RESUBMISSION_DEADLINE_ENABLED,
} from '../utils/resubmissionDeadline';

interface ResubmissionDeadlineBannerProps {
  deadline?: string | null;
  remainingTime?: string | null;
  resubmissionOverdue?: boolean;
  compact?: boolean;
}

export function ResubmissionDeadlineBanner({
  deadline,
  remainingTime,
  resubmissionOverdue,
  compact = false,
}: ResubmissionDeadlineBannerProps) {
  if (!RESUBMISSION_DEADLINE_ENABLED || !deadline) return null;

  const countdown = remainingTime
    ? { text: remainingTime, overdue: !!resubmissionOverdue }
    : formatResubmissionCountdown(deadline);
  const display = formatResubmissionDisplay(deadline);
  const overdue = countdown.overdue;

  if (compact) {
    return (
      <div
        className={`text-xs mt-1 ${overdue ? 'text-red-700 font-medium' : 'text-amber-800'}`}
        role="status"
      >
        {overdue ? '🔴 Resubmission Deadline Missed' : '🟡 Resubmit By:'}{' '}
        {display}
        <span className="text-gray-600 font-normal"> · {countdown.text}</span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border p-3 mb-3 ${
        overdue ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
      }`}
      role="status"
    >
      <div className="flex items-start gap-2">
        {overdue ? (
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
        ) : (
          <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        )}
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${overdue ? 'text-red-800' : 'text-amber-900'}`}>
            {overdue ? 'Resubmission Deadline Missed' : 'Resubmit By'}
          </p>
          <p className={`text-sm ${overdue ? 'text-red-700' : 'text-amber-800'}`}>{display}</p>
          <p className="text-xs text-gray-600 mt-0.5">{countdown.text}</p>
        </div>
      </div>
    </div>
  );
}
