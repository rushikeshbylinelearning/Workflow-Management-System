import React, { useEffect, useMemo, useState } from 'react';
import { Search, Users, X, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';

export interface EmployeeCompareSummary {
  id: number;
  name: string;
  email?: string;
  role?: string;
  team_names?: string[];
  total_projects?: number;
  active_projects?: number;
  total_tasks?: number;
  active_tasks?: number;
  completed_tasks?: number;
  in_progress_tasks?: number;
  overdue_tasks?: number;
  completion_rate?: number;
  total_time_seconds?: number;
  total_time_formatted?: string;
  red_flags?: number;
  orange_flags?: number;
  yellow_flags?: number;
  green_flags?: number;
}

const MIN_COMPARE = 2;
const MAX_COMPARE = 5;

type MetricDef = {
  key: string;
  label: string;
  higherIsBetter: boolean | null;
  getValue: (e: EmployeeCompareSummary) => number;
  format: (value: number, e: EmployeeCompareSummary) => string;
};

const METRICS: MetricDef[] = [
  {
    key: 'total_tasks',
    label: 'Total Tasks',
    higherIsBetter: null,
    getValue: (e) => Number(e.total_tasks ?? 0),
    format: (v) => String(v),
  },
  {
    key: 'active_tasks',
    label: 'Active Tasks',
    higherIsBetter: null,
    getValue: (e) => Number(e.active_tasks ?? 0),
    format: (v) => String(v),
  },
  {
    key: 'in_progress_tasks',
    label: 'In Progress',
    higherIsBetter: null,
    getValue: (e) => Number(e.in_progress_tasks ?? 0),
    format: (v) => String(v),
  },
  {
    key: 'completed_tasks',
    label: 'Completed',
    higherIsBetter: true,
    getValue: (e) => Number(e.completed_tasks ?? 0),
    format: (v) => String(v),
  },
  {
    key: 'overdue_tasks',
    label: 'Overdue',
    higherIsBetter: false,
    getValue: (e) => Number(e.overdue_tasks ?? 0),
    format: (v) => String(v),
  },
  {
    key: 'completion_rate',
    label: 'Completion Rate',
    higherIsBetter: true,
    getValue: (e) => Number(e.completion_rate ?? 0),
    format: (v) => `${v}%`,
  },
  {
    key: 'total_projects',
    label: 'Total Projects',
    higherIsBetter: null,
    getValue: (e) => Number(e.total_projects ?? 0),
    format: (v) => String(v),
  },
  {
    key: 'active_projects',
    label: 'Active Projects',
    higherIsBetter: null,
    getValue: (e) => Number(e.active_projects ?? 0),
    format: (v) => String(v),
  },
  {
    key: 'total_time',
    label: 'Time Tracked',
    higherIsBetter: null,
    getValue: (e) => Number(e.total_time_seconds ?? 0),
    format: (_, e) => e.total_time_formatted || '0h',
  },
  {
    key: 'red_flags',
    label: 'Red Flags',
    higherIsBetter: false,
    getValue: (e) => Number(e.red_flags ?? 0),
    format: (v) => String(v),
  },
  {
    key: 'orange_flags',
    label: 'Orange Flags',
    higherIsBetter: false,
    getValue: (e) => Number(e.orange_flags ?? 0),
    format: (v) => String(v),
  },
  {
    key: 'green_flags',
    label: 'Green Flags',
    higherIsBetter: true,
    getValue: (e) => Number(e.green_flags ?? 0),
    format: (v) => String(v),
  },
];

function cellHighlight(
  value: number,
  values: number[],
  higherIsBetter: boolean | null
): string {
  if (higherIsBetter === null || values.length < 2) return '';
  const unique = new Set(values);
  if (unique.size <= 1) return '';

  const max = Math.max(...values);
  const min = Math.min(...values);
  if (value === max && value === min) return '';

  if (higherIsBetter) {
    if (value === max) return 'bg-green-50 ring-1 ring-inset ring-green-200';
    if (value === min) return 'bg-amber-50 ring-1 ring-inset ring-amber-200';
  } else {
    if (value === min) return 'bg-green-50 ring-1 ring-inset ring-green-200';
    if (value === max) return 'bg-red-50 ring-1 ring-inset ring-red-200';
  }
  return '';
}

function CompareBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="mt-1.5 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
      <div
        className="h-full rounded-full bg-blue-500 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

interface EmployeeCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: EmployeeCompareSummary[];
  initialSelectedIds?: number[];
}

