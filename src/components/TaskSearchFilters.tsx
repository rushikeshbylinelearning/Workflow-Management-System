import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, ChevronDown, RotateCcw, SlidersHorizontal } from 'lucide-react';

export interface TaskFilters {
  search: string;
  status: string;
  priorities: string[]; // Multiple priority values
  project: string;
  stage: string;
  dueDate: string;
  team: string; // 'all' or team ID
  assignees: string[]; // Multiple assignee IDs, or 'none' for unassigned
  dateRangeStart?: string; // Custom date range: YYYY-MM-DD (filters by due date)
  dateRangeEnd?: string; // Custom date range: YYYY-MM-DD (filters by due date)
}

interface TaskSearchFiltersProps {
  filters: TaskFilters;
  onFiltersChange: (filters: TaskFilters) => void;
  projects: Array<{ id: number | string; name: string }>;
  projectStages: Array<{ id: number | string; name: string }>;
  teamMembers: Array<{ id: number | string; name: string }>;
  teams?: Array<{ id: number | string; name: string }>;
  loadingProjectStages?: boolean;
  onAddTask?: () => void;
  showAssigneeFilter?: boolean;
  showTeamFilter?: boolean;
}

const EMPTY_FILTERS: TaskFilters = {
  search: '',
  status: 'all',
  priorities: [],
  project: 'all',
  stage: 'all',
  dueDate: 'all',
  team: 'all',
  assignees: [],
  dateRangeStart: '',
  dateRangeEnd: '',
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'not-started', label: 'Not Started' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'under-review', label: 'Under Review' },
  { value: 'completed', label: 'Completed' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'overdue', label: 'Overdue' },
];

const PRIORITY_OPTIONS = [
  { value: 'all', label: 'All Priority' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const DUE_DATE_OPTIONS = [
  { value: 'all', label: 'All Due Dates' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due Today' },
  { value: 'tomorrow', label: 'Due Tomorrow' },
  { value: 'this-week', label: 'This Week' },
  { value: 'next-week', label: 'Next Week' },
  { value: 'no-due-date', label: 'No Due Date' },
];

// Reusable styled select
function FilterSelect({
  value,
  onChange,
  options,
  disabled,
  active,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <div className="relative w-full min-w-0">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`
          w-full appearance-none h-9 pl-3 pr-8 text-sm rounded-lg border outline-none
          transition-all duration-150 cursor-pointer
          ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200 text-gray-400' : ''}
          ${active && !disabled
            ? 'border-indigo-400 bg-indigo-50 text-indigo-700 font-medium'
            : !disabled
              ? 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'
              : ''
          }
        `}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className={`absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none
          ${active && !disabled ? 'text-indigo-500' : 'text-gray-400'}`}
      />
    </div>
  );
}

// Multi-select checkbox component
function FilterMultiSelect({
  label,
  options,
  selected,
  onChange,
  active,
  searchable = false,
  minWidth = 220,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onChange: (values: string[]) => void;
  active?: boolean;
  searchable?: boolean;
  minWidth?: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState({ top: 0, left: 0, width: minWidth ?? 220 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const minW = minWidth ?? 220;

  const reposition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, minW) });
  }, [minW]);

  useEffect(() => {
    if (!isOpen) return;
    reposition();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [isOpen, reposition]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      return;
    }
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  const toggleOption = (value: string) => {
    const newSelected = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    onChange(newSelected);
  };

  const noneOption = options.find((o) => o.value === 'none');
  const memberOptions = options.filter((o) => o.value !== 'none');
  const filteredMembers =
    searchable && query.trim()
      ? memberOptions.filter((o) =>
          o.label.toLowerCase().includes(query.trim().toLowerCase())
        )
      : memberOptions;

  const displayLabel =
    selected.length === 0
      ? label
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? label)
        : `${label} (${selected.length})`;

  return (
    <div className="relative w-full min-w-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={`
          flex items-center justify-between gap-2 h-9 pl-3 pr-8 text-sm rounded-lg border outline-none relative w-full min-w-0
          transition-all duration-150 cursor-pointer
          ${active || isOpen
            ? 'border-indigo-400 bg-indigo-50 text-indigo-700 font-medium ring-2 ring-indigo-100'
            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'
          }
        `}
      >
        <span className="truncate min-w-0 text-left">{displayLabel}</span>
        <ChevronDown
          className={`absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none transition-transform shrink-0
            ${active || isOpen ? 'text-indigo-500' : 'text-gray-400'}
            ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              width: coords.width,
              zIndex: 9999,
            }}
            className="bg-white border border-indigo-200 rounded-lg shadow-xl overflow-hidden"
          >
            {searchable && memberOptions.length > 4 && (
              <div className="p-2 border-b border-gray-100">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search people..."
                    className="w-full h-8 pl-8 pr-2 text-sm rounded-md border border-gray-200 bg-gray-50 outline-none focus:border-indigo-400 focus:bg-white focus:ring-1 focus:ring-indigo-100"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            )}

            <div className="max-h-56 overflow-y-auto py-1">
              {noneOption && (
                <>
                  <label className="flex items-center gap-2.5 px-3 py-2 hover:bg-indigo-50/60 cursor-pointer text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={selected.includes('none')}
                      onChange={() => toggleOption('none')}
                      className="w-4 h-4 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="font-medium">{noneOption.label}</span>
                  </label>
                  {memberOptions.length > 0 && (
                    <div className="mx-3 my-1 border-t border-gray-100" />
                  )}
                </>
              )}

              {filteredMembers.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2.5 px-3 py-2 hover:bg-indigo-50/60 cursor-pointer text-sm text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(opt.value)}
                    onChange={() => toggleOption(opt.value)}
                    className="w-4 h-4 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="truncate">{opt.label}</span>
                </label>
              ))}

              {searchable && query.trim() && filteredMembers.length === 0 && (
                <p className="px-3 py-3 text-sm text-gray-500 text-center">No matches found</p>
              )}

              {memberOptions.length === 0 && noneOption && (
                <p className="px-3 py-2 text-xs text-gray-400 text-center">No team members loaded</p>
              )}
            </div>

            {selected.length > 0 && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-gray-100 bg-gray-50/80">
                <span className="text-xs text-gray-500">{selected.length} selected</span>
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                >
                  Clear
                </button>
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}

