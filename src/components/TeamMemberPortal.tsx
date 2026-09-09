import { useState, useEffect, useMemo, useRef } from 'react';
import {
  CheckSquare,
  Clock,
  AlertTriangle,
  Award,
  TrendingUp,
  LogOut,
  CheckCircle,
  RefreshCw,
  Bell,
  Flag,
  MessageSquare,
  LayoutDashboard,
  FolderOpen,
  Users,
  BarChart3,
  Calendar,
  Trophy,
  Home,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Lock,
  Search,
  X,
  ArrowUpDown,
  Menu,
  ArrowLeft,
  RotateCcw,
  LayoutGrid,
  List as ListIcon,
  Eye,
} from 'lucide-react';
import {
  belongsInOverdueSection,
  compareActiveTasksForDisplay,
  getReworkCardClass,
  getReworkReviewSubLabel,
  getTaskReworkCount,
  isActiveTaskForDashboard,
  isOnHoldTask,
} from '../utils/reworkHighlight';
import { getTaskDisplayProgress } from '../utils/taskProgressDisplay';
import { getTaskStatusLabel } from '../utils/taskStatusDisplay';
import {
  getRemarkLengthMessage,
  getRemarkPlainTextLength,
  isRemarkTooLong,
  REMARK_MAX_PLAIN_LENGTH,
} from '../utils/remarkLimits';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { RichTextEditor } from './ui/RichTextEditor';
import { useToast } from './ui/Toast';
import { useApp } from '../contexts/AppContext';
import { teamTaskService, teamProjectService, teamService, notificationService } from '../services/apiService';
import { TeamNotifications } from './TeamNotifications';
import { TeamTaskDetail } from './TeamTaskDetail';
import { ResubmissionDeadlineBanner } from './ResubmissionDeadlineBanner';
import { KanbanView } from './KanbanView';

import type { Task, User as UserType } from '../types';
import notificationServiceRealTime from '../services/notificationService';
import type { RealTimeNotification } from '../services/notificationService';
import tokenService from '../services/tokenService';
import { usePermissions } from '../hooks/usePermissions';

// Admin components reused inside the PM portal
import { ProjectManager } from './ProjectManager';
import { TeamManager } from './TeamManager';
import { Analytics } from './Analytics';
import { CoreAnalytics } from './CoreAnalytics';
import { DailyAllocations } from './DailyAllocations';
import { TopPerformers } from './TopPerformers';
import { Notification } from './Notification';
import { Dashboard } from './Dashboard';
import { TaskManager } from './TaskManager';

interface TeamMemberPortalProps {
  user: UserType;
  onLogout: () => void;
}

// All portal nav items mapped to permissions
const NAV_ITEMS = [
  { key: 'my-tasks',       label: 'My Tasks',       icon: CheckSquare,     permission: null,                  alwaysVisible: true,  pmOnly: false },
  { key: 'dashboard',      label: 'Dashboard',      icon: LayoutDashboard, permission: 'view_dashboard',      alwaysVisible: false, pmOnly: true  },
  { key: 'projects',       label: 'Projects',       icon: FolderOpen,      permission: 'view_projects',       alwaysVisible: false, pmOnly: false },
  { key: 'tasks',          label: 'All Tasks',      icon: CheckSquare,     permission: 'view_tasks',          alwaysVisible: false, pmOnly: false },
  { key: 'teams',          label: 'Teams',          icon: Users,           permission: 'view_team',           alwaysVisible: false, pmOnly: false },
  { key: 'allocations',    label: 'Allocations',    icon: Calendar,        permission: 'view_allocations',    alwaysVisible: false, pmOnly: false },
  { key: 'top-performers', label: 'Top Performers', icon: Trophy,          permission: 'view_top_performers', alwaysVisible: false, pmOnly: false },
  { key: 'analytics',      label: 'Analytics',      icon: BarChart3,       permission: 'view_analytics',      alwaysVisible: false, pmOnly: false },
  { key: 'core-analytics', label: 'Core Analytics', icon: TrendingUp,      permission: 'view_analytics',      alwaysVisible: false, pmOnly: false },
  { key: 'notifications',  label: 'Manage Extensions', icon: Bell,            permission: 'view_notifications',  alwaysVisible: false, pmOnly: false },
];

