/**
 * TaskStatSkeleton
 *
 * Animated placeholder shown while dashboard summary counts are loading.
 * Matches the exact dimensions of TaskStatCard so there is no layout shift.
 */

import { memo } from 'react';

export const TaskStatSkeleton = memo(function TaskStatSkeleton() {
  return (
    <div
      className="relative w-full rounded-xl border border-gray-200/90 bg-white p-4 sm:p-5 shadow-sm overflow-hidden"
      aria-hidden="true"
    >
      {/* Top accent bar placeholder */}
      <div className="absolute inset-x-0 top-0 h-1 rounded-t-xl bg-gray-200 animate-pulse" />

      <div className="flex flex-col gap-3 pt-1">
        {/* Icon placeholder */}
        <div className="w-10 h-10 rounded-xl bg-gray-200 animate-pulse" />

        <div className="min-w-0 space-y-2">
          {/* Label placeholder */}
          <div className="h-3 w-24 rounded bg-gray-200 animate-pulse" />
          {/* Value placeholder */}
          <div className="h-7 w-16 rounded bg-gray-200 animate-pulse" />
        </div>
      </div>
    </div>
  );
});

/** Renders N skeleton cards in a grid that matches TaskManager's stats grid */
export const TaskStatSkeletonGrid = memo(function TaskStatSkeletonGrid({
  count = 6,
}: {
  count?: number;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 w-full min-w-0">
      {Array.from({ length: count }, (_, i) => (
        <TaskStatSkeleton key={i} />
      ))}
    </div>
  );
});