// Date range picker component
function DateRangePicker({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  active,
}: {
  startDate: string;
  endDate: string;
  onStartChange: (date: string) => void;
  onEndChange: (date: string) => void;
  active?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 items-center w-full min-w-0">
      <input
        type="date"
        value={startDate}
        onChange={(e) => onStartChange(e.target.value)}
        className={`
          h-9 px-3 text-sm rounded-lg border outline-none w-full min-w-0
          transition-all duration-150
          ${active
            ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'
          }
        `}
        placeholder="Start date"
      />
      <span className="text-gray-400 text-sm text-center px-1">to</span>
      <input
        type="date"
        value={endDate}
        onChange={(e) => onEndChange(e.target.value)}
        className={`
          h-9 px-3 text-sm rounded-lg border outline-none w-full min-w-0
          transition-all duration-150
          ${active
            ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'
          }
        `}
        placeholder="End date"
      />
    </div>
  );
}

export function TaskSearchFilters({
  filters,
  onFiltersChange,
  projects,
  projectStages,
  teamMembers,
  teams = [],
  loadingProjectStages = false,
  onAddTask,
  showAssigneeFilter = true,
  showTeamFilter = true,
}: TaskSearchFiltersProps) {
  // Local search input state — debounced before propagating to parent
  const [localSearch, setLocalSearch] = useState(filters.search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Always-current refs to avoid stale closures in debounced callbacks
  const filtersRef = useRef(filters);
  const onFiltersChangeRef = useRef(onFiltersChange);
  // Flag: true while the user is actively typing (prevents parent sync from overwriting input)
  const isTypingRef = useRef(false);

  // Keep refs current on every render
  useEffect(() => {
    filtersRef.current = filters;
    onFiltersChangeRef.current = onFiltersChange;
  });

  // Sync localSearch only when the parent resets search externally (e.g. Reset button),
  // NOT while the user is mid-typing.
  useEffect(() => {
    if (!isTypingRef.current) {
      setLocalSearch(filters.search);
    }
  }, [filters.search]);

  // Debounce search — propagate to parent after 300ms of idle input.
  // Uses refs so the callback is stable and never captures stale values.
  const handleSearchChange = useCallback((value: string) => {
    isTypingRef.current = true;
    setLocalSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      isTypingRef.current = false;
      onFiltersChangeRef.current({ ...filtersRef.current, search: value });
    }, 300);
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  // Stable setter for all non-search filters
  const setFilter = useCallback((key: keyof TaskFilters, value: string) => {
    const next = { ...filtersRef.current, [key]: value };
    if (key === 'project') next.stage = 'all';
    onFiltersChangeRef.current(next);
  }, []);

  // Stable reset — clears both local search and all filters
  const resetFilters = useCallback(() => {
    isTypingRef.current = false;
    setLocalSearch('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onFiltersChangeRef.current({ ...EMPTY_FILTERS });
  }, []);

  // Count active (non-default) filters, excluding search (shown separately)
  const activeFilterCount = [
    filters.status !== 'all',
    (filters.priorities?.length ?? 0) > 0,
    filters.project !== 'all',
    filters.stage !== 'all',
    filters.dueDate !== 'all',
    filters.team !== 'all',
    (filters.assignees?.length ?? 0) > 0,
    !!filters.dateRangeStart || !!filters.dateRangeEnd,
  ].filter(Boolean).length;

  const hasAnyFilter = activeFilterCount > 0 || filters.search !== '';

  // Build active filter chips
  const activeChips: Array<{ label: string; key: keyof TaskFilters }> = [];
  if (filters.status !== 'all') {
    const opt = STATUS_OPTIONS.find((o) => o.value === filters.status);
    if (opt) activeChips.push({ label: `Status: ${opt.label}`, key: 'status' });
  }
  if ((filters.priorities?.length ?? 0) > 0) {
    const names = filters.priorities
      .map((v) => PRIORITY_OPTIONS.find((o) => o.value === v)?.label)
      .filter(Boolean);
    if (names.length > 0) {
      activeChips.push({
        label: names.length === 1 ? `Priority: ${names[0]}` : `Priorities: ${names.join(', ')}`,
        key: 'priorities',
      });
    }
  }
  if (filters.project !== 'all') {
    const proj = projects.find((p) => String(p.id) === String(filters.project));
    if (proj) activeChips.push({ label: `Project: ${proj.name}`, key: 'project' });
  }
  if (filters.stage !== 'all') {
    const stage = projectStages.find((s) => String(s.id) === String(filters.stage));
    if (stage) activeChips.push({ label: `Stage: ${stage.name}`, key: 'stage' });
  }
  if (filters.dueDate !== 'all') {
    const opt = DUE_DATE_OPTIONS.find((o) => o.value === filters.dueDate);
    if (opt) activeChips.push({ label: `Due: ${opt.label}`, key: 'dueDate' });
  }
  if (showTeamFilter && filters.team !== 'all') {
    const team = teams.find((t) => String(t.id) === String(filters.team));
    if (team) activeChips.push({ label: `Team: ${team.name}`, key: 'team' });
  }
  if (showAssigneeFilter && filters.assignees?.includes('none')) {
    activeChips.push({ label: 'Assignee: No Assignee', key: 'assignees' });
  } else if (showAssigneeFilter && (filters.assignees?.length ?? 0) > 0) {
    const names = filters.assignees
      .map((id) => teamMembers.find((m) => String(m.id) === String(id))?.name)
      .filter(Boolean);
    if (names.length > 0) {
      activeChips.push({
        label: names.length === 1 ? `Assignee: ${names[0]}` : `Assignees: ${names.join(', ')}`,
        key: 'assignees',
      });
    }
  }
  if (filters.dateRangeStart || filters.dateRangeEnd) {
    const startLabel = filters.dateRangeStart ? filters.dateRangeStart : 'Start';
    const endLabel = filters.dateRangeEnd ? filters.dateRangeEnd : 'End';
    activeChips.push({ label: `Date Range: ${startLabel} to ${endLabel}`, key: 'dateRangeStart' });
  }

  const stageOptions: Array<{ value: string; label: string }> = [
    filters.project === 'all'
      ? { value: 'all', label: 'Select project first' }
      : { value: 'all', label: 'All Stages' },
    ...projectStages.map((s) => ({ value: String(s.id), label: s.name })),
  ];

  const assigneeOptions: Array<{ value: string; label: string }> = [
    { value: 'all', label: 'All Assignees' },
    { value: 'none', label: 'No Assignee' },
    ...teamMembers.map((m) => ({ value: String(m.id), label: m.name })),
  ];

  const projectOptions: Array<{ value: string; label: string }> = [
    { value: 'all', label: 'All Projects' },
    ...projects.map((p) => ({ value: String(p.id), label: p.name })),
  ];

  const teamOptions: Array<{ value: string; label: string }> = [
    { value: 'all', label: 'All Teams' },
    ...teams.map((t) => ({ value: String(t.id), label: t.name })),
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm w-full min-w-0 max-w-full overflow-hidden">
      {/* Top row: search + add task */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-4 py-3 border-b border-gray-100">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] basis-full sm:basis-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="
              w-full h-9 pl-9 pr-8 text-sm rounded-lg border border-gray-200 bg-gray-50
              placeholder-gray-400 text-gray-800 outline-none
              transition-all duration-150
              hover:border-gray-300 hover:bg-white
              focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100
            "
          />
          {localSearch && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="hidden sm:block h-6 w-px bg-gray-200 shrink-0" />

        {/* Filter count badge */}
        <div className="flex items-center gap-1.5 text-sm text-gray-500 shrink-0 ml-auto sm:ml-0">
          <SlidersHorizontal className="w-4 h-4" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-semibold">
              {activeFilterCount}
            </span>
          )}
        </div>

        {/* Reset */}
        {hasAnyFilter && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors shrink-0"
            title="Reset all filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        )}
      </div>

      {/* Filter controls — grouped rows */}
      <div className="relative z-10 px-4 py-3 space-y-3 border-t border-gray-100">
        {/* Row 1: status, priority, due preset, project */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
          <FilterSelect
            value={filters.status}
            onChange={(v) => setFilter('status', v)}
            options={STATUS_OPTIONS}
            active={filters.status !== 'all'}
          />
          <FilterMultiSelect
            label="All Priority"
            options={PRIORITY_OPTIONS.filter((o) => o.value !== 'all')}
            selected={filters.priorities ?? []}
            onChange={(values) =>
              onFiltersChangeRef.current({ ...filtersRef.current, priorities: values })
            }
            active={(filters.priorities?.length ?? 0) > 0}
          />
          <FilterSelect
            value={filters.dueDate}
            onChange={(v) => setFilter('dueDate', v)}
            options={DUE_DATE_OPTIONS}
            active={filters.dueDate !== 'all'}
          />
          <FilterSelect
            value={filters.project}
            onChange={(v) => setFilter('project', v)}
            options={projectOptions}
            active={filters.project !== 'all'}
          />
        </div>

        {/* Row 2: stage, team, assignees */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
          <FilterSelect
            value={filters.stage}
            onChange={(v) => setFilter('stage', v)}
            options={stageOptions}
            disabled={filters.project === 'all' || loadingProjectStages}
            active={filters.stage !== 'all'}
          />
          {showTeamFilter && (
            <FilterSelect
              value={filters.team}
              onChange={(v) => setFilter('team', v)}
              options={teamOptions}
              active={filters.team !== 'all'}
            />
          )}
          {showAssigneeFilter && (
            <div
              className={
                showTeamFilter
                  ? 'sm:col-span-2 xl:col-span-2 min-w-0'
                  : 'sm:col-span-2 xl:col-span-3 min-w-0'
              }
            >
              <FilterMultiSelect
                label="All Assignees"
                searchable
                options={assigneeOptions.filter((o) => o.value !== 'all')}
                selected={filters.assignees ?? []}
                onChange={(values) => {
                  const prev = filters.assignees ?? [];
                  const added = values.filter((v) => !prev.includes(v));
                  let next = values;
                  if (added.includes('none')) {
                    next = ['none'];
                  } else if (prev.includes('none') && values.length > 1) {
                    next = values.filter((v) => v !== 'none');
                  }
                  onFiltersChangeRef.current({ ...filtersRef.current, assignees: next });
                }}
                active={(filters.assignees?.length ?? 0) > 0}
              />
            </div>
          )}
        </div>

        {/* Row 3: custom due date range */}
        <div className="grid grid-cols-1 lg:grid-cols-[7.5rem_1fr] gap-2 lg:gap-3 items-center pt-2 border-t border-gray-50">
          <span className="text-xs font-medium text-gray-500">Due between</span>
          <DateRangePicker
            startDate={filters.dateRangeStart ?? ''}
            endDate={filters.dateRangeEnd ?? ''}
            onStartChange={(date) => onFiltersChangeRef.current({ ...filtersRef.current, dateRangeStart: date })}
            onEndChange={(date) => onFiltersChangeRef.current({ ...filtersRef.current, dateRangeEnd: date })}
            active={!!filters.dateRangeStart || !!filters.dateRangeEnd}
          />
        </div>
      </div>

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 py-3 border-t border-gray-100 bg-gray-50/50">
          {activeChips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100"
            >
              {chip.label}
              <button
                onClick={() => {
                  if (chip.key === 'dateRangeStart') {
                    onFiltersChangeRef.current({ ...filtersRef.current, dateRangeStart: '', dateRangeEnd: '' });
                  } else if (chip.key === 'assignees') {
                    onFiltersChangeRef.current({ ...filtersRef.current, assignees: [] });
                  } else if (chip.key === 'priorities') {
                    onFiltersChangeRef.current({ ...filtersRef.current, priorities: [] });
                  } else {
                    setFilter(chip.key, 'all');
                  }
                }}
                className="ml-0.5 text-indigo-400 hover:text-indigo-600 transition-colors"
                aria-label={`Remove ${chip.label} filter`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}