export function TeamMemberPortal({ user, onLogout }: TeamMemberPortalProps) {
  const { showToast } = useToast();
  const { state, dispatch } = useApp();
  const { can, accessInfo, loading: permissionsLoading, refetch: refetchPermissions } = usePermissions();

  const [activeView, setActiveView] = useState<string>('my-tasks');
  const [previousView, setPreviousView] = useState<string>('my-tasks');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    const saved = sessionStorage.getItem('team_sidebar_state');
    return saved === 'expanded' ? false : true; // default collapsed
  });
  const [userTasks, setUserTasks] = useState<Task[]>([]);
  const [userProjects, setUserProjects] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);
  const [isRemarkModalOpen, setIsRemarkModalOpen] = useState(false);
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<Task | null>(null);
  const [extensionReason, setExtensionReason] = useState('');
  const [extensionDate, setExtensionDate] = useState('');
  const [remarkContent, setRemarkContent] = useState('');
  const [remarkDate, setRemarkDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarkType, setRemarkType] = useState('general');
  const [serverLocation, setServerLocation] = useState('');
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [performanceFlags, setPerformanceFlags] = useState<any[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [, setRecentNotifications] = useState<RealTimeNotification[]>([]);
  const [selectedFlagType, setSelectedFlagType] = useState<string | null>(null);
  const [showFlagTasksModal, setShowFlagTasksModal] = useState(false);
  const [showAllActiveTasks, setShowAllActiveTasks] = useState(false);
  const [showAllOverdueTasks, setShowAllOverdueTasks] = useState(false);
  const [showAllCompletedTasks, setShowAllCompletedTasks] = useState(false);
  const [showAllUpcomingTasks, setShowAllUpcomingTasks] = useState(false);
  const [showAllUnderReviewTasks, setShowAllUnderReviewTasks] = useState(false);

  // KPI card click: highlights and scrolls to the matching section
  const [activeStatFilter, setActiveStatFilter] = useState<'active' | 'underReview' | 'overdue' | 'upcoming' | 'completed' | 'resubmitted' | null>(null);
  const sectionRefs = {
    active: useRef<HTMLDivElement>(null),
    underReview: useRef<HTMLDivElement>(null),
    overdue: useRef<HTMLDivElement>(null),
    upcoming: useRef<HTMLDivElement>(null),
    completed: useRef<HTMLDivElement>(null),
    resubmitted: useRef<HTMLDivElement>(null),
  };

  // Active Tasks search & sort
  const [activeTaskSearch, setActiveTaskSearch] = useState('');
  const [activeTaskSort, setActiveTaskSort] = useState<'default' | 'priority' | 'due-date' | 'progress' | 'name' | 'recently-assigned'>('default');
  const [activeTaskSortOpen, setActiveTaskSortOpen] = useState(false);
  const [activeTaskPriorityFilter, setActiveTaskPriorityFilter] = useState<'all' | 'urgent' | 'high' | 'medium' | 'low'>('all');

  // Dashboard layout toggle: list (existing) vs kanban (new)
  const [dashboardView, setDashboardView] = useState<'list' | 'kanban'>(() => {
    try {
      const saved = sessionStorage.getItem('team_dashboard_view');
      return saved === 'kanban' ? 'kanban' : 'list';
    } catch {
      return 'list';
    }
  });

  // Close sort dropdown on outside click
  useEffect(() => {
    if (!activeTaskSortOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-sort-dropdown]')) {
        setActiveTaskSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeTaskSortOpen]);

  // Sidebar items filtered by permissions
  const visibleNavItems = NAV_ITEMS.filter(item => {
    if (item.alwaysVisible) return true;
    if (!item.permission) return false;
    // pmOnly items are restricted to project managers regardless of permission flags
    if (item.pmOnly && accessInfo?.role !== 'project_manager') return false;
    return can(item.permission as any);
  });

  const hasSidebar = visibleNavItems.length > 1;
  const isProjectManager = accessInfo?.role === 'project_manager';

  // If current view is revoked, fall back to my-tasks
  useEffect(() => {
    if (!permissionsLoading && accessInfo) {
      const currentItem = NAV_ITEMS.find(n => n.key === activeView);
      if (currentItem && !currentItem.alwaysVisible && currentItem.permission) {
        const blocked =
          (currentItem.pmOnly && accessInfo.role !== 'project_manager') ||
          !can(currentItem.permission as any);
        if (blocked) {
          setActiveView('my-tasks');
        }
      }
    }
  }, [accessInfo, permissionsLoading]);

  // Wrapper function to track previous view when changing views
  const changeView = (newView: string) => {
    if (newView !== activeView) {
      setPreviousView(activeView);
      setActiveView(newView);
    }
  };

  // Handle browser back/forward button
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // Prevent default browser back behavior that might log out
      event.preventDefault();
      
      // If viewing a task detail, go back to previous view
      if (selectedTaskForDetail) {
        setSelectedTaskForDetail(null);
      } 
      // If not on my-tasks view, go back to previous view
      else if (activeView !== 'my-tasks') {
        setActiveView(previousView);
      }
    };

    // Add state to history to enable back button handling
    window.history.pushState({ page: activeView }, '', '');
    
    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [activeView, selectedTaskForDetail, previousView]);

  useEffect(() => { loadUserData(); loadNotificationCount(); }, [user.id]);

  useEffect(() => {
    if (state.selectedTaskId && userTasks.length > 0) {
      const task = userTasks.find(t => t.id.toString() === state.selectedTaskId);
      if (task) setSelectedTaskForDetail(task);
    }
  }, [state.selectedTaskId, userTasks]);

  useEffect(() => {
    if (user) {
      tokenService.initializeTeamAutoRefresh();
      return () => { tokenService.cleanup(); };
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      const token = sessionStorage.getItem('teamToken');
      if (token) {
        try { notificationServiceRealTime.connect(token, 'team'); } catch (e) { console.error(e); }

        const unsub1 = notificationServiceRealTime.onConnectionChange((connected) => {
          setIsConnected(connected);
          if (connected) {
            notificationServiceRealTime.joinAssignedProjects(userProjects.map(p => p.id));
          }
        });
        const unsub2 = notificationServiceRealTime.onNotification((n) => {
          setRecentNotifications(prev => [n, ...prev.slice(0, 4)]);
          setNotificationCount(prev => prev + 1);
          if (n.type === 'task_reviewed' || n.data?.action === 'deny' || n.data?.action === 'approve') {
            void loadUserTasks();
            void loadNotificationCount();
          }
        });
        return () => { unsub1(); unsub2(); notificationServiceRealTime.disconnect(); };
      }
    }
  }, [user, userProjects]);

  const loadNotificationCount = async () => {
    try {
      const response = await notificationService.getTeamNotifications();
      if (response?.data) {
        const { extensions, remarks, completedTasks } = response.data;
        const now = Date.now();
        const oneDayAgo = new Date(now - 86400000);
        setNotificationCount(
          extensions.filter((e: any) => e.status === 'pending').length +
          remarks.filter((r: any) => new Date(r.created_at || r.remark_date) > oneDayAgo).length +
          completedTasks.filter((t: any) => new Date(t.completed_at) > oneDayAgo).length
        );
      }
    } catch { /* silent */ }
  };

  const loadUserData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadUserTasks(), loadUserProjects(), loadPerformanceFlags()]);
    } finally {
      setLoading(false);
    }
  };

  const loadUserTasks = async () => {
    try { setUserTasks((await teamService.getMyTasks()) || []); } catch { setUserTasks([]); }
  };

  const loadUserProjects = async () => {
    try { setUserProjects((await teamProjectService.getAll()) || []); } catch { setUserProjects([]); }
  };

  const loadPerformanceFlags = async () => {
    try {
      const r = await teamService.getMyPerformanceFlags();
      setPerformanceFlags(r?.flags || []);
    } catch { setPerformanceFlags([]); }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Re-fetch permissions so role changes from admin take effect immediately
      await refetchPermissions();
      await Promise.all([loadUserData(), loadNotificationCount()]);
      showToast('Data refreshed!', 'success');
    } catch { showToast('Failed to refresh', 'error'); }
    finally { setRefreshing(false); }
  };

  const handleSetDashboardView = (view: 'list' | 'kanban') => {
    setDashboardView(view);
    try { sessionStorage.setItem('team_dashboard_view', view); } catch { /* ignore */ }
  };

  const handleRequestExtension = (task: Task) => { setSelectedTask(task); setIsExtensionModalOpen(true); };
  const handleAddRemark = (task: Task) => { setSelectedTask(task); setIsRemarkModalOpen(true); };
  const handleViewTaskDetail = (task: Task) => { setSelectedTaskForDetail(task); };
  const handleBackFromTaskDetail = () => { setSelectedTaskForDetail(null); };
  const handleFlagTypeClick = (type: string) => { setSelectedFlagType(type); setShowFlagTasksModal(true); };
  const handleCloseFlagTasksModal = () => { setShowFlagTasksModal(false); setSelectedFlagType(null); };

  const submitExtensionRequest = async () => {
    if (selectedTask) {
      if (!extensionDate.trim()) { showToast('❌ Please select a new due date.', 'error'); return; }
      if (!extensionReason.trim()) { showToast('❌ Please provide a reason.', 'error'); return; }
      try {
        if (tokenService.isTeamTokenExpired()) { onLogout(); return; }
        await teamTaskService.requestExtension(selectedTask.id, { requested_due_date: extensionDate, reason: extensionReason });
        await loadUserData();
        showToast('Extension request submitted!', 'success');
      } catch (e: any) {
        if (e.message?.includes('401') || e.message?.includes('Token expired')) onLogout();
        else showToast('Failed to submit extension request.', 'error');
      }
    }
    setIsExtensionModalOpen(false); setSelectedTask(null); setExtensionReason(''); setExtensionDate('');
  };

  const submitRemark = async () => {
    const hasContent = remarkContent.replace(/<[^>]*>/g, '').trim().length > 0;
    if (selectedTask && hasContent) {
      try {
        if (tokenService.isTeamTokenExpired()) { onLogout(); return; }
        if (!serverLocation.trim()) { showToast('❌ Server Location is required.', 'error'); return; }
        if (!fileName.trim()) { showToast('❌ File Name is required.', 'error'); return; }
        const remarkLengthError = getRemarkLengthMessage(remarkContent);
        if (remarkLengthError) { showToast(`❌ ${remarkLengthError}`, 'error'); return; }
        await teamTaskService.addRemark(selectedTask.id, {
          remark: remarkContent, remark_date: remarkDate, remark_type: remarkType,
          server_location: serverLocation, file_name: fileName
        });
        if (remarkType === 'complete') {
          showToast('Task submitted for review!', 'success');
        } else if (remarkType === 'skipped') {
          showToast('Task marked as skipped!', 'success');
        } else if (remarkType === 'general' && selectedTask.status === 'not-started') {
          showToast('Task marked as In Progress (50%).', 'success');
        } else {
          showToast('Remark added!', 'success');
        }
        await loadUserData();
      } catch (e: any) {
        if (e.message?.includes('401') || e.message?.includes('Token expired')) onLogout();
        else showToast(e.message ? `❌ ${e.message}` : 'Failed to add remark.', 'error');
      }
    }
    setIsRemarkModalOpen(false); setSelectedTask(null); setRemarkContent('');
    setRemarkDate(new Date().toISOString().split('T')[0]); setRemarkType('general');
    setServerLocation(''); setFileName('');
  };

  const isTaskOverdue = (task: Task) => {
    const s = (task.status || '').toLowerCase().replace(/_/g, '-');
    // Submitted tasks are pending admin/PM — never overdue from assignee's view
    if (!task.end_date || s === 'completed' || s === 'under-review' || s === 'resubmitted') return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = new Date(task.end_date); due.setHours(0, 0, 0, 0);
    return due < today;
  };

  const getDaysUntilDue = (task: Task) => {
    if (!task.end_date) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = new Date(task.end_date); due.setHours(0, 0, 0, 0);
    return Math.round((due.getTime() - today.getTime()) / 86400000);
  };

  const completedTasks = userTasks.filter(t => t.status === 'completed');
  const overdueTasks = userTasks.filter(t => belongsInOverdueSection(t, isTaskOverdue));

  // Under Review tasks: submitted by the user, pending admin/PM approval
  const underReviewTasks = userTasks.filter(t => {
    const s = (t.status || '').toLowerCase().replace(/_/g, '-');
    return s === 'under-review' || s === 'resubmitted';
  });

  const completionRate = userTasks.length > 0 ? Math.round((completedTasks.length / userTasks.length) * 100) : 0;

  // Resubmitted / rework tasks: returned/redo-requested/resubmitted with at least 1 rework
  const resubmittedTasks = userTasks.filter(t => {
    const s = (t.status || '').toLowerCase().replace(/_/g, '-');
    return (s === 'returned' || s === 'redo-requested' || s === 'resubmitted') && getTaskReworkCount(t) > 0;
  });

  // On-hold tasks – shown separately below kanban
  const onHoldTasks = userTasks.filter(t => isOnHoldTask(t));

  // Active tasks: work in progress, not yet submitted to admin/PM.
  // Explicitly exclude: completed, on-hold, under-review, resubmitted (those go to their own sections)
  const activeTasks = userTasks.filter(t => {
    if (t.status === 'completed') return false;
    if (isOnHoldTask(t)) return false;
    const s = (t.status || '').toLowerCase().replace(/_/g, '-');
    // Submitted tasks belong in Under Review, not Active
    if (s === 'under-review' || s === 'resubmitted') return false;
    // Rework tasks (returned/redo-requested with rework count) belong in their own section
    if ((s === 'returned' || s === 'redo-requested') && getTaskReworkCount(t) > 0) return false;
    return isActiveTaskForDashboard(t);
  });

  const upcomingTasks = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return userTasks
      .filter(t => {
        if (t.status === 'completed') return false;
        if (isOnHoldTask(t)) return false;
        const s = (t.status || '').toLowerCase().replace(/_/g, '-');
        // Submitted tasks belong in Under Review, not Upcoming
        if (s === 'under-review' || s === 'resubmitted') return false;
        if ((s === 'returned' || s === 'redo-requested' || s === 'resubmitted') && getTaskReworkCount(t) > 0) return false;
        if (!t.end_date) return false;
        const due = new Date(t.end_date); due.setHours(0, 0, 0, 0);
        return due >= today;
      })
      .sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime());
  }, [userTasks]);

  const PRIORITY_ORDER: Record<string, number> = { urgent: 0, critical: 0, high: 1, medium: 2, low: 3 };
  const normalizeTaskPriority = (priority?: string) => {
    const value = (priority || '').toLowerCase();
    return value === 'critical' ? 'urgent' : value;
  };

  const filteredActiveTasks = useMemo(() => {
    let tasks = activeTasks;
    // search
    if (activeTaskSearch.trim()) {
      const q = activeTaskSearch.toLowerCase();
      tasks = tasks.filter(t =>
        t.name.toLowerCase().includes(q) ||
        (t.project_name || '').toLowerCase().includes(q)
      );
    }
    // priority filter
    if (activeTaskPriorityFilter !== 'all') {
      tasks = tasks.filter(t => normalizeTaskPriority(t.priority) === activeTaskPriorityFilter);
    }

    const sorted = [...tasks];
    if (activeTaskSort === 'default') {
      sorted.sort((a, b) => compareActiveTasksForDisplay(a, b, isTaskOverdue, () => 0));
    } else {
      sorted.sort((a, b) => {
        if (activeTaskSort === 'priority') {
          return (PRIORITY_ORDER[normalizeTaskPriority(a.priority)] ?? 9)
            - (PRIORITY_ORDER[normalizeTaskPriority(b.priority)] ?? 9);
        }
        if (activeTaskSort === 'due-date') {
          if (!a.end_date) return 1;
          if (!b.end_date) return -1;
          return new Date(a.end_date).getTime() - new Date(b.end_date).getTime();
        }
        if (activeTaskSort === 'progress') {
          return getTaskDisplayProgress(b) - getTaskDisplayProgress(a);
        }
        if (activeTaskSort === 'name') {
          return a.name.localeCompare(b.name);
        }
        if (activeTaskSort === 'recently-assigned') {
          const aDate = a.start_date ? new Date(a.start_date).getTime() : 0;
          const bDate = b.start_date ? new Date(b.start_date).getTime() : 0;
          return bDate - aDate;
        }
        return 0;
      });
    }
    return sorted;
  }, [activeTasks, activeTaskSearch, activeTaskPriorityFilter, activeTaskSort]);

  // ── Loading state ──────────────────────────────────────────────────
  if (loading || permissionsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-6 text-gray-600" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Loading Your Portal</h2>
          <p className="text-gray-600">Preparing your personalized dashboard...</p>
        </div>
      </div>
    );
  }

  // ── Task detail view ───────────────────────────────────────────────
  if (selectedTaskForDetail) {
    return <TeamTaskDetail task={selectedTaskForDetail} onBack={handleBackFromTaskDetail} onTaskUpdate={loadUserData} />;
  }

  // ── Route to the right component for the active view ──────────────
  const renderActiveView = () => {
    switch (activeView) {
      case 'dashboard':      return <Dashboard />;
      case 'projects':       return <ProjectManager />;
      case 'tasks':          return <TaskManager />;
      case 'teams':          return <TeamManager />;
      case 'allocations':
        return (
          <DailyAllocations
            onNavigateToTask={(taskId) => {
              dispatch({ type: 'SET_PREVIOUS_VIEW', payload: state.selectedView });
              dispatch({ type: 'SET_SELECTED_TASK', payload: taskId.toString() });
              dispatch({ type: 'SET_SELECTED_VIEW', payload: 'task-details' as any });
            }}
          />
        );
      case 'top-performers':  return <TopPerformers />;
      case 'analytics':       return <Analytics />;
      case 'core-analytics':  return <CoreAnalytics />;
      case 'notifications':   return <Notification />;
      default:                return renderMyTasksView();
    }
  };

  // ── My Tasks view (List or Kanban) ────────────────────────────────
  const renderMyTasksView = () => (
    <div className="w-full px-6 py-8">
      {/* Stats row — List view only */}
      {dashboardView === 'list' && (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {[
          { key: 'active' as const, label: 'Active', value: activeTasks.length, icon: CheckSquare, accent: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', activeBorder: 'border-indigo-400', activeRing: 'ring-2 ring-indigo-400/60' },
          { key: 'underReview' as const, label: 'Under Review', value: underReviewTasks.length, icon: Eye, accent: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100', activeBorder: 'border-orange-400', activeRing: 'ring-2 ring-orange-400/60' },
          { key: 'overdue' as const, label: 'Overdue', value: overdueTasks.length, icon: AlertTriangle, accent: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100', activeBorder: 'border-red-400', activeRing: 'ring-2 ring-red-400/60' },
          { key: 'upcoming' as const, label: 'Upcoming', value: upcomingTasks.length, icon: Calendar, accent: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', activeBorder: 'border-blue-400', activeRing: 'ring-2 ring-blue-400/60' },
          { key: 'completed' as const, label: 'Completed', value: completedTasks.length, icon: CheckCircle, accent: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100', activeBorder: 'border-green-400', activeRing: 'ring-2 ring-green-400/60' },
          { key: 'resubmitted' as const, label: 'Resubmitted', value: resubmittedTasks.length, icon: RotateCcw, accent: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', activeBorder: 'border-amber-400', activeRing: 'ring-2 ring-amber-400/60' },
        ].map(({ key, label, value, icon: Icon, accent, bg, border, activeBorder, activeRing }) => {
          const isActive = activeStatFilter === key;
          return (
            <button
              key={label}
              type="button"
              onClick={() => {
                const next = isActive ? null : key;
                setActiveStatFilter(next);
                if (next && sectionRefs[next]?.current) {
                  setTimeout(() => {
                    sectionRefs[next]!.current!.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 50);
                }
              }}
              title={isActive ? `Clear filter` : `Show only ${label} tasks`}
              className={`flex items-center gap-3 p-4 rounded-xl ${bg} border ${isActive ? `${activeBorder} ${activeRing} shadow-md` : border} transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 cursor-pointer text-left w-full`}
            >
              <div className={`p-2 rounded-lg bg-white shadow-sm ${isActive ? 'shadow' : ''}`}>
                <Icon className={`w-4 h-4 ${accent}`} />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">{label}</p>
                <p className={`text-xl font-bold ${accent}`}>{value}</p>
              </div>
            </button>
          );
        })}
      </div>
      )}

      {/* Performance Flags — List view only */}
      {dashboardView === 'list' && performanceFlags.length > 0 && (
        <div className="mb-8 p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Flag className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">Performance Flags</span>
            <span className="ml-auto text-xs text-gray-400">{performanceFlags.length} total</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { type: 'green', bg: 'bg-green-50', border: 'border-green-200', dot: 'bg-green-500', text: 'text-green-700', label: 'Green' },
              { type: 'yellow', bg: 'bg-yellow-50', border: 'border-yellow-200', dot: 'bg-yellow-400', text: 'text-yellow-700', label: 'Yellow' },
              { type: 'orange', bg: 'bg-orange-50', border: 'border-orange-200', dot: 'bg-orange-500', text: 'text-orange-700', label: 'Orange' },
              { type: 'red', bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500', text: 'text-red-700', label: 'Red' },
            ].map(({ type, bg, border, dot, text, label }) => {
              const count = performanceFlags.filter(f => f.type === type).length;
              return (
                <button key={type} onClick={() => handleFlagTypeClick(type)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 ${bg} border ${border} rounded-lg hover:opacity-80 transition-opacity text-left`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${dot} shrink-0`} />
                  <span className={`text-sm font-semibold ${text}`}>{count}</span>
                  <span className={`text-xs ${text} opacity-80`}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* View toggle + section title */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">
            {dashboardView === 'kanban' ? 'Kanban Board' : 'My Tasks'}
          </h2>
          <p className="text-xs text-gray-400 font-medium">
            {dashboardView === 'kanban'
              ? 'Visual task board — all your work at a glance'
              : 'All tasks assigned to you'}
          </p>
        </div>
        {/* Modern segmented control */}
        <div
          className="flex items-center p-1 rounded-xl border border-gray-200 bg-gray-100/80 shadow-sm"
          role="group"
          aria-label="Dashboard view toggle"
        >
          <button
            onClick={() => handleSetDashboardView('list')}
            title="List view"
            aria-pressed={dashboardView === 'list'}
            className={[
              'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
              dashboardView === 'list'
                ? 'bg-white shadow text-gray-800 border border-gray-200/80'
                : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            <ListIcon className="w-3.5 h-3.5" aria-hidden />
            List
          </button>
          <button
            onClick={() => handleSetDashboardView('kanban')}
            title="Kanban board view"
            aria-pressed={dashboardView === 'kanban'}
            className={[
              'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
              dashboardView === 'kanban'
                ? 'bg-white shadow text-blue-700 border border-blue-200/80'
                : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            <LayoutGrid className="w-3.5 h-3.5" aria-hidden />
            Kanban
          </button>
        </div>
      </div>

      {/* ── Kanban view ── */}
      {dashboardView === 'kanban' && (
        <KanbanView
          tasks={userTasks}
          onView={handleViewTaskDetail}
          onAddRemark={handleAddRemark}
          onRequestExtension={handleRequestExtension}
        />
      )}

      {/* ── List view ── */}
      {dashboardView === 'list' && (
        <div className="flex flex-col gap-6">

        {/* ── Row 1: Active Tasks — full width ── */}
        <div ref={sectionRefs.active} className={`transition-all duration-300 rounded-xl ${activeStatFilter === 'active' ? 'ring-2 ring-indigo-400/60 shadow-lg' : ''}`}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="flex items-center gap-2 shrink-0">
                <CheckSquare className="w-5 h-5 text-gray-600" />
                <span className="whitespace-nowrap">Active Tasks ({activeTasks.length})</span>
              </div>

              {/* Search — grows to fill space */}
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search active tasks..."
                  value={activeTaskSearch}
                  onChange={(e) => { setActiveTaskSearch(e.target.value); setShowAllActiveTasks(false); }}
                  className="w-full h-8 pl-8 pr-7 text-sm rounded-lg border border-gray-200 bg-gray-50 placeholder-gray-400 text-gray-800 outline-none font-normal transition-all hover:border-gray-300 hover:bg-white focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                />
                {activeTaskSearch && (
                  <button
                    onClick={() => setActiveTaskSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Priority select */}
              <div className="relative shrink-0">
                <select
                  value={activeTaskPriorityFilter}
                  onChange={(e) => { setActiveTaskPriorityFilter(e.target.value as any); setShowAllActiveTasks(false); }}
                  className="h-8 pl-2.5 pr-7 text-xs rounded-lg border border-gray-200 bg-white text-gray-700 outline-none appearance-none cursor-pointer hover:border-gray-300 focus:border-indigo-400 font-normal"
                >
                  <option value="all">All Priority</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              </div>

              {/* Sort dropdown */}
              <div className="relative shrink-0" data-sort-dropdown>
                <button
                  onClick={() => setActiveTaskSortOpen(prev => !prev)}
                  className="flex items-center gap-1.5 h-8 px-3 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 text-gray-600 transition-colors font-normal"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span>
                    {activeTaskSort === 'default' ? 'Sort' :
                     activeTaskSort === 'due-date' ? 'Due Date' :
                     activeTaskSort === 'recently-assigned' ? 'Recently Assigned' :
                     activeTaskSort.charAt(0).toUpperCase() + activeTaskSort.slice(1)}
                  </span>
                  <ChevronDown className="w-3 h-3" />
                </button>
                {activeTaskSortOpen && (
                  <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                    {(['default', 'priority', 'due-date', 'progress', 'name', 'recently-assigned'] as const).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => { setActiveTaskSort(opt); setActiveTaskSortOpen(false); setShowAllActiveTasks(false); }}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors first:rounded-t-lg last:rounded-b-lg ${
                          activeTaskSort === opt
                            ? 'bg-indigo-50 text-indigo-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {opt === 'default' ? 'Default' :
                         opt === 'due-date' ? 'Due Date' :
                         opt === 'recently-assigned' ? 'Recently Assigned' :
                         opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Result count / clear when filtered */}
            {activeTasks.length > 0 && (activeTaskSearch || activeTaskPriorityFilter !== 'all') && (
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-500">Showing {filteredActiveTasks.length} of {activeTasks.length} tasks</p>
                <button onClick={() => { setActiveTaskSearch(''); setActiveTaskPriorityFilter('all'); setActiveTaskSort('default'); }} className="text-xs text-indigo-600 hover:underline">Clear filters</button>
              </div>
            )}
            {activeTasks.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No active tasks. Great job!</p>
              </div>
            ) : filteredActiveTasks.length === 0 ? (
              <div className="text-center py-8">
                <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No tasks match your search.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {(showAllActiveTasks ? filteredActiveTasks : filteredActiveTasks.slice(0, 6)).map((task) => {
                  const overdue = isTaskOverdue(task);
                  const reworkCount = getTaskReworkCount(task);
                  const onHold = isOnHoldTask(task);
                  const reworkCardClass = onHold ? 'task-card--on-hold' : getReworkCardClass(reworkCount);
                  const reworkBadgeTone = reworkCount >= 3 ? 'red' : reworkCount === 2 ? 'orange' : reworkCount === 1 ? 'yellow' : null;
                  return (
                    <div
                      key={task.id}
                      className={`p-4 border border-gray-200 rounded-lg transition-shadow cursor-pointer hover:shadow-md ${reworkCardClass || ''}`}
                      onClick={() => handleViewTaskDetail(task)}
                    >
                      <div className={`flex items-start justify-between mb-2 p-2 rounded-lg ${
                        reworkCardClass ? '' :
                        task.performance_flag_type === 'red' ? 'bg-red-50' :
                        task.performance_flag_type === 'orange' ? 'bg-orange-50' :
                        task.performance_flag_type === 'yellow' ? 'bg-yellow-50' :
                        task.performance_flag_type === 'green' ? 'bg-green-50' : ''
                      }`}>
                        <div className="flex flex-col min-w-0 flex-1">
                          <h4 className="font-medium text-gray-900 line-clamp-2">{task.name}</h4>
                          {(task.component_path || task.grade_name) && (
                            <div
                              className="mt-0.5 text-xs text-purple-600 truncate"
                              title={task.component_path || task.grade_name}
                            >
                              📚 {task.component_path || task.grade_name}
                            </div>
                          )}
                          {task.performance_flag_type && !reworkCardClass && (
                            <div className={`flex items-center gap-1 mt-1 text-xs font-semibold ${
                              task.performance_flag_type === 'red' ? 'text-red-600' :
                              task.performance_flag_type === 'orange' ? 'text-orange-600' :
                              task.performance_flag_type === 'yellow' ? 'text-yellow-600' : 'text-green-600'
                            }`}>
                              <Flag className="w-3 h-3" />
                              <span>{task.performance_flag_type.toUpperCase()} FLAG: {task.performance_flag_reason}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 ml-2 shrink-0">
                          <div className="flex items-center gap-1 flex-wrap justify-end">
                            {onHold && <Badge variant="secondary" size="sm">{getTaskStatusLabel('on-hold')}</Badge>}
                            {reworkCount > 0 && reworkBadgeTone && (
                              <span className={`rework-returned-badge rework-returned-badge--${reworkBadgeTone}`} role="status" title={`Returned for rework — ${getReworkReviewSubLabel(reworkCount)}`}>
                                <span className="inline-flex items-center gap-0.5"><RotateCcw className="w-3 h-3 shrink-0" aria-hidden />Rework</span>
                                <span className="rework-returned-badge__round">{getReworkReviewSubLabel(reworkCount)}</span>
                              </span>
                            )}
                            <Badge variant={task.priority === 'urgent' ? 'danger' : task.priority === 'high' ? 'warning' : 'default'} size="sm">{task.priority}</Badge>
                            {overdue && <AlertTriangle className="w-4 h-4 text-red-500" aria-label="Overdue" />}
                          </div>
                        </div>
                      </div>
                      <ResubmissionDeadlineBanner deadline={task.resubmission_deadline ?? task.resubmissionDeadline} remainingTime={task.remainingTime} resubmissionOverdue={task.resubmissionOverdue} />
                      <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                        <span className="truncate mr-2">{task.project_name}</span>
                        <span className={`shrink-0 ${overdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                          {task.end_date ? <>Due {new Date(task.end_date).toLocaleDateString()}</> : 'No due date'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div className="bg-gray-600 h-2 rounded-full" style={{ width: `${getTaskDisplayProgress(task)}%` }} />
                          </div>
                          <span className="text-sm text-gray-600">{getTaskDisplayProgress(task)}%</span>
                        </div>
                        {!onHold && (
                          <button onClick={(e) => { e.stopPropagation(); handleAddRemark(task); }} className="inline-flex items-center justify-center gap-1 h-7 px-3 text-xs font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors whitespace-nowrap">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3v-3z" /></svg>
                            Add Remark
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {filteredActiveTasks.length > 6 && (
              <div className="text-center pt-4">
                <Button variant="outline" size="sm" onClick={() => setShowAllActiveTasks(!showAllActiveTasks)}>
                  {showAllActiveTasks ? 'Show Less' : `View All (${filteredActiveTasks.length})`}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        </div>{/* end active tasks wrapper */}

        {/* ── Row 2: Overdue | Under Review | Upcoming — equal 3 columns ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Overdue */}
          <div ref={sectionRefs.overdue} className={`transition-all duration-300 rounded-xl ${activeStatFilter === 'overdue' ? 'ring-2 ring-red-400/60 shadow-lg' : ''}`}>
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <span>Overdue ({overdueTasks.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                {overdueTasks.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No overdue tasks. Keep it up!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(showAllOverdueTasks ? overdueTasks : overdueTasks.slice(0, 5)).map((task) => {
                      const daysOverdue = Math.abs(getDaysUntilDue(task) || 0);
                      return (
                        <div key={task.id} className="p-3 border border-red-200 bg-red-50 rounded-lg hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleViewTaskDetail(task)}>
                          <div className="flex items-start justify-between mb-1.5">
                            <div className="min-w-0 flex-1 mr-2">
                              <h4 className="font-medium text-gray-900 text-sm line-clamp-2">{task.name}</h4>
                              {(task.component_path || task.grade_name) && (
                                <div
                                  className="mt-0.5 text-xs text-purple-600 truncate"
                                  title={task.component_path || task.grade_name}
                                >
                                  📚 {task.component_path || task.grade_name}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Badge variant="danger" size="sm">{task.priority}</Badge>
                              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                            <span className="truncate mr-2">{task.project_name}</span>
                            <span className="text-red-600 font-medium shrink-0">{daysOverdue}d overdue</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <div className="w-12 bg-gray-200 rounded-full h-1.5">
                                <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${getTaskDisplayProgress(task)}%` }} />
                              </div>
                              <span className="text-xs text-gray-500">{getTaskDisplayProgress(task)}%</span>
                            </div>
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleRequestExtension(task); }} className="h-6 px-2 text-xs text-red-600 border-red-300 hover:bg-red-50">
                                <Clock className="w-3 h-3 mr-0.5" /> Extend
                              </Button>
                              <Button size="sm" onClick={(e) => { e.stopPropagation(); handleAddRemark(task); }} className="h-6 px-2 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                                <MessageSquare className="w-3 h-3 mr-0.5" /> Remark
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {overdueTasks.length > 5 && (
                      <div className="text-center pt-2">
                        <Button variant="outline" size="sm" onClick={() => setShowAllOverdueTasks(!showAllOverdueTasks)}>
                          {showAllOverdueTasks ? 'Show Less' : `View All (${overdueTasks.length})`}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Under Review */}
          <div ref={sectionRefs.underReview} className={`transition-all duration-300 rounded-xl ${activeStatFilter === 'underReview' ? 'ring-2 ring-orange-400/60 shadow-lg' : ''}`}>
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Eye className="w-5 h-5 text-orange-600" />
                  <span>Under Review ({underReviewTasks.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                {underReviewTasks.length === 0 ? (
                  <div className="text-center py-8">
                    <Eye className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No tasks under review.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(showAllUnderReviewTasks ? underReviewTasks : underReviewTasks.slice(0, 5)).map((task) => {
                      const reworkCount = getTaskReworkCount(task);
                      const isResubmitted = (task.status || '').toLowerCase().replace(/_/g, '-') === 'resubmitted';
                      return (
                        <div key={task.id} className="p-3 border border-orange-200 bg-orange-50 rounded-lg hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleViewTaskDetail(task)}>
                          <div className="flex items-start justify-between mb-1.5">
                            <div className="min-w-0 flex-1 mr-2">
                              <h4 className="font-medium text-gray-900 text-sm line-clamp-2">{task.name}</h4>
                              {(task.component_path || task.grade_name) && (
                                <div
                                  className="mt-0.5 text-xs text-purple-600 truncate"
                                  title={task.component_path || task.grade_name}
                                >
                                  📚 {task.component_path || task.grade_name}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <Badge variant={task.priority === 'urgent' ? 'danger' : task.priority === 'high' ? 'warning' : 'default'} size="sm">{task.priority}</Badge>
                              {isResubmitted && reworkCount > 0 && <Badge variant="warning" size="sm" className="text-xs">Resubmitted</Badge>}
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                            <span className="truncate mr-2">{task.project_name}</span>
                            <span className="text-orange-600 font-medium shrink-0">{isResubmitted ? 'Re-submitted' : 'Submitted'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <div className="w-12 bg-gray-200 rounded-full h-1.5">
                                <div className="bg-orange-400 h-1.5 rounded-full" style={{ width: `${getTaskDisplayProgress(task)}%` }} />
                              </div>
                              <span className="text-xs text-gray-500">{getTaskDisplayProgress(task)}%</span>
                            </div>
                            <span className="text-xs text-gray-400">{task.updated_at ? new Date(task.updated_at).toLocaleDateString() : 'recently'}</span>
                          </div>
                        </div>
                      );
                    })}
                    {underReviewTasks.length > 5 && (
                      <div className="text-center pt-2">
                        <Button variant="outline" size="sm" onClick={() => setShowAllUnderReviewTasks(!showAllUnderReviewTasks)}>
                          {showAllUnderReviewTasks ? 'Show Less' : `View All (${underReviewTasks.length})`}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Upcoming */}
          <div ref={sectionRefs.upcoming} className={`transition-all duration-300 rounded-xl ${activeStatFilter === 'upcoming' ? 'ring-2 ring-blue-400/60 shadow-lg' : ''}`}>
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <span>Upcoming ({upcomingTasks.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                {upcomingTasks.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No upcoming tasks scheduled.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(showAllUpcomingTasks ? upcomingTasks : upcomingTasks.slice(0, 5)).map((task) => {
                      const days = getDaysUntilDue(task);
                      return (
                        <div key={task.id} className="p-3 border border-blue-200 bg-blue-50 rounded-lg hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleViewTaskDetail(task)}>
                          <div className="flex items-start justify-between mb-1.5">
                            <div className="min-w-0 flex-1 mr-2">
                              <h4 className="font-medium text-gray-900 text-sm line-clamp-2">{task.name}</h4>
                              {(task.component_path || task.grade_name) && (
                                <div
                                  className="mt-0.5 text-xs text-purple-600 truncate"
                                  title={task.component_path || task.grade_name}
                                >
                                  📚 {task.component_path || task.grade_name}
                                </div>
                              )}
                            </div>
                            <Badge variant={task.priority === 'urgent' ? 'danger' : task.priority === 'high' ? 'warning' : 'default'} size="sm" className="shrink-0">{task.priority}</Badge>
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                            <span className="truncate mr-2">{task.project_name}</span>
                            <span className="text-blue-600 font-medium shrink-0">
                              {days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `${days}d left`}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-12 bg-gray-200 rounded-full h-1.5">
                              <div className="bg-blue-400 h-1.5 rounded-full" style={{ width: `${getTaskDisplayProgress(task)}%` }} />
                            </div>
                            <span className="text-xs text-gray-500">{getTaskDisplayProgress(task)}%</span>
                          </div>
                        </div>
                      );
                    })}
                    {upcomingTasks.length > 5 && (
                      <div className="text-center pt-2">
                        <Button variant="outline" size="sm" onClick={() => setShowAllUpcomingTasks(!showAllUpcomingTasks)}>
                          {showAllUpcomingTasks ? 'Show Less' : `View All (${upcomingTasks.length})`}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>{/* end row 2 — 3 equal columns */}

        {/* ── Row 3: Recent Completions — full width ── */}
        <div ref={sectionRefs.completed} className={`transition-all duration-300 rounded-xl ${activeStatFilter === 'completed' ? 'ring-2 ring-green-400/60 shadow-lg' : ''}`}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Award className="w-5 h-5 text-green-600" />
                <span>Recent Completions ({completedTasks.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {completedTasks.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No completed tasks yet.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {(showAllCompletedTasks ? completedTasks : completedTasks.slice(0, 6)).map((task) => (
                      <div key={task.id} className="p-4 border border-green-200 bg-green-50 rounded-lg hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleViewTaskDetail(task)}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="min-w-0 flex-1 mr-2">
                            <h4 className="font-medium text-gray-900 line-clamp-2">{task.name}</h4>
                            {(task.component_path || task.grade_name) && (
                              <div
                                className="mt-0.5 text-xs text-purple-600 truncate"
                                title={task.component_path || task.grade_name}
                              >
                                📚 {task.component_path || task.grade_name}
                              </div>
                            )}
                          </div>
                          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                        </div>
                        <div className="text-sm text-gray-600 mb-1">{task.project_name}</div>
                        <div className="text-sm text-green-600 font-medium">
                          Completed {task.end_date ? new Date(task.end_date).toLocaleDateString() : 'recently'}
                        </div>
                      </div>
                    ))}
                  </div>
                  {completedTasks.length > 6 && (
                    <div className="text-center pt-4">
                      <Button variant="outline" size="sm" onClick={() => setShowAllCompletedTasks(!showAllCompletedTasks)}>
                        {showAllCompletedTasks ? 'Show Less' : `View All (${completedTasks.length})`}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
      )}

    </div>
  );

  // ── Main render ────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-3">
            {/* Back button - show when not on my-tasks view */}
            {activeView !== 'my-tasks' && (
              <button
                onClick={() => {
                  // Go back to previous view
                  setActiveView(previousView);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2 text-gray-600 hover:text-gray-900"
                title="Back to Previous View"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back</span>
              </button>
            )}
            <div className="p-2 rounded-xl bg-gray-900">
              <Home className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-tight">Team Portal</h1>
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-500">{user.name}</p>
                {accessInfo && (
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                    isProjectManager ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {isProjectManager ? '⭐ Project Manager' : 'Employee'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-400'}`}
              title={isConnected ? 'Connected' : 'Disconnected'} />

            <button onClick={() => setShowNotifications(true)}
              className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Bell className="w-5 h-5 text-gray-600" />
              {notificationCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center font-bold">
                  {notificationCount > 99 ? '99+' : notificationCount}
                </span>
              )}
            </button>

            <button onClick={handleRefresh} disabled={refreshing}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50" title="Refresh">
              <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            <button onClick={onLogout}
              className="p-2 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors" title="Logout">
              <LogOut className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar — only rendered when team member has extra permissions */}
        {hasSidebar && (
          <aside
            className="bg-white border-r border-gray-200 flex flex-col flex-shrink-0 overflow-y-auto transition-all duration-200"
            style={{ width: sidebarCollapsed ? '60px' : '224px' }}
          >
            {/* Collapse toggle */}
            <div className={`flex items-center border-b border-gray-100 h-12 px-3 ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
              {!sidebarCollapsed && (
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">Navigation</p>
              )}
              <button
                onClick={() => {
                  const next = !sidebarCollapsed;
                  setSidebarCollapsed(next);
                  sessionStorage.setItem('team_sidebar_state', next ? 'collapsed' : 'expanded');
                }}
                className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {sidebarCollapsed ? <Menu className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
            </div>

            <div className="p-2 flex-1">
              <nav className="space-y-1">
                {visibleNavItems.map((item) => {
                  const isActive = activeView === item.key;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      onClick={() => changeView(item.key)}
                      title={sidebarCollapsed ? item.label : undefined}
                      className={`w-full flex items-center gap-3 px-2.5 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                        sidebarCollapsed ? 'justify-center' : ''
                      } ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                      {!sidebarCollapsed && (
                        <>
                          <span className="truncate">{item.label}</span>
                          {isActive && <ChevronRight className="w-3 h-3 ml-auto text-blue-400" />}
                        </>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {!sidebarCollapsed && (
              <div className="p-3 border-t border-gray-100">
                <div className="flex items-start gap-2 text-xs text-gray-400">
                  <Lock className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>Access is managed by your admin and may change at any time.</span>
                </div>
              </div>
            )}
          </aside>
        )}

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto">
          {renderActiveView()}
        </main>
      </div>

      {/* Extension Modal */}
      <Modal isOpen={isExtensionModalOpen} onClose={() => setIsExtensionModalOpen(false)} title="Request Task Extension">
        <div className="space-y-6">
          {selectedTask && (
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
              <h4 className="font-semibold text-gray-900">{selectedTask.name}</h4>
              <p className="text-sm text-gray-600 mt-1">
                Current due date: {selectedTask.end_date ? new Date(selectedTask.end_date).toLocaleDateString() : 'No due date'}
              </p>
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">New Due Date <span className="text-red-500">*</span></label>
            <input type="date" value={extensionDate} onChange={e => setExtensionDate(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Reason for Extension</label>
            <textarea value={extensionReason} onChange={e => setExtensionReason(e.target.value)} rows={4}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Please explain why you need an extension..." />
          </div>
          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => setIsExtensionModalOpen(false)}>Cancel</Button>
            <Button onClick={submitExtensionRequest} disabled={!extensionReason.trim() || !extensionDate.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">Submit Request</Button>
          </div>
        </div>
      </Modal>

      {/* Remark Modal */}
      <Modal isOpen={isRemarkModalOpen} onClose={() => setIsRemarkModalOpen(false)} title="Add Task Remark">
        <div className="space-y-6">
          {selectedTask && (
            <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
              <h4 className="font-semibold text-gray-900">{selectedTask.name}</h4>
              <p className="text-sm text-gray-600 mt-1">Add a remark or comment about this task</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Remark Type</label>
            <select value={remarkType} onChange={e => setRemarkType(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent">
              <option value="general">General / In Progress</option>
              <option value="complete">Completed</option>
              <option value="skipped">Skipped</option>
              <option value="other">Other</option>
            </select>
            {remarkType === 'general' && selectedTask?.status === 'not-started' && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800"><strong>Note:</strong> This will mark the task as In Progress and set progress to 50%.</p>
              </div>
            )}
            {remarkType === 'complete' && (
              <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800"><strong>Note:</strong> Selecting "Complete" will submit this task for admin review.</p>
              </div>
            )}
            {remarkType === 'skipped' && (
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800"><strong>Warning:</strong> Selecting "Skipped" will mark this task as skipped and set progress to 0%.</p>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Server Location <span className="text-red-500">*</span></label>
            <input type="text" value={serverLocation} onChange={e => setServerLocation(e.target.value)}
              placeholder='e.g. Y:\Standard ICT\'
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
            <p className="text-xs text-gray-500 mt-1">The exact path of the server where you saved the file</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">File Name <span className="text-red-500">*</span></label>
            <input type="text" value={fileName} onChange={e => setFileName(e.target.value)}
              placeholder="e.g. ICT_G1_U1_L1"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
            <p className="text-xs text-gray-500 mt-1">The exact name of the file you worked on</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Remark Content</label>
            <RichTextEditor value={remarkContent} onChange={setRemarkContent}
              placeholder="Add your remark or comment about this task..." height="150px" />
            <p className={`text-xs mt-1 ${getRemarkPlainTextLength(remarkContent) > REMARK_MAX_PLAIN_LENGTH ? 'text-red-600' : 'text-gray-500'}`}>
              {getRemarkPlainTextLength(remarkContent).toLocaleString()} / {REMARK_MAX_PLAIN_LENGTH.toLocaleString()} characters
            </p>
          </div>
          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => setIsRemarkModalOpen(false)}>Cancel</Button>
            <Button onClick={submitRemark}
              disabled={remarkContent.replace(/<[^>]*>/g, '').trim().length === 0 || isRemarkTooLong(remarkContent) || !serverLocation.trim() || !fileName.trim()}
              className="bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50">Add Remark</Button>
          </div>
        </div>
      </Modal>

      {/* Notifications overlay */}
      {showNotifications && (
        <div className="fixed inset-0 z-50 bg-white overflow-auto">
          <TeamNotifications onBack={() => { setShowNotifications(false); loadNotificationCount(); }} />
        </div>
      )}

      {/* Flag tasks modal */}
      <Modal isOpen={showFlagTasksModal} onClose={handleCloseFlagTasksModal} title={`${selectedFlagType?.toUpperCase()} Flag Tasks`}>
        <div className="space-y-6">
          {selectedFlagType && (
            <>
              <div className={`p-4 rounded-lg border-2 ${
                selectedFlagType === 'green' ? 'bg-green-50 border-green-200' :
                selectedFlagType === 'yellow' ? 'bg-yellow-50 border-yellow-200' :
                selectedFlagType === 'orange' ? 'bg-orange-50 border-orange-200' :
                'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={selectedFlagType === 'red' ? 'danger' : selectedFlagType === 'orange' ? 'warning' : 'default'} size="sm">
                    {selectedFlagType.toUpperCase()}
                  </Badge>
                  <span className="text-sm text-gray-600">{performanceFlags.filter(f => f.type === selectedFlagType).length} flag(s)</span>
                </div>
                <p className="text-gray-800 text-sm">Tasks with {selectedFlagType} performance flags</p>
              </div>

              <div className="space-y-4">
                {performanceFlags.filter(f => f.type === selectedFlagType).map((flag) => (
                  <div key={flag.id} className={`p-4 rounded-lg border ${
                    selectedFlagType === 'green' ? 'bg-green-50 border-green-200' :
                    selectedFlagType === 'yellow' ? 'bg-yellow-50 border-yellow-200' :
                    selectedFlagType === 'orange' ? 'bg-orange-50 border-orange-200' :
                    'bg-red-50 border-red-200'
                  }`}>
                    <div className="text-xs text-gray-500 mb-2">
                      {new Date(flag.created_at).toLocaleDateString()}
                      {flag.added_by && ` · Added by: ${flag.added_by}`}
                    </div>
                    <p className="text-gray-800 mb-3">{flag.reason}</p>
                    {flag.task_name ? (
                      <div className="space-y-1">
                        <p className="text-sm"><span className="font-medium text-gray-700">Task:</span> {flag.task_name}</p>
                        {flag.project_name && <p className="text-sm"><span className="font-medium text-gray-700">Project:</span> {flag.project_name}</p>}
                        <Button size="sm" className="mt-2 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => {
                          const t = userTasks.find(t => t.name === flag.task_name);
                          if (t) { handleViewTaskDetail(t); handleCloseFlagTasksModal(); }
                          else showToast('Task not found in your assigned tasks', 'error');
                        }}>View Task</Button>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">No specific task associated</p>
                    )}
                  </div>
                ))}
                {performanceFlags.filter(f => f.type === selectedFlagType).length === 0 && (
                  <div className="text-center py-8">
                    <Flag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No {selectedFlagType} flags found</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}