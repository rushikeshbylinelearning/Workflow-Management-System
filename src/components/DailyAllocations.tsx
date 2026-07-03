import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Clock, 
  User, 
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Plus,
  AlertTriangle,
  FolderOpen,
  Users,
  Eye,
  XCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { allocationService, projectService, teamService, taskService, stageService, gradeService, bookService, unitService, lessonService } from '../services/apiService';

interface DailyAllocation {
  id: string;
  user_id: number;
  user_type: string;
  user_name: string;
  user_email: string;
  user_skills: string[];
  project_id: number;
  project_name: string;
  project_category: string;
  task_id: number;
  task_name: string;
  task_status: string;
  task_priority: string;
  hours_per_day: number;
  date: string;
  start_date: string;
  end_date: string;
  estimated_hours: number;
}

interface GroupedData {
  [userId: string]: {
    user_id: number;
    user_name: string;
    user_email: string;
    user_skills: string[];
    daily_allocations: {
      [date: string]: {
        date: string;
        total_hours: number;
        tasks: Array<{
          task_id: number;
          task_name: string;
          project_name: string;
          hours_per_day: number;
          status: string;
          priority: string;
        }>;
      };
    };
  };
}

interface SummaryStats {
  total_allocations: number;
  total_users: number;
  total_dates: number;
  user_stats: Array<{
    user_id: number;
    user_name: string;
    total_hours: number;
    total_tasks: number;
    dates_worked: number;
  }>;
  date_stats: Array<{
    date: string;
    total_hours: number;
    total_tasks: number;
    unique_users: number;
  }>;
}

interface BackendResponse {
  success: boolean;
  data: {
    allocations: DailyAllocation[];
    grouped: GroupedData;
    summary: SummaryStats;
    date_range: {
      start: string;
      end: string;
    };
  };
}

interface DailyAllocationsProps {
  onNavigateToTask?: (taskId: number) => void;
}

