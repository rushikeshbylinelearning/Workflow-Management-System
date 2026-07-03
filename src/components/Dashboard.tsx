import { useState, useEffect } from 'react';
import { 
  FolderOpen, 
  Users, 
  CheckSquare, 
  TrendingUp,
  AlertTriangle,
  Calendar,
  ChevronRight,
  Loader2,
  Trophy,
  Star,
  Flag
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { ProgressBar } from './ui/ProgressBar';
import { Button } from './ui/Button';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { dashboardService, teamService } from '../services/apiService';
import tokenService from '../services/tokenService';
// import { calculateProjectProgress } from '../utils/progressCalculator';

const isActiveMember = (member: { is_active?: boolean | number }) =>
  member.is_active === true || member.is_active === 1;

export function Dashboard() {
  const { user } = useAuth();
  const { state, dispatch } = useApp();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [topPerformers, setTopPerformers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user is logged in (either admin or team member)
  const isAuthenticated = () => {
    // Check admin session
    if (user) return true;
    
    // Check team member session
    const teamToken = sessionStorage.getItem('teamToken');
    const teamUserData = sessionStorage.getItem('teamUserData');
    return !!(teamToken && teamUserData);
  };

  // Fetch dashboard data on component mount
  useEffect(() => {
    let isMounted = true;
    
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Check if token is expired before making API calls
        if (tokenService.isActiveTokenExpired()) {
          const refreshed = await tokenService.refreshActiveToken();
          if (!refreshed) {
            setError('Session expired. Please login again.');
            setLoading(false);
            return;
          }
        }
        
        const [dashboardDataResult, topPerformersResult] = await Promise.all([
          dashboardService.getOverview(),
          teamService.getMembersWithPerformanceRanking()
        ]);
        
        if (isMounted) {
          setDashboardData(dashboardDataResult);
          setTopPerformers((topPerformersResult || []).filter(isActiveMember).slice(0, 5));
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Dashboard fetch error:', err);
          
          // Check if it's an authentication error
          if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
            try {
              const refreshed = await tokenService.refreshActiveToken();
              if (refreshed) {
                // Retry the API call
                const [retryDashboardData, retryTopPerformers] = await Promise.all([
                  dashboardService.getOverview(),
                  teamService.getMembersWithPerformanceRanking()
                ]);
                if (isMounted) {
                  setDashboardData(retryDashboardData);
                  setTopPerformers((retryTopPerformers || []).filter(isActiveMember).slice(0, 5));
                  setError(null);
                }
              } else {
                setError('Session expired. Please login again.');
              }
            } catch (refreshError) {
              setError('Session expired. Please login again.');
            }
          } else {
            setError(err.message || 'Failed to load dashboard data');
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Only fetch data if user is authenticated (admin or team member)
    if (isAuthenticated()) {
      fetchDashboardData();
    } else {
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStatClick = (view: string, filter?: any) => {
    dispatch({ type: 'SET_SELECTED_VIEW', payload: view as any });
    if (filter) {
      dispatch({ type: 'SET_FILTERS', payload: filter });
    }
  };

  // Get data from dashboard service
  const projects = dashboardData?.projects || [];
  const teamMembers = dashboardData?.teamMembers || [];
  const allTasks = dashboardData?.tasks || [];
  
  // Calculate task counts for different time periods
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekFromNow = new Date(today);
  weekFromNow.setDate(today.getDate() + 7);
  
  const todayTasks = allTasks.filter((task: any) => {
    if (!task.end_date) return false;
    const taskDate = new Date(task.end_date);
    taskDate.setHours(0, 0, 0, 0);
    const todayDate = new Date(today);
    todayDate.setHours(0, 0, 0, 0);
    return taskDate.getTime() === todayDate.getTime() && task.status !== 'completed';
  });
  
  const tomorrowTasks = allTasks.filter((task: any) => {
    if (!task.end_date) return false;
    const taskDate = new Date(task.end_date);
    taskDate.setHours(0, 0, 0, 0);
    const tomorrowDate = new Date(tomorrow);
    tomorrowDate.setHours(0, 0, 0, 0);
    return taskDate.getTime() === tomorrowDate.getTime() && task.status !== 'completed';
  });
  
  const thisWeekTasks = allTasks.filter((task: any) => {
    if (!task.end_date) return false;
    const taskDate = new Date(task.end_date);
    taskDate.setHours(0, 0, 0, 0);
    const todayDate = new Date(today);
    todayDate.setHours(0, 0, 0, 0);
    const weekFromNowDate = new Date(weekFromNow);
    weekFromNowDate.setHours(0, 0, 0, 0);
    return taskDate >= todayDate && taskDate <= weekFromNowDate && task.status !== 'completed';
  });

  const handleUserClick = (userId: string) => {
    dispatch({ type: 'SET_SELECTED_VIEW', payload: 'tasks' });
    dispatch({ type: 'SET_FILTERS', payload: { teamMembers: [userId] } });
  };

  // This function will be called after data is loaded

  // Loading state
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Overview of your project management activities</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Loading dashboard data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Overview of your project management activities</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertTriangle className="w-8 h-8 mx-auto mb-4 text-red-600" />
            <p className="text-red-600 mb-4">{error}</p>
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Use backend data instead of context state  
  const stats_data = dashboardData?.stats || {};

  // Create stats array with real backend data
  const stats = [
    {
      title: 'Total Projects',
      value: stats_data.totalProjects || 0,
      icon: FolderOpen,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      onClick: () => handleStatClick('projects'),
    },
    {
      title: 'Active Projects',
      value: stats_data.activeProjects || 0,
      icon: TrendingUp,
      color: 'text-green-600',
      bg: 'bg-green-50',
      onClick: () => handleStatClick('projects', { statuses: ['active'] }),
    },
    {
      title: 'Team Members',
      value: stats_data.totalTeamMembers || 0,
      icon: Users,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      onClick: () => handleStatClick('teams'),
    },
    {
      title: 'Categories',
      value: stats_data.totalCategories || 0,
      icon: CheckSquare,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      onClick: () => handleStatClick('settings'),
    },
  ];

  return (
    <div className="relative min-h-screen p-6  space-y-4 bg-gradient-to-br from-amber-50 via-white to-blue-50">
      <div className="space-y-4 pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="relative">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 text-white p-6 shadow-lg">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-14 -left-12 w-56 h-56 bg-white/10 rounded-full blur-2xl" />
          <div className="relative z-10 flex items-center justify-between gap-6">
            <div>
              <h1 className="text-2xl font-bold">Dashboard</h1>
              <p className="text-white/80">Overview of your project management activities</p>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <div className="text-right">
                <p className="text-xs uppercase tracking-wider text-white/70">Projects</p>
                <p className="text-xl font-semibold">{stats_data.totalProjects || 0}</p>
              </div>
              <div className="h-10 w-px bg-white/20" />
              <div className="text-right">
                <p className="text-xs uppercase tracking-wider text-white/70">Team</p>
                <p className="text-xl font-semibold">{stats_data.totalTeamMembers || 0}</p>
              </div>
              <div className="h-10 w-px bg-white/20" />
              <div className="text-right">
                <p className="text-xs uppercase tracking-wider text-white/70">Categories</p>
                <p className="text-xl font-semibold">{stats_data.totalCategories || 0}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.title} className="rounded-2xl border-0 bg-white/80 backdrop-blur-sm hover:shadow-lg transition-all cursor-pointer hover:-translate-y-0.5" onClick={stat.onClick}>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className={`p-2.5 rounded-xl ring-1 ring-inset ring-gray-200 ${stat.bg}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center text-sm text-gray-500">
                <span>Click to view details</span>
                <ChevronRight className="w-4 h-4 ml-1" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Task Due Dates Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card 
          className="rounded-2xl border-0 bg-white/80 backdrop-blur-sm hover:shadow-lg transition-all cursor-pointer hover:-translate-y-0.5"
          onClick={() => handleStatClick('tasks', { dueToday: true })}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Due Today</p>
                <p className="text-2xl font-bold text-red-600">{todayTasks.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-red-500" />
            </div>
            <div className="mt-2 flex items-center text-sm text-gray-500">
              <span>Click to view tasks</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className="rounded-2xl border-0 bg-white/80 backdrop-blur-sm hover:shadow-lg transition-all cursor-pointer hover:-translate-y-0.5"
          onClick={() => handleStatClick('tasks', { dueTomorrow: true })}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Due Tomorrow</p>
                <p className="text-2xl font-bold text-orange-600">{tomorrowTasks.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-orange-500" />
            </div>
            <div className="mt-2 flex items-center text-sm text-gray-500">
              <span>Click to view tasks</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className="rounded-2xl border-0 bg-white/80 backdrop-blur-sm hover:shadow-lg transition-all cursor-pointer hover:-translate-y-0.5"
          onClick={() => handleStatClick('tasks', { dueThisWeek: true })}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Due This Week</p>
                <p className="text-2xl font-bold text-blue-600">{thisWeekTasks.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-500" />
            </div>
            <div className="mt-2 flex items-center text-sm text-gray-500">
              <span>Click to view tasks</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Projects */}
        <Card className="rounded-2xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle>Recent Projects</CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => handleStatClick('projects')}
              >
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {projects.slice(0, 5).map((project: any) => (
              <div 
                key={project.id} 
                className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100 hover:shadow-sm hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => handleStatClick('projects')}
              >
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{project.name}</h4>
                  <p className="text-sm text-gray-600">{project.category_name || project.category}</p>
                  <ProgressBar value={project.progress || 0} className="mt-2" />
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={
                    project.status === 'active' ? 'primary' :
                    project.status === 'completed' ? 'success' :
                    project.status === 'on-hold' ? 'warning' : 'default'
                  }>
                    {project.status}
                  </Badge>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Team Workload */}
        <Card className="rounded-2xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle>Team Workload</CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => handleStatClick('teams')}
              >
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {teamMembers.slice(0, 6).map((member: any) => {
              // Normalize IDs to strings to avoid type-mismatch (backend returns numeric IDs)
              const memberTasks = allTasks.filter((t: any) =>
                t.assignees &&
                t.assignees.map((id: any) => String(id)).includes(String(member.id))
              );
              const completedTasks = memberTasks.filter((t: any) => t.status === 'completed').length;
              const workloadPercentage = memberTasks.length > 0 ? (completedTasks / memberTasks.length) * 100 : 0;
              
              return (
                <div 
                  key={member.id} 
                  className="flex items-center justify-between p-2 rounded-lg border border-gray-100 bg-white hover:shadow-sm hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleUserClick(member.id)}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-sm">
                      {member.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{member.name}</p>
                      <p className="text-sm text-gray-600">{member.skills?.[0] || 'No skills'}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">{memberTasks.length} tasks</span>
                    <ProgressBar 
                      value={workloadPercentage} 
                      className="w-20" 
                      showLabel={false}
                      variant={workloadPercentage > 80 ? 'warning' : 'default'}
                    />
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Top Performers Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performers */}
        <Card className="rounded-2xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                <span>Top Performers</span>
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => dispatch({ type: 'SET_SELECTED_VIEW', payload: 'top-performers' })}
              >
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {topPerformers.length > 0 ? (
              topPerformers.map((member, index) => (
                <div 
                  key={member.id} 
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100 hover:shadow-sm hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleUserClick(member.id)}
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      {index === 0 && <Trophy className="w-4 h-4 text-yellow-500" />}
                      {index === 1 && <Star className="w-4 h-4 text-gray-400" />}
                      {index === 2 && <Star className="w-4 h-4 text-orange-400" />}
                      {index > 2 && <span className="w-4 h-4 text-xs font-bold text-gray-500 flex items-center justify-center">#{index + 1}</span>}
                    </div>
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-sm">
                      {member.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{member.name}</p>
                      <p className="text-sm text-gray-600">{member.skills?.[0] || 'No skills'}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1">
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-xs text-gray-600">{member.green_flags || 0}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        <span className="text-xs text-gray-600">{member.yellow_flags || 0}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        <span className="text-xs text-gray-600">{member.orange_flags || 0}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span className="text-xs text-gray-600">{member.red_flags || 0}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{member.total_flags || 0} flags</p>
                      <p className="text-xs text-gray-500">{member.completion_rate || 0}% completion</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No performance data available</p>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Quick Actions */}
      <Card className="rounded-2xl border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button 
              onClick={() => dispatch({ type: 'SET_SELECTED_VIEW', payload: 'projects' })}
              className="p-4 rounded-lg bg-white border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <FolderOpen className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-800">Create New Project</p>
            </button>
            <button 
              onClick={() => dispatch({ type: 'SET_SELECTED_VIEW', payload: 'teams' })}
              className="p-4 rounded-lg bg-white border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <Users className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-800">Add Team Member</p>
            </button>
            <button 
              onClick={() => dispatch({ type: 'SET_SELECTED_VIEW', payload: 'tasks' })}
              className="p-4 rounded-lg bg-white border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <CheckSquare className="w-8 h-8 text-orange-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-800">Create Task</p>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}