export function EmployeeCompareModal({
  isOpen,
  onClose,
  employees,
  initialSelectedIds = [],
}: EmployeeCompareModalProps) {
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const validInitial = initialSelectedIds.filter((id) =>
      employees.some((e) => e.id === id)
    );
    setSelectedIds(validInitial.slice(0, MAX_COMPARE));
    setSearch('');
    setTeamFilter('all');
  }, [isOpen, initialSelectedIds, employees]);

  const teamOptions = useMemo(() => {
    const teams = new Set<string>();
    employees.forEach((e) => e.team_names?.forEach((t) => teams.add(t)));
    return Array.from(teams).sort((a, b) => a.localeCompare(b));
  }, [employees]);

  const filteredPicker = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (teamFilter !== 'all' && !e.team_names?.includes(teamFilter)) return false;
      if (!q) return true;
      return (
        e.name?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q) ||
        e.team_names?.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [employees, search, teamFilter]);

  const selectedEmployees = useMemo(
    () => selectedIds
      .map((id) => employees.find((e) => e.id === id))
      .filter((e): e is EmployeeCompareSummary => !!e),
    [selectedIds, employees]
  );

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, id];
    });
  };

  const canCompare = selectedEmployees.length >= MIN_COMPARE;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Compare Team Members"
      size="2xl"
      bodyClassName="p-0"
      subtitle={
        <span className="text-sm text-gray-500">
          Select {MIN_COMPARE}–{MAX_COMPARE} people from any team to compare workload side by side
        </span>
      }
    >
      <div className="flex flex-col lg:flex-row min-h-[420px] max-h-[75vh]">
        {/* Picker */}
        <div className="lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-gray-100 flex flex-col min-h-0">
          <div className="p-4 space-y-2 border-b border-gray-100 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search members…"
                className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            {teamOptions.length > 0 && (
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
              >
                <option value="all">All teams</option>
                {teamOptions.map((team) => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
            )}
            <p className="text-xs text-gray-500">
              {selectedIds.length}/{MAX_COMPARE} selected
              {selectedIds.length >= MAX_COMPARE && ' · maximum reached'}
            </p>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
            {filteredPicker.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">No members match</p>
            ) : (
              filteredPicker.map((emp) => {
                const checked = selectedIds.includes(emp.id);
                const disabled = !checked && selectedIds.length >= MAX_COMPARE;
                return (
                  <label
                    key={emp.id}
                    className={`flex items-start gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                      checked
                        ? 'border-blue-200 bg-blue-50'
                        : disabled
                          ? 'border-transparent opacity-50 cursor-not-allowed'
                          : 'border-transparent hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleSelect(emp.id)}
                      className="mt-1 rounded border-gray-300"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{emp.name}</p>
                      {emp.team_names && emp.team_names.length > 0 && (
                        <p className="text-xs text-gray-500 truncate">{emp.team_names.join(', ')}</p>
                      )}
                      <div className="mt-1 flex gap-1">
                        <Badge variant="default" size="sm">{emp.active_tasks ?? 0} active</Badge>
                        {(emp.overdue_tasks ?? 0) > 0 && (
                          <Badge variant="danger" size="sm">{emp.overdue_tasks} overdue</Badge>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* Comparison */}
        <div className="flex-1 min-h-0 flex flex-col min-w-0">
          {selectedEmployees.length > 0 && (
            <div className="shrink-0 flex flex-wrap gap-2 p-4 border-b border-gray-100 bg-gray-50/50">
              {selectedEmployees.map((emp) => (
                <span
                  key={emp.id}
                  className="inline-flex items-center gap-1 rounded-full bg-white border border-gray-200 pl-3 pr-1 py-1 text-sm"
                >
                  <span className="font-medium text-gray-800 truncate max-w-[140px]">{emp.name}</span>
                  <button
                    type="button"
                    onClick={() => toggleSelect(emp.id)}
                    className="rounded-full p-0.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                    aria-label={`Remove ${emp.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-auto p-4">
            {!canCompare ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center text-gray-500">
                <Users className="h-10 w-10 text-gray-300 mb-3" />
                <p className="font-medium text-gray-700">Select at least {MIN_COMPARE} people to compare</p>
                <p className="mt-1 text-sm max-w-sm">
                  Pick peers from the same team or across teams to see task load, completion, and flags side by side.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse min-w-[520px]">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-white text-left text-xs font-semibold uppercase tracking-wide text-gray-500 pb-3 pr-4 min-w-[140px]">
                        Metric
                      </th>
                      {selectedEmployees.map((emp) => (
                        <th key={emp.id} className="text-left pb-3 px-3 min-w-[130px]">
                          <p className="font-semibold text-gray-900 truncate">{emp.name}</p>
                          {emp.team_names && emp.team_names.length > 0 && (
                            <p className="text-xs font-normal text-gray-500 truncate mt-0.5">
                              {emp.team_names.join(', ')}
                            </p>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {METRICS.map((metric) => {
                      const values = selectedEmployees.map((e) => metric.getValue(e));
                      const rowMax = Math.max(...values, 0);

                      return (
                        <tr key={metric.key} className="border-t border-gray-100">
                          <td className="sticky left-0 z-10 bg-white py-3 pr-4 font-medium text-gray-700 align-top">
                            <div className="flex items-center gap-1.5">
                              {metric.higherIsBetter === true && (
                                <ArrowUp className="h-3.5 w-3.5 text-green-500 shrink-0" title="Higher is better" />
                              )}
                              {metric.higherIsBetter === false && (
                                <ArrowDown className="h-3.5 w-3.5 text-red-500 shrink-0" title="Lower is better" />
                              )}
                              {metric.higherIsBetter === null && (
                                <Minus className="h-3.5 w-3.5 text-gray-300 shrink-0" title="Neutral metric" />
                              )}
                              <span>{metric.label}</span>
                            </div>
                          </td>
                          {selectedEmployees.map((emp, idx) => {
                            const value = values[idx];
                            const highlight = cellHighlight(value, values, metric.higherIsBetter);
                            return (
                              <td
                                key={emp.id}
                                className={`py-3 px-3 align-top rounded-lg ${highlight}`}
                              >
                                <p className="font-semibold text-gray-900 tabular-nums">
                                  {metric.format(value, emp)}
                                </p>
                                {metric.key !== 'completion_rate' && metric.key !== 'total_time' && (
                                  <CompareBar value={value} max={rowMax} />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <p className="mt-4 text-xs text-gray-400">
                  Green highlights the best peer value; amber/red marks the lowest for ranked metrics.
                  Bars show relative scale within this comparison group.
                </p>
              </div>
            )}
          </div>

          <div className="shrink-0 flex justify-end gap-2 p-4 border-t border-gray-100">
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