export function DailyAllocations({ onNavigateToTask }: DailyAllocationsProps = {}) {
  const { user } = useAuth();
  
  // Check if user is logged in (either admin or team member)
  const isAuthenticated = () => {
    if (user) return true;
    const teamToken = sessionStorage.getItem('teamToken');
    const teamUserData = sessionStorage.getItem('teamUserData');
    return !!(teamToken && teamUserData);
  };
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
  const [groupBy, setGroupBy] = useState<'team' | 'project'>('team');
  const [isAllocationModalOpen, setIsAllocationModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendData, setBackendData] = useState<BackendResponse['data'] | null>(null);
  
  // Filter states
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [selectedMember, setSelectedMember] = useState<string>('all');
  
  // Daily allocation modal states
  const [isDailyAllocationModalOpen, setIsDailyAllocationModalOpen] = useState(false);
  const [selectedDailyAllocation, setSelectedDailyAllocation] = useState<{
    user: any;
    date: string;
    tasks: any[];
    totalHours: number;
  } | null>(null);

  // Abort controller ref — cancels stale in-flight requests on rapid navigation
  const fetchAbortRef = useRef<AbortController | null>(null);

  // Fetch daily allocations from backend
  const fetchDailyAllocations = async () => {
    // Cancel any previous in-flight request
    if (fetchAbortRef.current) {
      fetchAbortRef.current.abort();
    }
    fetchAbortRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);
      
      // Calculate date range based on current view
      let startDate, endDate;
      if (viewMode === 'week') {
        const weekDates = getWeekDates(selectedDate);
        startDate = weekDates[0].toISOString().split('T')[0];
        endDate = weekDates[6].toISOString().split('T')[0];
      } else if (viewMode === 'day') {
        const dateStr = selectedDate.toISOString().split('T')[0];
        startDate = dateStr;
        endDate = dateStr;
      } else {
        // Month view - get first and last day of month
        const firstDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const lastDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
        startDate = firstDay.toISOString().split('T')[0];
        endDate = lastDay.toISOString().split('T')[0];
      }
      
      
      const result = await allocationService.getDaily({
        start_date: startDate,
        end_date: endDate,
        group_by: groupBy
      });
      
      // Handle both possible response structures
      const responseData = result.data || result;
      setBackendData(responseData);
      
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.error('Failed to fetch daily allocations:', err);
      setError('Failed to load daily allocations');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on component mount and when dependencies change
  useEffect(() => {
    if (isAuthenticated()) {
      fetchDailyAllocations();
    }
  }, [user, viewMode, selectedDate, groupBy]); // eslint-disable-line react-hooks/exhaustive-deps

  const getWeekDates = (date: Date) => {
    const week = [];
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay());
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      week.push(day);
    }
    return week;
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    if (viewMode === 'day') {
      newDate.setDate(selectedDate.getDate() + (direction === 'next' ? 1 : -1));
    } else if (viewMode === 'week') {
      newDate.setDate(selectedDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      newDate.setMonth(selectedDate.getMonth() + (direction === 'next' ? 1 : -1));
    }
    setSelectedDate(newDate);
  };

  const formatDateRange = () => {
    if (viewMode === 'day') {
      return selectedDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } else if (viewMode === 'week') {
      const weekDates = getWeekDates(selectedDate);
      const start = weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const end = weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `${start} - ${end}`;
    } else {
      return selectedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    }
  };

  const getUserWorkloadStatus = (totalHours: number) => {
    if (totalHours === 0) return 'available';
    if (totalHours > 8) return 'overloaded';
    if (totalHours >= 6) return 'busy';
    return 'normal';
  };

  const getWorkloadColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'normal': return 'bg-blue-100 text-blue-800';
      case 'busy': return 'bg-yellow-100 text-yellow-800';
      case 'overloaded': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Get unique teams from backend data
  const getUniqueTeams = useMemo(() => {
    if (!backendData?.allocations) return [];
    const teams = new Set<string>();
    backendData.allocations.forEach(allocation => {
      if (allocation.user_skills && allocation.user_skills.length > 0) {
        allocation.user_skills.forEach(skill => teams.add(skill));
      }
    });
    return Array.from(teams).sort();
  }, [backendData]);

  // Get unique members from backend data, optionally filtered by team
  const getUniqueMembers = useMemo(() => {
    if (!backendData?.grouped) return [];
    const members = Object.values(backendData.grouped).filter(member =>
      member && member.user_id && member.user_name
    );
    if (selectedTeam === 'all') return members;
    return members.filter(member =>
      member.user_skills && member.user_skills.includes(selectedTeam)
    );
  }, [backendData, selectedTeam]);

  // Filter grouped data based on selected filters
  const filteredGroupedData = useMemo(() => {
    if (!backendData?.grouped) return {};
    let filteredData = { ...backendData.grouped };
    if (selectedTeam !== 'all') {
      filteredData = Object.fromEntries(
        Object.entries(filteredData).filter(([_, member]) =>
          member && member.user_skills && member.user_skills.includes(selectedTeam)
        )
      );
    }
    if (selectedMember !== 'all') {
      filteredData = Object.fromEntries(
        Object.entries(filteredData).filter(([userId, member]) =>
          userId === selectedMember && member && member.user_id
        )
      );
    }
    return filteredData;
  }, [backendData, selectedTeam, selectedMember]);

  // Open daily allocation modal
  const openDailyAllocationModal = (user: any, date: string, dayData: any) => {
    setSelectedDailyAllocation({
      user,
      date,
      tasks: dayData?.tasks || [],
      totalHours: dayData?.total_hours || 0
    });
    setIsDailyAllocationModalOpen(true);
  };

  // Navigate to task details
  const navigateToTaskDetails = (taskId: number) => {
    setIsDailyAllocationModalOpen(false);
    if (onNavigateToTask) {
      onNavigateToTask(taskId);
    } else {
    }
  };

  const renderTeamWeekView = () => {
    if (!backendData || !backendData.grouped) {
      if (loading) {
        return <div className="text-center text-gray-500 p-8">Loading allocation data...</div>;
      }
      return (
        <div className="text-center py-12 text-gray-500">
          <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium mb-2">No allocations found</p>
          <p className="text-sm">There are no task allocations for the selected date range.</p>
          <p className="text-sm mt-2">Tasks need to have assignees and dates to appear here.</p>
        </div>
      );
    }

    const weekDates = getWeekDates(selectedDate);
    const users = Object.values(filteredGroupedData);

    if (users.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium mb-2">No team members match the filters</p>
          <p className="text-sm">Try adjusting your team or member filters.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Week Header */}
        <div className="grid grid-cols-8 gap-2 mb-4">
          <div className="font-medium text-gray-700 p-2">Team Member</div>
          {weekDates.map(date => (
            <div key={date.toISOString()} className="text-center p-2">
              <div className="font-medium text-gray-700">
                {date.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div className="text-sm text-gray-500">
                {date.getDate()}
              </div>
            </div>
          ))}
        </div>

        {/* Team Member Rows */}
        {users.filter(user => user && user.user_id && user.user_name).map(user => (
          <Card key={user.user_id || 'unknown'} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="grid grid-cols-8 gap-2">
                {/* User Info */}
                <div className="p-4 bg-gray-50 flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                    {user.user_name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{user.user_name || 'Unknown User'}</div>
                    <div className="text-sm text-gray-600">{user.user_skills?.[0] || 'No skills'}</div>
                  </div>
                </div>

                {/* Daily Allocations */}
                {weekDates.map(date => {
                  const dateStr = date.toISOString().split('T')[0];
                  const dayData = user.daily_allocations[dateStr];
                  const totalHours = dayData?.total_hours || 0;
                  const tasks = dayData?.tasks || [];
                  const status = getUserWorkloadStatus(totalHours);
                  
                  return (
                    <div key={date.toISOString()} className="p-2 border-l border-gray-200">
                      <div 
                        className={`rounded-lg p-2 text-center cursor-pointer hover:opacity-80 transition-opacity ${getWorkloadColor(status)}`}
                        onClick={() => openDailyAllocationModal(user, dateStr, dayData)}
                        title={`Click to view ${tasks.length} tasks for ${user.user_name} on ${date.toLocaleDateString()}`}
                      >
                        <div className="font-semibold">{totalHours.toFixed(1)}h</div>
                        <div className="text-xs mt-1">{tasks.length} tasks</div>
                      </div>
                      
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderProjectWeekView = () => {
    if (!backendData || !backendData.allocations) {
      if (loading) {
        return <div className="text-center text-gray-500 p-8">Loading allocation data...</div>;
      }
      return (
        <div className="text-center py-12 text-gray-500">
          <FolderOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium mb-2">No allocations found</p>
          <p className="text-sm">There are no task allocations for the selected date range.</p>
          <p className="text-sm mt-2">Tasks need to have assignees and dates to appear here.</p>
        </div>
      );
    }

    const weekDates = getWeekDates(selectedDate);
    
    // Group allocations by project
    const projectGroups: { [projectId: string]: {
      project_id: number;
      project_name: string;
      project_category: string;
      daily_allocations: { [date: string]: DailyAllocation[] };
    }} = {};

    backendData.allocations.forEach(allocation => {
      const projectId = allocation.project_id.toString();
      if (!projectGroups[projectId]) {
        projectGroups[projectId] = {
          project_id: allocation.project_id,
          project_name: allocation.project_name,
          project_category: allocation.project_category,
          daily_allocations: {}
        };
      }
      
      if (!projectGroups[projectId].daily_allocations[allocation.date]) {
        projectGroups[projectId].daily_allocations[allocation.date] = [];
      }
      projectGroups[projectId].daily_allocations[allocation.date].push(allocation);
    });

    const projects = Object.values(projectGroups);

    return (
      <div className="space-y-4">
        {/* Week Header */}
        <div className="grid grid-cols-8 gap-2 mb-4">
          <div className="font-medium text-gray-700 p-2">Project</div>
          {weekDates.map(date => (
            <div key={date.toISOString()} className="text-center p-2">
              <div className="font-medium text-gray-700">
                {date.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div className="text-sm text-gray-500">
                {date.getDate()}
              </div>
            </div>
          ))}
        </div>

        {/* Project Rows */}
        {projects.map(project => (
          <Card key={project.project_id} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="grid grid-cols-8 gap-2">
                {/* Project Info */}
                <div className="p-4 bg-gray-50 flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white">
                    <FolderOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{project.project_name}</div>
                    <div className="text-sm text-gray-600">{project.project_category}</div>
                  </div>
                </div>

                {/* Daily Project Allocations */}
                {weekDates.map(date => {
                  const dateStr = date.toISOString().split('T')[0];
                  const dayAllocations = project.daily_allocations[dateStr] || [];
                  const totalHours = dayAllocations.reduce((sum, alloc) => sum + alloc.hours_per_day, 0);
                  const uniqueUsers = new Set(dayAllocations.map(a => a.user_id)).size;
                  
                  return (
                    <div key={date.toISOString()} className="p-2 border-l border-gray-200">
                      <div className="rounded-lg p-2 text-center bg-blue-100 text-blue-800">
                        <div className="font-semibold">{totalHours.toFixed(1)}h</div>
                        <div className="text-xs mt-1">{uniqueUsers} people</div>
                      </div>
                      
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderDayView = () => {
    if (!backendData) {
      if (loading) {
        return <div className="text-center text-gray-500 p-8">Loading allocation data...</div>;
      }
      return (
        <div className="text-center py-12 text-gray-500">
          <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium mb-2">No allocations found</p>
          <p className="text-sm">There are no task allocations for the selected date.</p>
          <p className="text-sm mt-2">Tasks need to have assignees and dates to appear here.</p>
        </div>
      );
    }

    if (groupBy === 'team') {
      const users = Object.values(backendData.grouped || {});
      const selectedDateStr = selectedDate.toISOString().split('T')[0];

      return (
        <div className="space-y-6">
          {users.filter(user => user && user.user_id && user.user_name).map(user => {
            const dayData = user.daily_allocations[selectedDateStr];
            const totalHours = dayData?.total_hours || 0;
            const tasks = dayData?.tasks || [];
            const status = getUserWorkloadStatus(totalHours);
            
            return (
              <Card key={user.user_id || 'unknown'}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium text-lg">
                        {user.user_name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <CardTitle>{user.user_name || 'Unknown User'}</CardTitle>
                        <p className="text-sm text-gray-600">{user.user_skills?.join(', ') || 'No skills'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={
                        status === 'available' ? 'success' :
                        status === 'overloaded' ? 'danger' :
                        status === 'busy' ? 'warning' : 'primary'
                      }>
                        {totalHours.toFixed(1)}h allocated
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {tasks.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <User className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>No tasks allocated for this day</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {tasks.map(task => (
                        <div key={task.task_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{task.task_name}</div>
                            <div className="text-sm text-gray-600">{task.project_name}</div>
                            <div className="flex items-center mt-1 space-x-4">
                              <Badge variant="secondary" size="sm">
                                {task.priority}
                              </Badge>
                              <Badge variant={
                                task.status === 'completed' ? 'success' :
                                task.status === 'in-progress' ? 'primary' :
                                task.status === 'blocked' ? 'danger' : 'default'
                              } size="sm">
                                {task.status}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-right flex flex-col items-end space-y-2">
                            <div>
                              <div className="font-semibold text-lg">{task.hours_per_day}h</div>
                              <div className="text-sm text-gray-600">allocated</div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigateToTaskDetails(task.task_id)}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View Details
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      );
    } else {
      // Project-based day view
      const selectedDateStr = selectedDate.toISOString().split('T')[0];
      const dayAllocations = backendData.allocations.filter(alloc => alloc.date === selectedDateStr);
      
      // Group by project
      const projectGroups: { [projectId: string]: DailyAllocation[] } = {};
      dayAllocations.forEach(alloc => {
        const projectId = alloc.project_id.toString();
        if (!projectGroups[projectId]) {
          projectGroups[projectId] = [];
        }
        projectGroups[projectId].push(alloc);
      });

      const projects = Object.entries(projectGroups).map(([projectId, allocations]) => ({
        project_id: parseInt(projectId),
        project_name: allocations[0].project_name,
        project_category: allocations[0].project_category,
        allocations
      }));

      return (
        <div className="space-y-6">
          {projects.map(project => {
            const totalHours = project.allocations.reduce((sum, alloc) => sum + alloc.hours_per_day, 0);
            const uniqueUsers = new Set(project.allocations.map(a => a.user_id)).size;
            
            return (
              <Card key={project.project_id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white">
                        <FolderOpen className="w-6 h-6" />
                      </div>
                      <div>
                        <CardTitle>{project.project_name}</CardTitle>
                        <p className="text-sm text-gray-600">{project.project_category}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="primary">
                        {totalHours.toFixed(1)}h • {uniqueUsers} people
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {project.allocations.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <FolderOpen className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>No allocations for this project today</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {project.allocations.map(allocation => (
                        <div key={`${allocation.user_id}-${allocation.task_id}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{allocation.task_name}</div>
                            <div className="text-sm text-gray-600">Assigned to: {allocation.user_name}</div>
                            <div className="flex items-center mt-1 space-x-4">
                              <Badge variant="secondary" size="sm">
                                {allocation.task_priority}
                              </Badge>
                              <Badge variant={
                                allocation.task_status === 'completed' ? 'success' :
                                allocation.task_status === 'in-progress' ? 'primary' :
                                allocation.task_status === 'blocked' ? 'danger' : 'default'
                              } size="sm">
                                {allocation.task_status}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-lg">{allocation.hours_per_day}h</div>
                            <div className="text-sm text-gray-600">allocated</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      );
    }
  };

  // Calculate summary stats from filtered data — memoized to avoid recalculation on every render
  const summaryStats = useMemo(() => {
    const users = Object.values(filteredGroupedData);
    let available = 0, busy = 0, overloaded = 0;
    users.forEach(user => {
      const dates = Object.keys(user.daily_allocations);
      const totalHours = dates.reduce((sum, date) => sum + user.daily_allocations[date].total_hours, 0);
      const avgHoursPerDay = dates.length > 0 ? totalHours / dates.length : 0;
      if (avgHoursPerDay === 0) available++;
      else if (avgHoursPerDay > 8) overloaded++;
      else if (avgHoursPerDay >= 6) busy++;
    });
    return { total: users.length, available, busy, overloaded };
  }, [filteredGroupedData]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 text-white p-6 shadow-lg">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-14 -left-12 w-56 h-56 bg-white/10 rounded-full blur-2xl" />
        <div className="relative z-10 flex items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold">Daily Allocations</h1>
            <p className="text-white/80">View team member and project task allocations</p>
          </div>
          <Button variant="dark" icon={<Plus className="w-4 h-4" />} onClick={() => setIsAllocationModalOpen(true)}>
            Add Allocation
          </Button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" onClick={() => navigateDate('prev')}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="font-medium text-gray-900 min-w-[200px] text-center">
              {formatDateRange()}
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigateDate('next')}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setSelectedDate(new Date())}
          >
            Today
          </Button>
        </div>

        <div className="flex items-center space-x-4">
          {/* Team Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Team:</span>
            <select
              value={selectedTeam}
              onChange={(e) => {
                setSelectedTeam(e.target.value);
                setSelectedMember('all'); // Reset member filter when team changes
              }}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Teams</option>
              {getUniqueTeams.map(team => (
                <option key={team} value={team}>{team}</option>
              ))}
            </select>
          </div>

          {/* Member Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Member:</span>
            <select
              value={selectedMember}
              onChange={(e) => setSelectedMember(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Members</option>
              {getUniqueMembers.map(member => (
                <option key={member.user_id || 'unknown'} value={(member.user_id || '').toString()}>
                  {member.user_name || 'Unknown Member'}
                </option>
              ))}
            </select>
          </div>

          {/* Group By Toggle */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Group by:</span>
            <Button
              variant={groupBy === 'team' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setGroupBy('team')}
            >
              <Users className="w-4 h-4 mr-1" />
              Team
            </Button>
            <Button
              variant={groupBy === 'project' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setGroupBy('project')}
            >
              <FolderOpen className="w-4 h-4 mr-1" />
              Project
            </Button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center space-x-2">
            <Button
              variant={viewMode === 'day' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('day')}
            >
              Day
            </Button>
            <Button
              variant={viewMode === 'week' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('week')}
            >
              Week
            </Button>
          </div>

          {/* Clear Filters */}
          {(selectedTeam !== 'all' || selectedMember !== 'all') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedTeam('all');
                setSelectedMember('all');
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 rounded-lg bg-blue-50">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Team</p>
                <p className="text-2xl font-bold text-gray-900">{summaryStats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 rounded-lg bg-green-50">
                <Clock className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Available</p>
                <p className="text-2xl font-bold text-gray-900">{summaryStats.available}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 rounded-lg bg-yellow-50">
                <BarChart3 className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Busy</p>
                <p className="text-2xl font-bold text-gray-900">{summaryStats.busy}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 rounded-lg bg-red-50">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Overloaded</p>
                <p className="text-2xl font-bold text-gray-900">{summaryStats.overloaded}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-400 mr-2" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading allocations...</span>
        </div>
      )}

      {/* Main Content */}
      {!loading && (
        viewMode === 'week' ? (
          groupBy === 'team' ? renderTeamWeekView() : renderProjectWeekView()
        ) : (
          renderDayView()
        )
      )}

      {/* Add Allocation Modal - Comprehensive Task Allocation */}
      <Modal isOpen={isAllocationModalOpen} onClose={() => setIsAllocationModalOpen(false)} title="Allocate Tasks to Team Members" size="xl">
        <TaskAllocationModal 
          onClose={() => setIsAllocationModalOpen(false)}
          onAllocationComplete={() => {
            setIsAllocationModalOpen(false);
            fetchDailyAllocations(); // Refresh the allocations
          }}
        />
      </Modal>

      {/* Daily Allocation Modal */}
      <Modal 
        isOpen={isDailyAllocationModalOpen} 
        onClose={() => setIsDailyAllocationModalOpen(false)} 
        title={`Daily Tasks - ${selectedDailyAllocation?.user?.user_name || 'Unknown User'}`}
        size="lg"
      >
        {selectedDailyAllocation && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">
                    {new Date(selectedDailyAllocation.date).toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {selectedDailyAllocation.user?.user_name} • {selectedDailyAllocation.user?.user_skills?.join(', ') || 'No skills'}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">
                    {selectedDailyAllocation.totalHours.toFixed(1)}h
                  </div>
                  <div className="text-sm text-gray-600">
                    {selectedDailyAllocation.tasks.length} tasks
                  </div>
                </div>
              </div>
            </div>

            {selectedDailyAllocation.tasks.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <User className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No tasks allocated for this day</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDailyAllocation.tasks.map(task => (
                  <div key={task.task_id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="font-medium text-gray-900">{task.task_name}</h4>
                          <Badge variant={
                            task.status === 'completed' ? 'success' :
                            task.status === 'in-progress' ? 'primary' :
                            task.status === 'under-review' ? 'warning' :
                            task.status === 'blocked' ? 'danger' : 'default'
                          } size="sm">
                            {task.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600 mb-2">{task.project_name}</div>
                        <div className="flex items-center space-x-4 text-sm">
                          <div className="flex items-center space-x-1">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span>{task.hours_per_day}h allocated</span>
                          </div>
                          <Badge variant="secondary" size="sm">
                            {task.priority}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigateToTaskDetails(task.task_id)}
                        className="text-blue-600 hover:text-blue-800 ml-4"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

// Comprehensive Task Allocation Modal Component
interface TaskAllocationModalProps {
  onClose: () => void;
  onAllocationComplete: () => void;
}

function TaskAllocationModal({ onClose, onAllocationComplete }: TaskAllocationModalProps) {
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedStage, setSelectedStage] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedBook, setSelectedBook] = useState<string>('');
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [selectedLesson, setSelectedLesson] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedTasks, setSelectedTasks] = useState<number[]>([]);
  const [selectedTeamMember, setSelectedTeamMember] = useState<number | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [allocationDate, setAllocationDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Load stages and grades when project changes
  useEffect(() => {
    if (selectedProject) {
      loadStagesForProject(selectedProject);
      loadGradesForProject(selectedProject);
      // Reset all selections when project changes
      setSelectedStage('');
      setSelectedGrade('');
      setSelectedBook('');
      setSelectedUnit('');
      setSelectedLesson('');
    } else {
      setStages([]);
      setGrades([]);
      setBooks([]);
      setUnits([]);
      setLessons([]);
      setTasks([]);
      setSelectedStage('');
      setSelectedGrade('');
      setSelectedBook('');
      setSelectedUnit('');
      setSelectedLesson('');
    }
  }, [selectedProject]);

  // Load books when grade changes
  useEffect(() => {
    if (selectedGrade) {
      loadBooksForGrade(selectedGrade);
      setSelectedBook('');
      setSelectedUnit('');
      setSelectedLesson('');
    } else {
      setBooks([]);
      setUnits([]);
      setLessons([]);
      setSelectedBook('');
      setSelectedUnit('');
      setSelectedLesson('');
    }
  }, [selectedGrade]);

  // Load units when book changes
  useEffect(() => {
    if (selectedBook) {
      loadUnitsForBook(selectedBook);
      setSelectedUnit('');
      setSelectedLesson('');
    } else {
      setUnits([]);
      setLessons([]);
      setSelectedUnit('');
      setSelectedLesson('');
    }
  }, [selectedBook]);

  // Load lessons when unit changes
  useEffect(() => {
    if (selectedUnit) {
      loadLessonsForUnit(selectedUnit);
      setSelectedLesson('');
    } else {
      setLessons([]);
      setSelectedLesson('');
    }
  }, [selectedUnit]);

  // Load tasks when any filter changes
  useEffect(() => {
    if (selectedProject) {
      loadTasksForProject(selectedProject);
    } else {
      setTasks([]);
    }
  }, [selectedProject, selectedStage, selectedGrade, selectedBook, selectedUnit, selectedLesson]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [projectsData, teamMembersData] = await Promise.all([
        projectService.getAll(),
        teamService.getMembers()
      ]);
      
      setProjects(projectsData.data || projectsData);
      setTeamMembers(teamMembersData.data || teamMembersData);
    } catch (error) {
      console.error('Failed to load initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStagesForProject = async (projectId: string) => {
    try {
      const stagesData = await stageService.getAll(projectId);
      setStages(stagesData.data || stagesData);
    } catch (error) {
      console.error('Failed to load stages:', error);
      setStages([]);
    }
  };

  const loadGradesForProject = async (projectId: string) => {
    try {
      const gradesData = await gradeService.getByProject(projectId);
      setGrades(gradesData.data || gradesData);
    } catch (error) {
      console.error('Failed to load grades:', error);
      setGrades([]);
    }
  };

  const loadBooksForGrade = async (gradeId: string) => {
    try {
      const booksData = await bookService.getByGrade(gradeId);
      setBooks(booksData.data || booksData);
    } catch (error) {
      console.error('Failed to load books:', error);
      setBooks([]);
    }
  };

  const loadUnitsForBook = async (bookId: string) => {
    try {
      const unitsData = await unitService.getByBook(bookId);
      setUnits(unitsData.data || unitsData);
    } catch (error) {
      console.error('Failed to load units:', error);
      setUnits([]);
    }
  };

  const loadLessonsForUnit = async (unitId: string) => {
    try {
      const lessonsData = await lessonService.getByUnit(unitId);
      setLessons(lessonsData.data || lessonsData);
    } catch (error) {
      console.error('Failed to load lessons:', error);
      setLessons([]);
    }
  };

  const loadTasksForProject = async (projectId: string) => {
    try {
      setLoading(true);
      const queryParams: any = { 
        project_id: projectId,
        all: 'true' // Get all tasks for the project
      };
      
      // Add stage filter if selected
      if (selectedStage) {
        queryParams.stage_id = selectedStage;
      }
      
      // Add educational hierarchy filters if selected
      if (selectedGrade) {
        queryParams.grade_id = selectedGrade;
      }
      if (selectedBook) {
        queryParams.book_id = selectedBook;
      }
      if (selectedUnit) {
        queryParams.unit_id = selectedUnit;
      }
      if (selectedLesson) {
        queryParams.lesson_id = selectedLesson;
      }
      
      const tasksData = await taskService.getAll(queryParams);
      setTasks(tasksData.data || tasksData);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const filteredUsers = teamMembers.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(userSearchTerm.toLowerCase());
    return matchesSearch;
  });

  const handleTaskSelect = (taskId: number) => {
    setSelectedTasks(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };


  const handleAllocate = async () => {
    if (selectedTasks.length === 0 || !selectedTeamMember) {
      alert('Please select at least one task and one team member');
      return;
    }

    try {
      setLoading(true);
      
      // Create allocations for each selected task to the selected team member
      const allocationPromises = selectedTasks.map(taskId => {
        const task = tasks.find(t => t.id === taskId);
        return allocationService.create({
          user_id: selectedTeamMember,
          user_type: 'team',
          task_id: taskId,
          project_id: selectedProject,
          start_date: task?.start_date || allocationDate,
          end_date: allocationDate, // Allocation date is the end_date
          hours_per_day: 8 // Default 8 hours per day
        });
      });

      await Promise.all(allocationPromises);
      
      const selectedUser = teamMembers.find(user => user.id === selectedTeamMember);
      alert(`Successfully allocated, assigned, and updated end dates for ${selectedTasks.length} tasks to ${selectedUser?.name || 'selected team member'}`);
      onAllocationComplete();
    } catch (error) {
      console.error('Failed to create allocations:', error);
      alert('Failed to create allocations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in-progress': return 'bg-blue-100 text-blue-800';
      case 'under-review': return 'bg-yellow-100 text-yellow-800';
      case 'blocked': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Project Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Project *
        </label>
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Choose a project...</option>
          {projects.map(project => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      {/* Stage Selection */}
      {selectedProject && stages.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Stage (Optional)
          </label>
          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All stages</option>
            {stages.map(stage => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-gray-500">
              Filter tasks by stage to narrow down your search
            </p>
            {selectedStage && (
              <button
                onClick={() => setSelectedStage('')}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Clear stage filter
              </button>
            )}
          </div>
        </div>
      )}

      {/* Educational Hierarchy Filters */}
      {selectedProject && grades.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-700">Educational Hierarchy Filters</h3>
          
          {/* Grade Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Grade (Optional)
            </label>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All grades</option>
              {grades.map(grade => (
                <option key={grade.id} value={grade.id}>
                  {grade.name}
                </option>
              ))}
            </select>
          </div>

          {/* Book Selection */}
          {selectedGrade && books.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Book (Optional)
              </label>
              <select
                value={selectedBook}
                onChange={(e) => setSelectedBook(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All books</option>
                {books.map(book => (
                  <option key={book.id} value={book.id}>
                    {book.name} ({book.type})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Unit Selection */}
          {selectedBook && units.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Unit (Optional)
              </label>
              <select
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All units</option>
                {units.map(unit => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Lesson Selection */}
          {selectedUnit && lessons.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Lesson (Optional)
              </label>
              <select
                value={selectedLesson}
                onChange={(e) => setSelectedLesson(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All lessons</option>
                {lessons.map(lesson => (
                  <option key={lesson.id} value={lesson.id}>
                    {lesson.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Clear All Filters Button */}
          {(selectedGrade || selectedBook || selectedUnit || selectedLesson) && (
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setSelectedGrade('');
                  setSelectedBook('');
                  setSelectedUnit('');
                  setSelectedLesson('');
                }}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Clear all educational filters
              </button>
            </div>
          )}
        </div>
      )}

      {selectedProject && (
        <>
          {/* Search and Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Tasks
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or description..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status Filter
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Statuses</option>
                <option value="not-started">Not Started</option>
                <option value="in-progress">In Progress</option>
                <option value="under-review">Under Review</option>
                <option value="completed">Completed</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority Filter
              </label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {/* Tasks List */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              Available Tasks ({filteredTasks.length})
              {(selectedStage || selectedGrade || selectedBook || selectedUnit || selectedLesson) && (
                <span className="text-sm font-normal text-gray-600 ml-2">
                  (filtered by: {[
                    selectedStage && 'stage',
                    selectedGrade && 'grade',
                    selectedBook && 'book',
                    selectedUnit && 'unit',
                    selectedLesson && 'lesson'
                  ].filter(Boolean).join(', ')})
                </span>
              )}
            </h3>
            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
              {loading ? (
                <div className="p-4 text-center text-gray-500">Loading tasks...</div>
              ) : filteredTasks.length === 0 ? (
                <div className="p-4 text-center text-gray-500">No tasks found</div>
              ) : (
                <div className="space-y-2 p-2">
                  {filteredTasks.map(task => (
                    <div
                      key={task.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedTasks.includes(task.id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => handleTaskSelect(task.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-medium text-gray-900">{task.name}</h4>
                            <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(task.status)}`}>
                              {task.status}
                            </span>
                            <span className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(task.priority)}`}>
                              {task.priority}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            {task.description || 'No description'}
                          </p>
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span>Est: {task.estimated_hours}h</span>
                            <span>Progress: {task.progress}%</span>
                            <span>Due: {task.end_date ? new Date(task.end_date).toLocaleDateString() : 'No due date'}</span>
                          </div>
                        </div>
                        <div className="ml-4">
                          {selectedTasks.includes(task.id) && (
                            <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs">✓</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Team Member Selection */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              Select Team Member
            </h3>
            
            {/* Search Input */}
            <div className="mb-3">
              <input
                type="text"
                placeholder="Search team members by name or email..."
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Selected User Display */}
            {selectedTeamMember && (
              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {teamMembers.find(m => m.id === selectedTeamMember)?.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {teamMembers.find(m => m.id === selectedTeamMember)?.name}
                      </p>
                      <p className="text-sm text-gray-600">
                        {teamMembers.find(m => m.id === selectedTeamMember)?.email}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedTeamMember(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* User Dropdown */}
            {!selectedTeamMember && (
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                {filteredUsers.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    {userSearchTerm ? 'No team members found matching your search' : 'No team members available'}
                  </div>
                ) : (
                  filteredUsers.map(member => (
                    <div
                      key={member.id}
                      className="p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => setSelectedTeamMember(member.id)}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {member.name?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{member.name}</p>
                          <p className="text-sm text-gray-600">{member.email}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Allocation Date (End Date) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Allocation End Date *
            </label>
            <input
              type="date"
              value={allocationDate}
              onChange={(e) => setAllocationDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              This will be the new end date for the tasks. The task's end date will be updated to this date, and the start date will remain the task's original start date.
            </p>
          </div>

          {/* Summary */}
          {selectedTasks.length > 0 && selectedTeamMember && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Allocation Summary</h4>
              <p className="text-sm text-blue-800">
                You are about to allocate and assign <strong>{selectedTasks.length} tasks</strong> to{' '}
                <strong>{teamMembers.find(m => m.id === selectedTeamMember)?.name}</strong> with end date{' '}
                <strong>{new Date(allocationDate).toLocaleDateString()}</strong>.
              </p>
              <p className="text-sm text-blue-800 mt-1">
                This will create <strong>{selectedTasks.length} allocations</strong>, assign the tasks to the selected team member, and update each task's end date to <strong>{new Date(allocationDate).toLocaleDateString()}</strong>.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleAllocate}
              disabled={selectedTasks.length === 0 || !selectedTeamMember || loading}
            >
              {loading ? 'Creating Allocations...' : 'Create Allocations'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}