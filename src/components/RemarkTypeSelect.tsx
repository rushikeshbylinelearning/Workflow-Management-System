import React from 'react';

interface RemarkTypeSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; statusEffect?: string }>;
  className?: string;
  taskStatus?: string;
  showEffects?: boolean;
}

export function RemarkTypeSelect({
  value,
  onChange,
  options,
  className = 'w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent',
  taskStatus,
  showEffects = true,
}: RemarkTypeSelectProps) {
  const selected = options.find((option) => option.value === value);
  const effect = selected?.statusEffect;
  const catalog = options.some((option) => option.value === value)
    ? options
    : [...options, { value, label: value }];

  return (
    <div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className}
      >
        {catalog.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      {showEffects && effect === 'in-progress' && taskStatus === 'not-started' && (
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> This will mark the task as In Progress and set progress to 50%.
          </p>
        </div>
      )}
      {showEffects && effect === 'under-review' && (
        <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> This will submit the task for admin review.
          </p>
        </div>
      )}
      {showEffects && effect === 'skipped' && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">
            <strong>Warning:</strong> This will mark the task as skipped and set progress to 0%.
          </p>
        </div>
      )}
    </div>
  );
}
