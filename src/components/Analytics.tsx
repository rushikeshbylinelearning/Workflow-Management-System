import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Clock, 
  Target,
  Calendar,
  PieChart,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Play,
  Pause,
  Zap,
  Award,
  TrendingDown,
  Eye,
  Filter,
  Download,
  RefreshCw,
  BarChart,
  LineChart,
  CalendarDays,
  Clock3,
  Star,
  Trophy,
  Rocket,
  Lightbulb,
  Target as TargetIcon,
  Gauge,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { ProgressBar } from './ui/ProgressBar';
import { Button } from './ui/Button';
import { categoryService, skillService, dashboardService, analyticsService } from '../services/apiService';
import { taskHasAssignee, isTaskOverdue, getTasksForSkill, memberHasSkill } from '../utils/analyticsHelpers';
import { EmployeeAnalyticsView } from './EmployeeAnalyticsView';

export function Analytics() {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [viewMode, setViewMode] = useState<'overview' | 'detailed' | 'trends' | 'employees'>('overview');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSkill, setSelectedSkill] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendSummary, setBackendSummary] = useState<any>(null);
  const [teamPerformance, setTeamPerformance] = useState<any[]>([]);
  const [data, setData] = useState({
    projects: [],
    tasks: [],
    teamMembers: [],
    categories: [],
    skills: []
  });

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [overview, summary, performance, categoriesData, skillsData] = await Promise.all([
        dashboardService.getOverview(),
        analyticsService.getSummary().catch(() => null),
        analyticsService.getTeamPerformance().catch(() => []),
        categoryService.getAll(),
        skillService.getAll(),
      ]);

      setData({
        projects: overview.projects || [],
        tasks: overview.tasks || [],
        teamMembers: overview.teamMembers || [],
        categories: Array.isArray(categoriesData) ? categoriesData : (categoriesData?.data || []),
        skills: Array.isArray(skillsData) ? skillsData : (skillsData?.data || []),
      });
      setBackendSummary(summary);
      setTeamPerformance(performance);
    } catch (err: any) {
      console.error('Failed to load analytics data:', err);
      setError(err.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const rows = [
      ['Analytics Export', new Date().toLocaleString()],
      [],
      ['Metric', 'Value'],
      ['Total Projects', analytics.projectStats.total],
      ['Active Projects', analytics.projectStats.active],
      ['Completed Projects', analytics.projectStats.completed],
      ['Total Tasks', analytics.taskStats.total],
      ['Completed Tasks', analytics.taskStats.completed],
      ['In Progress Tasks', analytics.taskStats.inProgress],
      ['Overdue Tasks', analytics.taskStats.overdue],
      ['Team Utilization %', analytics.teamStats.utilization],
      ['Completion Rate %', analytics.productivity.completionRate],
      ['Efficiency Score %', analytics.productivity.efficiency],
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const refreshData = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

    // Advanced analytics calculations with useMemo for performance
  const analytics = useMemo(() => {
    const filteredProjects = selectedCategory === 'all' 
      ? (data.projects || [])
      : (data.projects || []).filter((p: any) => p.category_id === parseInt(selectedCategory));

    const filteredTasks = selectedSkill === 'all'
      ? (data.tasks || [])
      : getTasksForSkill(
          data.tasks || [],
          (data.skills || []).find((s: any) => String(s.id) === selectedSkill) ?? { id: selectedSkill, name: '' },
          data.teamMembers || []
        );

    const now = new Date();
    const timeRangeDays = {
      week: 7,
      month: 30,
      quarter: 90,
      year: 365
    }[timeRange];

    const recentTasks = (data.tasks || []).filter((t: any) => {
      const taskDate = new Date(t.created_at);
      const daysDiff = (now.getTime() - taskDate.getTime()) / (1000 * 3600 * 24);
      return daysDiff <= timeRangeDays;
    });

    const recentProjects = (data.projects || []).filter((p: any) => {
      const projectDate = new Date(p.created_at);
      const daysDiff = (now.getTime() - projectDate.getTime()) / (1000 * 3600 * 24);
      return daysDiff <= timeRangeDays;
    });

    const useBackendTotals = selectedCategory === 'all' && selectedSkill === 'all' && backendSummary;

    return {
      projectStats: {
        total: useBackendTotals ? Number(backendSummary.projects?.total ?? 0) : filteredProjects.length,
        active: useBackendTotals ? Number(backendSummary.projects?.active ?? 0) : filteredProjects.filter((p: any) => p.status === 'active').length,
        completed: useBackendTotals ? Number(backendSummary.projects?.completed ?? 0) : filteredProjects.filter((p: any) => p.status === 'completed').length,
        onHold: useBackendTotals ? Number(backendSummary.projects?.on_hold ?? 0) : filteredProjects.filter((p: any) => p.status === 'on-hold').length,
        recent: recentProjects.length,
        avgDuration: filteredProjects.length > 0 
          ? Math.round(filteredProjects.reduce((sum: number, p: any) => {
              if (p.start_date && p.end_date) {
                const start = new Date(p.start_date);
                const end = new Date(p.end_date);
                return sum + (end.getTime() - start.getTime()) / (1000 * 3600 * 24);
              }
              return sum;
            }, 0) / filteredProjects.length)
          : 0
      },
      taskStats: {
        total: useBackendTotals ? Number(backendSummary.tasks?.total ?? 0) : filteredTasks.length,
        completed: useBackendTotals ? Number(backendSummary.tasks?.completed ?? 0) : filteredTasks.filter((t: any) => t.status === 'completed').length,
        inProgress: useBackendTotals
          ? Number(backendSummary.tasks?.in_progress ?? 0) + Number(backendSummary.tasks?.under_review ?? 0)
          : filteredTasks.filter((t: any) => t.status === 'in-progress' || t.status === 'under-review').length,
        overdue: useBackendTotals
          ? Number(backendSummary.tasks?.overdue ?? 0)
          : filteredTasks.filter((t: any) => isTaskOverdue(t)).length,
        recent: recentTasks.length,
        avgCompletionTime: filteredTasks.filter((t: any) => t.status === 'completed').length > 0
          ? Math.round(filteredTasks.filter((t: any) => t.status === 'completed').reduce((sum: number, t: any) => {
              if (t.created_at && t.updated_at) {
                const created = new Date(t.created_at);
                const updated = new Date(t.updated_at);
                return sum + (updated.getTime() - created.getTime()) / (1000 * 3600 * 24);
              }
              return sum;
            }, 0) / filteredTasks.filter((t: any) => t.status === 'completed').length)
          : 0
      },
      teamStats: {
        total: useBackendTotals ? Number(backendSummary.team?.total_members ?? 0) : (data.teamMembers || []).length,
        active: useBackendTotals
          ? Number(backendSummary.team?.active_members ?? 0)
          : (data.teamMembers || []).filter((u: any) => filteredTasks.some((t: any) => taskHasAssignee(t, u.id) && t.status !== 'completed')).length,
        available: (data.teamMembers || []).filter((u: any) => !filteredTasks.some((t: any) => taskHasAssignee(t, u.id) && t.status !== 'completed')).length,
        utilization: useBackendTotals && backendSummary.team?.total_members > 0
          ? Math.round((Number(backendSummary.team?.active_members ?? 0) / Number(backendSummary.team.total_members)) * 100)
          : (data.teamMembers || []).length > 0
          ? Math.round(((data.teamMembers || []).filter((u: any) => filteredTasks.some((t: any) => taskHasAssignee(t, u.id) && t.status !== 'completed')).length / (data.teamMembers || []).length) * 100)
          : 0
      },
      productivity: {
        completionRate: filteredTasks.length > 0 ? Math.round((filteredTasks.filter((t: any) => t.status === 'completed').length / filteredTasks.length) * 100) : 0,
        averageProgress: filteredProjects.length > 0 ? Math.round(filteredProjects.reduce((sum: number, p: any) => sum + (p.progress || 0), 0) / filteredProjects.length) : 0,
        efficiency: filteredTasks.length > 0 
          ? Math.round((filteredTasks.filter((t: any) => t.status === 'completed').length / filteredTasks.length) * 100)
          : 0
      },
      trends: {
        taskGrowth: recentTasks.length > 0 ? Math.round((recentTasks.length / (data.tasks || []).length) * 100) : 0,
        projectGrowth: recentProjects.length > 0 ? Math.round((recentProjects.length / (data.projects || []).length) * 100) : 0,
        completionTrend: recentTasks.filter((t: any) => t.status === 'completed').length > 0 
          ? Math.round((recentTasks.filter((t: any) => t.status === 'completed').length / recentTasks.length) * 100)
          : 0
      }
    };
  }, [data, timeRange, selectedCategory, selectedSkill, backendSummary]);

  // Enhanced analytics with advanced metrics
  const categoryDistribution = useMemo(() => (data.categories || []).map((category: any) => ({
    name: category.name,
    count: (data.projects || []).filter((p: any) => p.category_id === category.id).length,
    percentage: (data.projects || []).length > 0 ? Math.round(((data.projects || []).filter((p: any) => p.category_id === category.id).length / (data.projects || []).length) * 100) : 0,
    avgProgress: (data.projects || []).filter((p: any) => p.category_id === category.id).length > 0 
      ? Math.round((data.projects || []).filter((p: any) => p.category_id === category.id).reduce((sum: number, p: any) => sum + (p.progress || 0), 0) / (data.projects || []).filter((p: any) => p.category_id === category.id).length)
      : 0,
    completionRate: (data.projects || []).filter((p: any) => p.category_id === category.id).length > 0
      ? Math.round(((data.projects || []).filter((p: any) => p.category_id === category.id && p.status === 'completed').length / (data.projects || []).filter((p: any) => p.category_id === category.id).length) * 100)
      : 0
  })), [data]);

  const skillUtilization = useMemo(() => {
    const allTasks = data.tasks || [];
    const allMembers = data.teamMembers || [];
    const totalTaskCount = allTasks.length || 1;

    return (data.skills || []).map((skill: any) => {
      const skillTasks = getTasksForSkill(allTasks, skill, allMembers);
      const skillUsers = allMembers.filter((u: any) => memberHasSkill(u, skill));

      const users = skillUsers.length || Number(skill.team_member_count ?? 0);
      const totalTasks = skillTasks.length || Number(skill.task_count ?? 0);
      const completed = skillTasks.filter((t: any) => t.status === 'completed').length;
      const activeTasks = skillTasks.filter((t: any) => !['completed', 'skipped'].includes(t.status)).length;

      return {
        name: skill.name,
        users,
        activeTasks: skillTasks.length > 0 ? activeTasks : totalTasks,
        totalTasks,
        completionRate: skillTasks.length > 0
          ? Math.round((completed / skillTasks.length) * 100)
          : 0,
        demand: totalTasks > 0 ? Math.round((totalTasks / totalTaskCount) * 100) : 0,
      };
    }).sort((a, b) => b.totalTasks - a.totalTasks || b.users - a.users);
  }, [data]);

  const topPerformers = useMemo(() => {
    if (teamPerformance.length > 0 && selectedCategory === 'all' && selectedSkill === 'all') {
      return teamPerformance.slice(0, 5).map((m: any) => ({
        id: m.id,
        name: m.name,
        totalTasks: Number(m.assigned_tasks ?? 0),
        completedTasks: Number(m.completed_tasks ?? 0),
        completionRate: Number(m.completion_rate ?? 0),
        efficiencyScore: Math.round(Number(m.completion_rate ?? 0)),
        avgTaskDuration: 0,
      }));
    }

    return (data.teamMembers || [])
    .filter((user: any) => user.is_active === true || user.is_active === 1)
    .map((user: any) => {
    const userTasks = (data.tasks || []).filter((t: any) => taskHasAssignee(t, user.id));
    const completedTasks = userTasks.filter((t: any) => t.status === 'completed');
    const completionRate = userTasks.length > 0 ? Math.round((completedTasks.length / userTasks.length) * 100) : 0;
    
    // Calculate efficiency score
    const efficiencyScore = userTasks.length > 0 
      ? Math.round((completionRate * 0.4) + ((userTasks.filter((t: any) => {
          if (t.status !== 'completed') return false;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const dueDate = new Date(t.end_date);
          dueDate.setHours(0, 0, 0, 0);
          return dueDate >= today;
        }).length / userTasks.length) * 60))
      : 0;
    
    return {
      ...user,
      totalTasks: userTasks.length,
      completedTasks: completedTasks.length,
      completionRate,
      efficiencyScore,
      avgTaskDuration: completedTasks.length > 0 
        ? Math.round(completedTasks.reduce((sum: number, t: any) => {
            if (t.created_at && t.updated_at) {
              const created = new Date(t.created_at);
              const updated = new Date(t.updated_at);
              return sum + (updated.getTime() - created.getTime()) / (1000 * 3600 * 24);
            }
            return sum;
          }, 0) / completedTasks.length)
        : 0
    };
  }).sort((a: any, b: any) => b.efficiencyScore - a.efficiencyScore).slice(0, 5);
  }, [data, teamPerformance, selectedCategory, selectedSkill]);

  // Additional advanced metrics
  const performanceInsights = useMemo(() => {
    const overdueTasks = (data.tasks || []).filter((t: any) => isTaskOverdue(t));
    const highPriorityTasks = (data.tasks || []).filter((t: any) => t.priority === 'high');
    const lowProgressProjects = (data.projects || []).filter((p: any) => (p.progress || 0) < 30);
    
    return {
      overdueTasks: overdueTasks.length,
      highPriorityTasks: highPriorityTasks.length,
      lowProgressProjects: lowProgressProjects.length,
      riskScore: Math.round((overdueTasks.length * 0.4 + highPriorityTasks.length * 0.3 + lowProgressProjects.length * 0.3) / Math.max((data.tasks || []).length + (data.projects || []).length, 1) * 100),
      efficiencyGap: analytics.productivity.completionRate > 0 ? Math.round((100 - analytics.productivity.completionRate) / 10) : 0
    };
  }, [data, analytics]);

  const timeBasedMetrics = useMemo(() => {
    const now = new Date();
    const thisWeek = (data.tasks || []).filter((t: any) => {
      const taskDate = new Date(t.created_at);
      const daysDiff = (now.getTime() - taskDate.getTime()) / (1000 * 3600 * 24);
      return daysDiff <= 7;
    });
    
    const thisMonth = (data.tasks || []).filter((t: any) => {
      const taskDate = new Date(t.created_at);
      const daysDiff = (now.getTime() - taskDate.getTime()) / (1000 * 3600 * 24);
      return daysDiff <= 30;
    });

    return {
      weeklyGrowth: thisWeek.length > 0 ? Math.round((thisWeek.length / data.tasks.length) * 100) : 0,
      monthlyGrowth: thisMonth.length > 0 ? Math.round((thisMonth.length / data.tasks.length) * 100) : 0,
      weeklyCompletion: thisWeek.filter((t: any) => t.status === 'completed').length,
      monthlyCompletion: thisMonth.filter((t: any) => t.status === 'completed').length
    };
  }, [data]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading analytics from server...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-900 font-medium mb-2">Failed to load analytics</p>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={refreshData} title="Retry loading analytics data from the backend">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const viewModeTips = {
    overview: 'Summary KPIs, project status breakdown, and category performance',
    detailed: 'Top performers, skill demand, and performance insights',
    trends: 'Growth metrics and task timeline over time',
    employees: 'Per-assignee projects, workload stats, and Kanban task board',
  };

  return (
    <div className={viewMode === 'employees'
      ? 'p-6 flex flex-col gap-4 h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] overflow-hidden'
      : 'p-6 space-y-6'}>
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 text-white p-6 shadow-lg shrink-0">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-14 -left-12 w-56 h-56 bg-white/10 rounded-full blur-2xl" />
        <div className="relative z-10 flex items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
            <p className="text-white/80">
              Live metrics from the backend API
              {backendSummary ? ' · synced' : ''}
            </p>
          </div>
          <div className="flex items-center space-x-3">
          {/* View Mode Toggle */}
          <div className="flex items-center space-x-1 bg-black/30 rounded-lg p-1">
            {(['overview', 'detailed', 'trends', 'employees'] as const).map((mode) => {
              const icons = {
                overview: <Eye className="w-4 h-4 mr-1" />,
                detailed: <BarChart className="w-4 h-4 mr-1" />,
                trends: <TrendingUp className="w-4 h-4 mr-1" />,
                employees: <Users className="w-4 h-4 mr-1" />,
              };
              const labels = {
                overview: 'Overview',
                detailed: 'Detailed',
                trends: 'Trends',
                employees: 'Employees',
              };
              const active = viewMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  title={viewModeTips[mode]}
                  className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors focus:outline-none ${
                    active
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {icons[mode]}
                  {labels[mode]}
                </button>
              );
            })}
          </div>

          {/* Filters */}
          <div className="flex items-center space-x-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              title="Filter projects and related metrics by category"
              className="border border-gray-500 bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-400 focus:border-transparent"
            >
              <option value="all" className="text-gray-900 bg-white">All Categories</option>
              {data.categories.map((category: any) => (
                <option key={category.id} value={category.id} className="text-gray-900 bg-white">{category.name}</option>
              ))}
            </select>
            <select
              value={selectedSkill}
              onChange={(e) => setSelectedSkill(e.target.value)}
              title="Filter tasks and team metrics by required skill"
              className="border border-gray-500 bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-400 focus:border-transparent"
            >
              <option value="all" className="text-gray-900 bg-white">All Skills</option>
              {data.skills.map((skill: any) => (
                <option key={skill.id} value={skill.id} className="text-gray-900 bg-white">{skill.name}</option>
              ))}
            </select>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              title="Limit recent activity and growth calculations to this time window"
              className="border border-gray-500 bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-400 focus:border-transparent"
            >
              <option value="week" className="text-gray-900 bg-white">Last Week</option>
              <option value="month" className="text-gray-900 bg-white">Last Month</option>
              <option value="quarter" className="text-gray-900 bg-white">Last Quarter</option>
              <option value="year" className="text-gray-900 bg-white">Last Year</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={refreshData}
              disabled={refreshing}
              title="Reload all analytics data from the backend (projects, tasks, team, KPI summary)"
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-500 text-gray-200 hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleExport}
              title="Download current analytics metrics as a CSV file"
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-500 text-gray-200 hover:bg-gray-700 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              <Download className="w-4 h-4 mr-1" />
              Export
            </button>
          </div>
        </div>
        </div>
      </div>

      {/* Enhanced Key Metrics with Trends */}
      {viewMode === 'employees' && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <EmployeeAnalyticsView />
        </div>
      )}

      {(viewMode === 'overview' || viewMode === 'detailed') && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <p className="text-blue-100 text-sm font-medium">Efficiency Score</p>
                  <Badge variant="default" className="bg-blue-400 text-white text-xs">
                    {analytics.productivity.efficiency > analytics.productivity.completionRate ? 
                      <ArrowUpRight className="w-3 h-3" /> : 
                      <ArrowDownRight className="w-3 h-3" />
                    }
                  </Badge>
                </div>
                <p className="text-3xl font-bold">{analytics.productivity.efficiency}%</p>
                <p className="text-blue-100 text-sm">
                  {analytics.productivity.completionRate}% completion rate
                </p>
              </div>
              <TargetIcon className="w-12 h-12 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <p className="text-green-100 text-sm font-medium">Team Utilization</p>
                  <Badge variant="default" className="bg-green-400 text-white text-xs">
                    {analytics.teamStats.utilization}%
                  </Badge>
                </div>
                <p className="text-3xl font-bold">{analytics.teamStats.active}</p>
                <p className="text-green-100 text-sm">
                  of {analytics.teamStats.total} members active
                </p>
              </div>
              <Users className="w-12 h-12 text-green-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <p className="text-purple-100 text-sm font-medium">Productivity</p>
                  <Badge variant="default" className="bg-purple-400 text-white text-xs">
                    {analytics.trends.completionTrend}% trend
                  </Badge>
                </div>
                <p className="text-3xl font-bold">{analytics.productivity.averageProgress}%</p>
                <p className="text-purple-100 text-sm">
                  {analytics.taskStats.completed}/{analytics.taskStats.total} tasks done
                </p>
              </div>
              <Rocket className="w-12 h-12 text-purple-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <p className="text-red-100 text-sm font-medium">Risk Score</p>
                  <Badge variant="default" className="bg-red-400 text-white text-xs">
                    {performanceInsights.riskScore}%
                  </Badge>
                </div>
                <p className="text-3xl font-bold">{analytics.taskStats.overdue}</p>
                <p className="text-red-100 text-sm">
                  {performanceInsights.highPriorityTasks} high priority
                </p>
              </div>
              <AlertTriangle className="w-12 h-12 text-red-200" />
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      {/* Performance Insights row */}
      {(viewMode === 'overview' || viewMode === 'trends') && (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-100 text-sm font-medium">Weekly Growth</p>
                <p className="text-2xl font-bold">{timeBasedMetrics.weeklyGrowth}%</p>
                <p className="text-yellow-100 text-sm">
                  {timeBasedMetrics.weeklyCompletion} completed this week
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-yellow-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-indigo-100 text-sm font-medium">Avg Task Duration</p>
                <p className="text-2xl font-bold">{analytics.taskStats.avgCompletionTime}</p>
                <p className="text-indigo-100 text-sm">days to complete</p>
              </div>
              <Clock3 className="w-10 h-10 text-indigo-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-pink-500 to-pink-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-pink-100 text-sm font-medium">Efficiency Gap</p>
                <p className="text-2xl font-bold">{performanceInsights.efficiencyGap}%</p>
                <p className="text-pink-100 text-sm">room for improvement</p>
              </div>
              <Gauge className="w-10 h-10 text-pink-200" />
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      {viewMode === 'overview' && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <PieChart className="w-5 h-5 mr-2" />
              Project Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Active</span>
                <div className="flex items-center space-x-2">
                  <div className="w-32">
                    <ProgressBar 
                      value={analytics.projectStats.total > 0 ? (analytics.projectStats.active / analytics.projectStats.total) * 100 : 0} 
                      variant="default" 
                      showLabel={false} 
                    />
                  </div>
                  <span className="text-sm text-gray-600">{analytics.projectStats.active}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Completed</span>
                <div className="flex items-center space-x-2">
                  <div className="w-32">
                    <ProgressBar 
                      value={analytics.projectStats.total > 0 ? (analytics.projectStats.completed / analytics.projectStats.total) * 100 : 0} 
                      variant="success" 
                      showLabel={false} 
                    />
                  </div>
                  <span className="text-sm text-gray-600">{analytics.projectStats.completed}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">On Hold</span>
                <div className="flex items-center space-x-2">
                  <div className="w-32">
                    <ProgressBar 
                      value={analytics.projectStats.total > 0 ? (analytics.projectStats.onHold / analytics.projectStats.total) * 100 : 0} 
                      variant="warning" 
                      showLabel={false} 
                    />
                  </div>
                  <span className="text-sm text-gray-600">{analytics.projectStats.onHold}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Category Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="w-5 h-5 mr-2" />
              Category Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {categoryDistribution.map((category) => (
              <div key={category.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{category.name}</span>
                  <div className="flex items-center space-x-2">
                    <Badge variant={category.completionRate >= 80 ? 'success' : category.completionRate >= 60 ? 'default' : 'warning'}>
                      {category.completionRate}%
                    </Badge>
                    <span className="text-sm text-gray-600">{category.count} projects</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Distribution</span>
                    <span>{category.percentage}%</span>
                  </div>
                  <ProgressBar 
                    value={category.percentage} 
                    showLabel={false} 
                  />
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Avg Progress</span>
                    <span>{category.avgProgress}%</span>
                  </div>
                  <ProgressBar 
                    value={category.avgProgress} 
                    variant="success"
                    showLabel={false} 
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      )}

      {viewMode === 'detailed' && (
      <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Enhanced Top Performers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Trophy className="w-5 h-5 mr-2" />
              Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {topPerformers.map((user, index) => (
              <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-r from-yellow-400 to-yellow-600 text-white rounded-full font-semibold text-sm">
                    {index === 0 ? <Trophy className="w-4 h-4" /> : 
                     index === 1 ? <Award className="w-4 h-4" /> : 
                     index === 2 ? <Star className="w-4 h-4" /> : 
                     `#${index + 1}`}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{user.name}</p>
                    <p className="text-sm text-gray-600">
                      {user.completedTasks}/{user.totalTasks} tasks • {user.avgTaskDuration} days avg
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge 
                    variant={user.efficiencyScore >= 80 ? 'success' : user.efficiencyScore >= 60 ? 'default' : 'warning'}
                  >
                    {user.efficiencyScore}%
                  </Badge>
                  <p className="text-xs text-gray-500 mt-1">Efficiency</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Enhanced Skill Utilization */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="w-5 h-5 mr-2" />
              Skill Demand & Utilization
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {skillUtilization.slice(0, 6).map((skill) => (
              <div key={skill.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{skill.name}</p>
                    <p className="text-sm text-gray-600">
                      {skill.users} members • {skill.totalTasks} total tasks
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant={skill.demand >= 20 ? 'success' : skill.demand >= 10 ? 'default' : 'warning'}>
                      {skill.demand}% demand
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Completion Rate</span>
                    <span>{skill.completionRate}%</span>
                  </div>
                  <ProgressBar 
                    value={skill.completionRate} 
                    variant={skill.completionRate >= 80 ? 'success' : skill.completionRate >= 60 ? 'default' : 'warning'}
                    showLabel={false} 
                  />
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Active Tasks</span>
                    <span>{skill.activeTasks}</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Lightbulb className="w-5 h-5 mr-2" />
              Performance Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  <span className="text-sm font-medium text-gray-700">Overdue Tasks</span>
                </div>
                <Badge variant="warning">{performanceInsights.overdueTasks}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Target className="w-5 h-5 text-yellow-500" />
                  <span className="text-sm font-medium text-gray-700">High Priority</span>
                </div>
                <Badge variant="warning">{performanceInsights.highPriorityTasks}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <TrendingDown className="w-5 h-5 text-red-500" />
                  <span className="text-sm font-medium text-gray-700">Low Progress Projects</span>
                </div>
                <Badge variant="danger">{performanceInsights.lowProgressProjects}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Zap className="w-5 h-5 mr-2" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                <Clock className="w-4 h-4 mr-2" />
                Review Overdue Tasks
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Target className="w-4 h-4 mr-2" />
                Prioritize High Priority Items
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Users className="w-4 h-4 mr-2" />
                Reassign Underutilized Team
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <TrendingUp className="w-4 h-4 mr-2" />
                Optimize Workflow
              </Button>
            </div>
          </CardContent>
        </Card> */}
      </div>
      </>
      )}

      {/* Enhanced Task Timeline */}
      {(viewMode === 'trends' || viewMode === 'overview') && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CalendarDays className="w-5 h-5 mr-2" />
            Task Timeline Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-3xl font-bold text-blue-600">{analytics.taskStats.total}</div>
              <div className="text-sm text-gray-600">Total Tasks</div>
              <div className="text-xs text-blue-500 mt-1">+{timeBasedMetrics.weeklyGrowth}% this week</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-3xl font-bold text-green-600">{analytics.taskStats.completed}</div>
              <div className="text-sm text-gray-600">Completed</div>
              <div className="text-xs text-green-500 mt-1">+{timeBasedMetrics.weeklyCompletion} this week</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-3xl font-bold text-purple-600">{analytics.taskStats.inProgress}</div>
              <div className="text-sm text-gray-600">In Progress</div>
              <div className="text-xs text-purple-500 mt-1">{analytics.taskStats.avgCompletionTime} days avg</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-3xl font-bold text-red-600">{analytics.taskStats.overdue}</div>
              <div className="text-sm text-gray-600">Overdue</div>
              <div className="text-xs text-red-500 mt-1">Risk Score: {performanceInsights.riskScore}%</div>
            </div>
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  );
}