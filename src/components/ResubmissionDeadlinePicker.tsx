import { useEffect, useMemo, useState } from 'react';
import {
  RESUBMISSION_DEADLINE_ENABLED,
  applyQuickOption,
  fromDatetimeLocalValue,
  getDefaultResubmissionDate,
  getUserTimezoneLabel,
  toDatetimeLocalValue,
  validateResubmissionDeadline,
  type ResubmissionQuickOption,
} from '../utils/resubmissionDeadline';

const QUICK_OPTIONS: { value: ResubmissionQuickOption; label: string }[] = [
  { value: 'tomorrow_eod', label: 'Tomorrow EOD' },
  { value: 'plus_2_days', label: '+2 Days' },
  { value: 'plus_3_days', label: '+3 Days' },
  { value: 'plus_1_week', label: '+1 Week' },
  { value: 'custom', label: 'Custom' },
];

interface ResubmissionDeadlinePickerProps {
  visible: boolean;
  value: Date | null;
  onChange: (date: Date | null) => void;
  onValidationChange?: (valid: boolean, message?: string) => void;
}

export function ResubmissionDeadlinePicker({
  visible,
  value,
  onChange,
  onValidationChange,
}: ResubmissionDeadlinePickerProps) {
  const [quickOption, setQuickOption] = useState<ResubmissionQuickOption>('tomorrow_eod');
  const [localInput, setLocalInput] = useState(() => toDatetimeLocalValue(getDefaultResubmissionDate()));
  const tzLabel = useMemo(() => getUserTimezoneLabel(), []);

  useEffect(() => {
    if (!visible || !RESUBMISSION_DEADLINE_ENABLED) return;
    if (!value) {
      const def = getDefaultResubmissionDate();
      onChange(def);
      setLocalInput(toDatetimeLocalValue(def));
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const validation = validateResubmissionDeadline(value);
    onValidationChange?.(validation.valid, validation.message);
  }, [value, onValidationChange]);

  if (!visible || !RESUBMISSION_DEADLINE_ENABLED) return null;

  const handleQuickChange = (option: ResubmissionQuickOption) => {
    setQuickOption(option);
    if (option === 'custom') return;
    const next = applyQuickOption(option);
    onChange(next);
    setLocalInput(toDatetimeLocalValue(next));
  };

  const handleDatetimeChange = (input: string) => {
    setLocalInput(input);
    setQuickOption('custom');
    const parsed = fromDatetimeLocalValue(input);
    onChange(parsed);
  };

  const validation = validateResubmissionDeadline(value);

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 space-y-3">
      <div>
        <label htmlFor="resubmission-deadline-quick" className="block text-sm font-medium text-gray-800">
          Resubmission Deadline
        </label>
        <p className="text-xs text-gray-600 mt-0.5">
          Set when the assignee must complete and resubmit this task.
        </p>
      </div>

      <select
        id="resubmission-deadline-quick"
        value={quickOption}
        onChange={(e) => handleQuickChange(e.target.value as ResubmissionQuickOption)}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
      >
        <option value="" disabled>
          Select Deadline
        </option>
        {QUICK_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <div>
        <label htmlFor="resubmission-datetime" className="block text-xs font-medium text-gray-700 mb-1">
          Date &amp; time
        </label>
        <input
          id="resubmission-datetime"
          type="datetime-local"
          value={localInput}
          onChange={(e) => handleDatetimeChange(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
        />
        <p className="text-xs text-gray-500 mt-1">Timezone: {tzLabel}</p>
      </div>

      {!validation.valid && validation.message && (
        <p className="text-xs text-red-600" role="alert">
          {validation.message}
        </p>
      )}
    </div>
  );
}
