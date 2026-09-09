/**
 * KanbanSkeleton
 *
 * Animated skeleton board shown while Kanban tasks are loading.
 * Prevents a blank flash and keeps perceived performance fast.
 */

import { memo } from 'react';

const COLUMN_ACCENTS = [
  'border-t-slate-400',
  'border-t-amber-400',
  'border-t-red-400',
  'border-t-orange-400',
  'border-t-green-400',
];

const CARD_COUNTS = [4, 2, 3, 2, 5];

const SkeletonCard = memo(function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-200/80 bg-white p-3.5 shadow-sm space-y-2.5">
      {/* Title */}
      <div className="h-3.5 w-4/5 rounded bg-gray-200 animate-pulse" />
      <div className="h-3 w-3/5 rounded bg-gray-200 animate-pulse" />
      {/* Meta row */}
      <div className="flex items-center gap-2 pt-1">
        <div className="h-5 w-12 rounded-full bg-gray-200 animate-pulse" />
        <div className="h-4 w-16 rounded bg-gray-200 animate-pulse ml-auto" />
      </div>
    </div>
  );
});

const SkeletonColumn = memo(function SkeletonColumn({
  accent,
  cardCount,
}: {
  accent: string;
  cardCount: number;
}) {
  return (
    <section
      className={[
        'flex flex-col rounded-2xl overflow-hidden',
        'border-t-[3px]',
        accent,
        'bg-gray-50/30 shadow-kanban',
        'w-full min-w-[272px]',
      ].join(' ')}
      aria-hidden="true"
    >
      {/* Column header skeleton */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50/70 border-b border-black/5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gray-200 animate-pulse" />
          <div className="h-3.5 w-24 rounded bg-gray-200 animate-pulse" />
        </div>
        <div className="w-7 h-5 rounded-full bg-gray-200 animate-pulse" />
      </div>

      {/* Cards */}
      <div className="flex-1 px-3 py-3 space-y-2.5 min-h-[200px] max-h-[calc(100vh-300px)]">
        {Array.from({ length: cardCount }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </section>
  );
});

export const KanbanSkeleton = memo(function KanbanSkeleton() {
  return (
    <div
      className="kanban-workspace flex flex-col gap-5"
      role="status"
      aria-label="Loading Kanban board"
    >
      <span className="sr-only">Loading Kanban board…</span>

      {/* 5-column skeleton board */}
      <div
        className={[
          'kanban-board-scroll overflow-x-auto pb-2 -mx-1 px-1',
        ].join(' ')}
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
          {COLUMN_ACCENTS.map((accent, i) => (
            <SkeletonColumn key={i} accent={accent} cardCount={CARD_COUNTS[i]} />
          ))}
        </div>
      </div>

      {/* Upcoming strip skeleton */}
      <section
        className="kanban-upcoming rounded-2xl overflow-hidden shadow-kanban border-t-[3px] border-t-indigo-400 bg-indigo-50/30"
        aria-hidden="true"
      >
        <div className="flex items-center justify-between px-5 py-3 bg-indigo-50/60 border-b border-black/5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-200/60 animate-pulse" />
            <div className="h-3.5 w-28 rounded bg-indigo-200/60 animate-pulse" />
          </div>
          <div className="w-7 h-5 rounded-full bg-indigo-200/60 animate-pulse" />
        </div>
        <div className="px-5 py-4 flex gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-52 shrink-0 rounded-xl border border-gray-200/80 bg-white p-4 space-y-2"
            >
              <div className="h-3.5 w-4/5 rounded bg-gray-200 animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-gray-200 animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-gray-200 animate-pulse" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
});
