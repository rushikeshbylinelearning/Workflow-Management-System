import React, { memo } from 'react';

interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  showLabel?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

export const ProgressBar = memo(function ProgressBar({ value, max = 100, className = '', showLabel = true, variant = 'default' }: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100);
  const variants = { default: 'bg-blue-600', success: 'bg-green-600', warning: 'bg-yellow-600', danger: 'bg-red-600' };
  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-700">{Math.round(percentage)}%</span>
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all duration-300 ${variants[variant]}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
});
