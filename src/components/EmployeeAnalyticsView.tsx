import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users,
  Search,
  FolderOpen,
  CheckSquare,
  AlertTriangle,
  Flag,
  Mail,
  Briefcase,
  RefreshCw,
  LayoutGrid,
  ChevronRight,
  GitCompare,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { ProgressBar } from './ui/ProgressBar';
import { analyticsService } from '../services/apiService';
import { TaskDetails } from './TaskDetails';
import { getTaskStatusBadgeVariant, getTaskStatusLabel } from '../utils/taskStatusDisplay';
import { EmployeeCompareModal } from './EmployeeCompareModal';

const KANBAN_COLUMNS: { key: string; label: string; color: string }[] = [
  { key: 'not-started', label: 'Not Started', color: 'border-t-gray-400' },
  { key: 'in-progress', label: 'In Progress', color: 'border-t-blue-500' },
  { key: 'under-review', label: 'Under Review', color: 'border-t-amber-500' },
  { key: 'resubmitted', label: 'Resubmitted', color: 'border-t-amber-400' },
  { key: 'returned', label: 'Returned', color: 'border-t-orange-500' },
  { key: 'redo-requested', label: 'Rework Requested', color: 'border-t-orange-400' },
  { key: 'blocked', label: 'Blocked', color: 'border-t-red-500' },
  { key: 'on-hold', label: 'On Hold', color: 'border-t-slate-400' },
  { key: 'completed', label: 'Completed', color: 'border-t-green-500' },
  { key: 'skipped', label: 'Skipped', color: 'border-t-gray-300' },
];

const PRIORITY_VARIANT: Record<string, 'danger' | 'warning' | 'default' | 'secondary'> = {
  urgent: 'danger',
  high: 'warning',
  medium: 'default',
  low: 'secondary',
};

interface EmployeeSummary {
  id: number;
  name: string;
  email?: string;
  role?: string;
  employee_id?: string;
  skills?: string[];
  team_names?: string[];
  total_projects?: number;
  active_projects?: number;
  total_tasks?: number;
  active_tasks?: number;
  completed_tasks?: number;
  in_progress_tasks?: number;
  overdue_tasks?: number;
  completion_rate?: number;
  total_time_formatted?: string;
  red_flags?: number;
  orange_flags?: number;
  yellow_flags?: number;
  green_flags?: number;
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${accent}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
        </div>
        <Icon className="h-5 w-5 shrink-0 text-gray-400" />
      </div>
    </div>
  );
}

function KanbanTaskCard({ task, onOpen }: { task: any; onOpen: (task: { id: number; name: string }) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen({ id: task.id, name: task.name })}
      className={`w-full text-left rounded-lg border bg-white p-3 shadow-sm transition-all hover:shadow-md hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 cursor-pointer ${
        task.is_overdue ? 'border-red-200 ring-1 ring-red-100' : 'border-gray-200'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-900 line-clamp-2">{task.name}</p>
        {task.is_overdue && (
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" title="Overdue" />
        )}
      </div>
      <p className="mt-1 text-xs text-gray-500 line-clamp-1">{task.project_name || 'No project'}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant={PRIORITY_VARIANT[task.priority] ?? 'default'} size="sm">
          {task.priority || 'medium'}
        </Badge>
        {task.stage_name && (
          <span className="text-xs text-gray-400 truncate max-w-[120px]">{task.stage_name}</span>
        )}
      </div>
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Progress</span>
          <span>{task.progress ?? 0}%</span>
        </div>
        <ProgressBar value={Number(task.progress ?? 0)} showLabel={false} />
      </div>
      {task.end_date && (
        <p className="mt-2 text-xs text-gray-400">
          Due {new Date(task.end_date).toLocaleDateString()}
        </p>
      )}
      {Number(task.rework_count) > 0 && (
        <p className="mt-1 text-xs text-orange-600">Rework ×{task.rework_count}</p>
      )}
    </button>
  );
}

export function EmployeeAnalyticsView() {
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'employee' | 'project_manager'>('all');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hideEmptyColumns, setHideEmptyColumns] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTaskName, setSelectedTaskName] = useState<string>('Task Details');
  const [modalTaskMeta, setModalTaskMeta] = useState<{ status: string; priority: string } | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);

  const handleTaskOpen = useCallback((task: { id: number; name: string }) => {
    setSelectedTaskId(String(task.id));
    setSelectedTaskName(task.name || 'Task Details');
  }, []);

  const loadEmployees = useCallback(async () => {
    try {
      setLoadingList(true);
      setError(null);
      const list = await analyticsService.getEmployeeAnalytics();
      setEmployees(list);
      return list;
    } catch (err: any) {
      setError(err.message || 'Failed to load employee analytics');
      return [];
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees().then((list) => {
      if (list.length > 0) {
        setSelectedId((prev) => prev ?? list[0].id);
      }
    });
  }, [loadEmployees]);

  const loadDetail = useCallback(async (memberId: number) => {
    try {
      setLoadingDetail(true);
      setError(null);
      const data = await analyticsService.getEmployeeAnalyticsDetail(memberId);
      setDetail(data);
    } catch (err: any) {
      setDetail(null);
      setError(err.message || 'Failed to load employee details');
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const handleTaskBack = useCallback(() => {
    setSelectedTaskId(null);
    setSelectedTaskName('Task Details');
    setModalTaskMeta(null);
    if (selectedId) {
      loadDetail(selectedId);
      loadEmployees();
    }
  }, [selectedId, loadDetail, loadEmployees]);

  useEffect(() => {
    if (selectedId) {
      setSelectedTaskId(null);
      setSelectedTaskName('Task Details');
      setModalTaskMeta(null);
      loadDetail(selectedId);
    } else {
      setDetail(null);
      setSelectedTaskId(null);
      setSelectedTaskName('Task Details');
    }
  }, [selectedId, loadDetail]);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (roleFilter !== 'all' && e.role !== roleFilter) return false;
      if (!q) return true;
      return (
        e.name?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q) ||
        e.employee_id?.toLowerCase().includes(q) ||
        e.team_names?.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [employees, search, roleFilter]);

  const visibleKanbanColumns = useMemo(() => {
    if (!detail?.kanban) return KANBAN_COLUMNS;
    if (!hideEmptyColumns) return KANBAN_COLUMNS;
    return KANBAN_COLUMNS.filter((col) => (detail.kanban[col.key] ?? []).length > 0);
  }, [detail, hideEmptyColumns]);

  const selectedSummary = employees.find((e) => e.id === selectedId);

  if (loadingList && employees.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
          <p className="text-gray-600">Loading employee analytics…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Employee Task Analytics
          </h2>
          <p className="text-sm text-gray-500">
            Per-assignee workload, projects, and Kanban task board
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={hideEmptyColumns}
              onChange={(e) => setHideEmptyColumns(e.target.checked)}
              className="rounded border-gray-300"
            />
            Hide empty columns
          </label>
          <Button
            variant="outline"
            onClick={() => setCompareOpen(true)}
            title="Compare team members side by side"
          >
            <GitCompare className="h-4 w-4 mr-1" />
            Compare
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              loadEmployees();
              if (selectedId) loadDetail(selectedId);
            }}
            title="Refresh employee data"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${loadingList || loadingDetail ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Card className="shrink-0">
          <CardContent className="p-4 text-sm text-red-700 bg-red-50 rounded-lg">
            {error}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-1 min-h-0 flex-col lg:flex-row gap-4 overflow-hidden">
        {/* Employee list — fixed column; list scrolls inside */}
        <Card className="hidden lg:flex lg:w-72 xl:w-80 shrink-0 flex-col h-full min-h-0 overflow-hidden">
          <CardHeader className="pb-2 shrink-0 border-b border-gray-100">
            <CardTitle className="text-base">Team Members</CardTitle>
            <div className="mt-2 space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, email, team…"
                  className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
              >
                <option value="all">All roles</option>
                <option value="employee">Employees</option>
                <option value="project_manager">Project Managers</option>
              </select>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-1 pt-3">
            {filteredEmployees.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No members match your filters</p>
            ) : (
              filteredEmployees.map((emp) => {
                const active = emp.id === selectedId;
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => setSelectedId(emp.id)}
                    className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors ${
                      active ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{emp.name}</p>
                        <p className="text-xs text-gray-500 truncate">{emp.email}</p>
                      </div>
                      <ChevronRight className={`h-4 w-4 shrink-0 ${active ? 'text-blue-500' : 'text-gray-300'}`} />
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <Badge variant="default" size="sm">{emp.active_tasks ?? 0} active</Badge>
                      {(emp.overdue_tasks ?? 0) > 0 && (
                        <Badge variant="danger" size="sm">{emp.overdue_tasks} overdue</Badge>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Mobile member picker */}
        <div className="lg:hidden shrink-0 space-y-2">
          <label className="text-sm font-medium text-gray-700">Team Member</label>
          <select
            value={selectedId ?? ''}
            onChange={(e) => setSelectedId(Number(e.target.value))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            {filteredEmployees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name} ({emp.active_tasks ?? 0} active)
              </option>
            ))}
          </select>
        </div>

        {/* Detail + Kanban — only this column scrolls */}
        <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overscroll-contain pr-1 space-y-4">
          {!selectedId ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                Select a team member to view their analytics
              </CardContent>
            </Card>
          ) : loadingDetail && !detail ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">Loading member details…</CardContent>
            </Card>
          ) : detail ? (
            <>
              {/* Profile + stats */}
              <Card>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{detail.member?.name}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-600">
                        {detail.member?.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3.5 w-3.5" />
                            {detail.member.email}
                          </span>
                        )}
                        {detail.member?.employee_id && (
                          <span>ID: {detail.member.employee_id}</span>
                        )}
                        {detail.member?.role && (
                          <Badge variant={detail.member.role === 'project_manager' ? 'primary' : 'default'}>
                            {detail.member.role === 'project_manager' ? 'Project Manager' : 'Employee'}
                          </Badge>
                        )}
                        {detail.member?.department && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="h-3.5 w-3.5" />
                            {detail.member.department}
                            {detail.member.position ? ` · ${detail.member.position}` : ''}
                          </span>
                        )}
                      </div>
                      {detail.member?.team_names?.length > 0 && (
                        <p className="mt-2 text-sm text-gray-500">
                          Teams: {detail.member.team_names.join(', ')}
                        </p>
                      )}
                      {detail.member?.skills?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {detail.member.skills.map((skill: string) => (
                            <Badge key={skill} variant="secondary" size="sm">{skill}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-blue-600">{detail.stats?.completion_rate ?? 0}%</p>
                      <p className="text-xs text-gray-500">Completion rate</p>
                      <p className="mt-1 text-sm text-gray-600">{detail.stats?.total_time_formatted} tracked</p>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard
                      label="Total Projects"
                      value={detail.stats?.total_projects ?? 0}
                      sub={`${detail.stats?.current_projects ?? 0} currently active`}
                      icon={FolderOpen}
                      accent="border-l-4 border-l-indigo-400"
                    />
                    <StatCard
                      label="Total Tasks"
                      value={detail.stats?.total_tasks ?? 0}
                      sub={`${detail.stats?.completed_tasks ?? 0} completed`}
                      icon={CheckSquare}
                      accent="border-l-4 border-l-blue-400"
                    />
                    <StatCard
                      label="Active Tasks"
                      value={detail.stats?.active_tasks ?? 0}
                      sub={`${detail.stats?.in_progress_tasks ?? 0} in progress`}
                      icon={LayoutGrid}
                      accent="border-l-4 border-l-amber-400"
                    />
                    <StatCard
                      label="Overdue"
                      value={detail.stats?.overdue_tasks ?? 0}
                      sub={`${detail.stats?.allocated_hours_today ?? 0}h allocated today`}
                      icon={AlertTriangle}
                      accent="border-l-4 border-l-red-400"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Current projects */}
              {detail.current_projects_list?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FolderOpen className="h-4 w-4" />
                      Current Active Projects
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {detail.current_projects_list.map((project: any) => (
                        <div key={project.id} className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-gray-900">{project.name}</p>
                            <Badge variant="primary" size="sm">{project.status}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            {project.active_tasks} active · {project.completed_tasks} done
                            {(project.overdue_tasks ?? 0) > 0 && ` · ${project.overdue_tasks} overdue`}
                          </p>
                          <ProgressBar value={Number(project.progress ?? 0)} className="mt-2" showLabel={false} />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Performance flags */}
              {detail.performance_flags?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Flag className="h-4 w-4" />
                      Performance Flags
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {detail.performance_flags.slice(0, 5).map((flag: any) => (
                      <div key={flag.id} className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
                        <div>
                          <Badge
                            variant={
                              flag.type === 'red' ? 'danger' :
                              flag.type === 'orange' ? 'warning' :
                              flag.type === 'green' ? 'success' : 'default'
                            }
                          >
                            {flag.type}
                          </Badge>
                          <p className="mt-1 text-gray-700">{flag.reason}</p>
                          {flag.task_name && (
                            <p className="text-xs text-gray-500">{flag.project_name} · {flag.task_name}</p>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">
                          {new Date(flag.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Kanban board */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4" />
                    Task Kanban
                    <Badge variant="default">{detail.stats?.total_tasks ?? 0} tasks</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {visibleKanbanColumns.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No assigned tasks for this member</p>
                  ) : (
                    <div className="flex gap-3 overflow-x-auto pb-2 min-h-[320px]">
                      {visibleKanbanColumns.map((col) => {
                        const tasks: any[] = detail.kanban?.[col.key] ?? [];
                        return (
                          <div
                            key={col.key}
                            className={`flex-shrink-0 w-72 rounded-xl border border-gray-200 bg-gray-50/80 border-t-4 ${col.color}`}
                          >
                            <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200 bg-white rounded-t-xl">
                              <span className="text-sm font-semibold text-gray-800">{col.label}</span>
                              <Badge variant="default" size="sm">{tasks.length}</Badge>
                            </div>
                            <div className="p-2 space-y-2 max-h-[480px] overflow-y-auto">
                              {tasks.length === 0 ? (
                                <p className="text-xs text-gray-400 text-center py-6">Empty</p>
                              ) : (
                                tasks.map((task) => (
                                  <KanbanTaskCard key={task.id} task={task} onOpen={handleTaskOpen} />
                                ))
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* All projects table */}
              {detail.projects?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">All Projects Worked On</CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-gray-500">
                          <th className="pb-2 pr-4 font-medium">Project</th>
                          <th className="pb-2 pr-4 font-medium">Status</th>
                          <th className="pb-2 pr-4 font-medium">Tasks</th>
                          <th className="pb-2 pr-4 font-medium">Active</th>
                          <th className="pb-2 pr-4 font-medium">Overdue</th>
                          <th className="pb-2 font-medium">Progress</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.projects.map((project: any) => (
                          <tr key={project.id} className="border-b border-gray-100">
                            <td className="py-2.5 pr-4 font-medium text-gray-900">{project.name}</td>
                            <td className="py-2.5 pr-4">
                              <Badge variant={project.status === 'active' ? 'primary' : 'default'} size="sm">
                                {project.status}
                              </Badge>
                            </td>
                            <td className="py-2.5 pr-4">{project.total_tasks}</td>
                            <td className="py-2.5 pr-4">{project.active_tasks}</td>
                            <td className="py-2.5 pr-4">
                              {(project.overdue_tasks ?? 0) > 0 ? (
                                <span className="text-red-600 font-medium">{project.overdue_tasks}</span>
                              ) : (
                                '0'
                              )}
                            </td>
                            <td className="py-2.5">
                              <div className="flex items-center gap-2 min-w-[100px]">
                                <ProgressBar value={Number(project.progress ?? 0)} showLabel={false} />
                                <span className="text-xs text-gray-500">{project.progress}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                {selectedSummary?.name
                  ? `No detail data for ${selectedSummary.name}`
                  : 'Employee not found'}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <EmployeeCompareModal
        isOpen={compareOpen}
        onClose={() => setCompareOpen(false)}
        employees={employees}
        initialSelectedIds={selectedId ? [selectedId] : []}
      />

      <Modal
        isOpen={!!selectedTaskId}
        onClose={handleTaskBack}
        title={selectedTaskName}
        size="2xl"
        bodyClassName="p-0"
        subtitle={modalTaskMeta ? (
          <>
            <Badge variant={getTaskStatusBadgeVariant(modalTaskMeta.status)} size="sm">
              {getTaskStatusLabel(modalTaskMeta.status)}
            </Badge>
            <Badge variant="default" size="sm">{modalTaskMeta.priority}</Badge>
          </>
        ) : undefined}
      >
        {selectedTaskId && (
          <TaskDetails
            taskId={selectedTaskId}
            embedded
            onBack={handleTaskBack}
            onTaskMeta={(meta) => {
              setSelectedTaskName(meta.name);
              setModalTaskMeta({ status: meta.status, priority: meta.priority });
            }}
            onTaskUpdate={() => {
              if (selectedId) {
                loadDetail(selectedId);
                loadEmployees();
              }
            }}
          />
        )}
      </Modal>
    </div>
  );
}
