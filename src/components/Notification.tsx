import { useState, useEffect, useMemo } from 'react';
import { 
  Bell, 
  Clock, 
  MessageSquare, 
  Calendar, 
  User, 
  FileText, 
  AlertTriangle,
  Eye,
  RefreshCw,
  CheckCircle,
  Copy,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  XCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { RichTextDisplay } from './ui/RichTextEditor';
import { useToast } from './ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { notificationService as apiNotificationService, taskService } from '../services/apiService';
import notificationService from '../services/notificationService';

interface Notification {
  id: number;
  type: 'extension_request' | 'remark';
  task_id: number;
  task_name: string;
  project_name: string;
  created_at: string;
  is_new: boolean;
}

interface ExtensionRequest extends Notification {
  type: 'extension_request';
  requester_name: string;
  requester_type: 'admin' | 'team';
  current_due_date: string;
  requested_due_date: string;
  reason: string;
  status: string;
  review_notes?: string;
  reviewed_at?: string;
  reviewer_name?: string;
}

interface TaskRemark extends Notification {
  type: 'remark';
  user_name: string;
  user_type: 'admin' | 'team';
  remark: string;
  remark_type: string;
  is_private: boolean;
  task_status: string;
  server_location?: string;
  file_name?: string;
}

interface NotificationsData {
  extensions: ExtensionRequest[];
  remarks: TaskRemark[];
}

export function Notification() {
  const { user } = useAuth();
  const { dispatch } = useApp();
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<NotificationsData>({ extensions: [], remarks: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [filterType, setFilterType] = useState<'all' | 'new'>(() => {
    // Persist user's selection; default to 'all' for first-time users
    const stored = typeof window !== 'undefined' ? window.sessionStorage.getItem('notification_filter_type') : null;
    return (stored === 'new' || stored === 'all') ? (stored as 'all' | 'new') : 'all';
  });
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterUser, setFilterUser] = useState<string>('');
  const [viewedTasks, setViewedTasks] = useState<Set<number>>(new Set());
  
  // Collapsible sections state
  const [isExtensionsCollapsed, setIsExtensionsCollapsed] = useState(false);
  const [isRemarksCollapsed, setIsRemarksCollapsed] = useState(false);
  
  // Extension review modal state
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);
  const [selectedExtension, setSelectedExtension] = useState<ExtensionRequest | null>(null);
  const [extensionAction, setExtensionAction] = useState<'approved' | 'rejected'>('approved');
  const [extensionNotes, setExtensionNotes] = useState('');
  const [approvedDate, setApprovedDate] = useState('');
  
  // Remark sorting and filtering state
  const [remarkSortBy, setRemarkSortBy] = useState<'type' | 'date'>('type');
  const [remarkFilterType, setRemarkFilterType] = useState<string>('all');

  // Keep filterType in sessionStorage so user's choice persists until changed
  useEffect(() => {
    try {
      window.sessionStorage.setItem('notification_filter_type', filterType);
    } catch {}
  }, [filterType]);

  // Build a unique list of users from notifications to drive the User filter dropdown
  const uniqueUsers = useMemo(() => {
    const set = new Set<string>();
    notifications.extensions.forEach(ext => {
      if (ext.requester_name) set.add(ext.requester_name);
    });
    notifications.remarks.forEach(r => {
      if (r.user_name) set.add(r.user_name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [notifications.extensions, notifications.remarks]);

  // Check if user is admin; team users authenticate via teamToken
  const isTeamSession = typeof window !== 'undefined' && !!window.sessionStorage.getItem('teamToken');
  const isAdmin = !isTeamSession && user?.id !== undefined;

  useEffect(() => {
    if (isAdmin) {
      loadNotifications();
    } else if (isTeamSession) {
      loadTeamNotifications();
    }
  }, [isAdmin, isTeamSession]);

  // Real-time notification listening
  useEffect(() => {
    const unsubscribe = notificationService.onNotification((realTimeNotification) => {
      
      // Reload notifications to get the latest data
      if (isAdmin) {
        loadNotifications();
      } else if (isTeamSession) {
        loadTeamNotifications();
      }
    });

    return unsubscribe;
  }, [isAdmin, isTeamSession]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiNotificationService.getAll();
      setNotifications(response.data);
    } catch (err: any) {
      console.error('Failed to load notifications:', err);
      setError(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const loadTeamNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use the new team notifications endpoint
      const response = await apiNotificationService.getTeamNotifications();
      setNotifications(response.data);
    } catch (err: any) {
      console.error('Failed to load team notifications:', err);
      setError(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleViewTask = (taskId: number) => {
    
    // Mark this task as viewed
    setViewedTasks(prev => {
      const newSet = new Set([...prev, taskId]);
      return newSet;
    });
    
    // Set the previous view to notifications before navigating to task details
    dispatch({ type: 'SET_PREVIOUS_VIEW', payload: 'notifications' });
    // Navigate directly to the specific task details
    dispatch({ type: 'SET_SELECTED_TASK', payload: taskId.toString() });
  };

  const handleApproveTask = async (taskId: number) => {
    try {
      await taskService.reviewTask(taskId, 'approve');
      
      // Show success toast
      const taskName = filteredNotifications.remarks.find(r => r.task_id === taskId)?.task_name || 'Task';
      showToast(`✅ Task "${taskName}" has been approved and marked as completed!`, 'success');
      
      // Reload notifications to reflect the change
      if (isAdmin) {
        loadNotifications();
      }
    } catch (error: any) {
      console.error('Failed to approve task:', error);
      showToast('❌ Failed to approve task. Please try again.', 'error');
    }
  };

  const handleDenyTask = async (taskId: number) => {
    try {
      await taskService.reviewTask(taskId, 'deny');
      
      // Show success toast
      const taskName = filteredNotifications.remarks.find(r => r.task_id === taskId)?.task_name || 'Task';
      showToast(`❌ Task "${taskName}" has been denied and marked as in-progress!`, 'success');
      
      // Reload notifications to reflect the change
      if (isAdmin) {
        loadNotifications();
      }
    } catch (error: any) {
      console.error('Failed to deny task:', error);
      showToast('❌ Failed to deny task. Please try again.', 'error');
    }
  };

  const copyServerLocation = async (serverLocation: string) => {
    try {
      await navigator.clipboard.writeText(serverLocation);
      showToast('Server location copied to clipboard!', 'success');
    } catch (error) {
      console.error('Failed to copy server location:', error);
      showToast('❌ Failed to copy server location', 'error');
    }
  };

  const openExtensionModal = (extension: ExtensionRequest, action: 'approved' | 'rejected') => {
    setSelectedExtension(extension);
    setExtensionAction(action);
    setExtensionNotes('');
    // Set the approved date to the user's requested date by default
    if (action === 'approved' && extension.requested_due_date) {
      // Ensure the date is in YYYY-MM-DD format for HTML date input
      const date = new Date(extension.requested_due_date);
      const formattedDate = date.toISOString().split('T')[0];
      setApprovedDate(formattedDate);
    } else {
      setApprovedDate('');
    }
    setIsExtensionModalOpen(true);
  };

  const handleExtensionReview = async () => {
    if (!selectedExtension) return;

    try {
      const reviewData: any = {
        status: extensionAction,
        review_notes: extensionNotes
      };

      // For approved extensions, include the approved date
      if (extensionAction === 'approved' && approvedDate) {
        reviewData.approved_due_date = approvedDate;
      }

      await taskService.reviewExtension(selectedExtension.id, reviewData);
      
      // Show success toast
      const actionText = extensionAction === 'approved' ? 'approved' : 'rejected';
      showToast(`✅ Extension request for "${selectedExtension.task_name}" has been ${actionText}!`, 'success');
      
      // Close modal and reload notifications
      setIsExtensionModalOpen(false);
      setSelectedExtension(null);
      setExtensionNotes('');
      setApprovedDate('');
      
      if (isAdmin) {
        loadNotifications();
      }
    } catch (error: any) {
      console.error('Failed to review extension:', error);
      showToast('❌ Failed to review extension request. Please try again.', 'error');
    }
  };

  // Note: previously used a session-based "unviewed" check; now replaced by time-based filter

  // Filter notifications based on current filters
  const getFilteredNotifications = () => {
    let filteredExtensions = notifications.extensions;
    let filteredRemarks = notifications.remarks;

    // Note: Completion remark filtering is now handled in the backend
    // The backend only returns the latest completion remark per user per task

    // Filter by type (New = last 24 hours)
    if (filterType === 'new') {
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - 24);
      filteredExtensions = filteredExtensions.filter(ext => new Date(ext.created_at) >= cutoff);
      filteredRemarks = filteredRemarks.filter(remark => new Date(remark.created_at) >= cutoff);
    }

    // Filter by date
    if (filterDate) {
      const filterDateObj = new Date(filterDate);
      filterDateObj.setHours(0, 0, 0, 0);
      
      filteredExtensions = filteredExtensions.filter(ext => {
        const extDate = new Date(ext.created_at);
        extDate.setHours(0, 0, 0, 0);
        return extDate.getTime() === filterDateObj.getTime();
      });
      
      filteredRemarks = filteredRemarks.filter(remark => {
        const remarkDate = new Date(remark.created_at);
        remarkDate.setHours(0, 0, 0, 0);
        return remarkDate.getTime() === filterDateObj.getTime();
      });
    }

    // Filter by user
    if (filterUser) {
      filteredExtensions = filteredExtensions.filter(ext => 
        ext.requester_name?.toLowerCase().includes(filterUser.toLowerCase())
      );
      filteredRemarks = filteredRemarks.filter(remark => 
        remark.user_name?.toLowerCase().includes(filterUser.toLowerCase())
      );
    }

    // Filter remarks by type
    if (remarkFilterType !== 'all') {
      filteredRemarks = filteredRemarks.filter(remark => 
        remark.remark_type === remarkFilterType
      );
    }

    // Sort remarks by type or date
    if (remarkSortBy === 'type') {
      // Define sort order for remark types
      const typeOrder = { 'complete': 1, 'skipped': 2, 'general': 3, 'other': 4 };
      filteredRemarks = filteredRemarks.sort((a, b) => {
        const aOrder = typeOrder[a.remark_type as keyof typeof typeOrder] || 5;
        const bOrder = typeOrder[b.remark_type as keyof typeof typeOrder] || 5;
        return aOrder - bOrder;
      });
    } else {
      // Sort by date (newest first)
      filteredRemarks = filteredRemarks.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    return { extensions: filteredExtensions, remarks: filteredRemarks };
  };

  const filteredNotifications = getFilteredNotifications();
  
  // Calculate total notifications for display
  const totalNotifications = filteredNotifications.extensions.length + 
    filteredNotifications.remarks.length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'extension_request':
        return <Clock className="w-5 h-5 text-orange-500" />;
      case 'remark':
        return <MessageSquare className="w-5 h-5 text-blue-500" />;
      case 'task_under_review':
        return <Clock className="w-5 h-5 text-blue-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const getNotificationColor = (type: string, remarkType?: string) => {
    switch (type) {
      case 'extension_request':
        return 'border-orange-200 bg-orange-50';
      case 'remark':
        // Special handling for different remark types
        if (remarkType === 'complete') {
          return 'border-green-200 bg-green-50';
        } else if (remarkType === 'skipped') {
          return 'border-red-200 bg-red-50';
        } else if (remarkType === 'general') {
          return 'border-blue-200 bg-blue-50';
        } else if (remarkType === 'other') {
          return 'border-purple-200 bg-purple-50';
        }
        return 'border-blue-200 bg-blue-50';
      case 'task_under_review':
        return 'border-blue-200 bg-blue-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'approved':
        return <Badge variant="success">Approved</Badge>;
      case 'rejected':
        return <Badge variant="danger">Rejected</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const getRemarkTypeBadge = (type: string) => {
    switch (type) {
      case 'progress':
        return <Badge variant="success">Progress</Badge>;
      case 'issue':
        return <Badge variant="danger">Issue</Badge>;
      case 'update':
        return <Badge variant="primary">Update</Badge>;
      case 'complete':
        return <Badge variant="success">Complete</Badge>;
      case 'skipped':
        return <Badge variant="danger">Skipped</Badge>;
      case 'general':
        return <Badge variant="default">General</Badge>;
      case 'other':
        return <Badge variant="secondary">Other</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    
    // Parse the date string - it's already in UTC format
    const date = new Date(dateString);
    
    // Use UTC time for comparison to avoid timezone issues
    const now = new Date();
    const nowUTC = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
    
    const diffInMs = nowUTC.getTime() - date.getTime();
    
    // Handle negative differences (future dates)
    if (diffInMs < 0) {
      return 'Just now';
    }
    
    const diffInSeconds = Math.floor(diffInMs / 1000);
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
    } else if (diffInDays < 7) {
      return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Render unified notifications UI for both admin and team sessions

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading notifications...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Notifications</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={loadNotifications}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }


  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 text-white p-6 shadow-lg">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-14 -left-12 w-56 h-56 bg-white/10 rounded-full blur-2xl" />
        <div className="relative z-10 flex items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-white/70">
              {totalNotifications} New Activit{totalNotifications !== 1 ? 'ies' : 'y'}
            </p>
          </div>
          <Button onClick={loadNotifications} variant="dark">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Filter by Type */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Type:</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as 'all' | 'new')}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Notifications</option>
                <option value="new">New (Last 24 hours)</option>
              </select>
            </div>

            {/* Filter by Date */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Date:</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {filterDate && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilterDate('')}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Clear
                </Button>
              )}
            </div>

            {/* Filter by User (Dropdown) */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">User:</label>
              <select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[200px]"
              >
                <option value="">All Users</option>
                {uniqueUsers.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
              {filterUser && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilterUser('')}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Clear
                </Button>
              )}
            </div>

            {/* Clear All Filters */}
            {(filterType !== 'all' || filterDate || filterUser) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFilterType('all');
                  setFilterDate('');
                  setFilterUser('');
                }}
                className="text-gray-600 hover:text-gray-800"
              >
                Clear All Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Extension Requests */}
      {filteredNotifications.extensions.length > 0 && (
        <Card>
          <CardHeader>
            <div 
              className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-2 -m-2 rounded-md transition-colors"
              onClick={() => setIsExtensionsCollapsed(!isExtensionsCollapsed)}
            >
              <CardTitle className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-orange-500" />
                <span>Extension Requests ({filteredNotifications.extensions.length})</span>
              </CardTitle>
              {isExtensionsCollapsed ? (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronUp className="w-5 h-5 text-gray-500" />
              )}
            </div>
          </CardHeader>
          {!isExtensionsCollapsed && (
            <CardContent>
            <div className="space-y-4">
              {filteredNotifications.extensions.map((extension) => (
                <div 
                  key={extension.id} 
                  className={`p-5 border rounded-xl ${getNotificationColor(extension.type)} shadow-sm hover:shadow-md transition-shadow duration-200`}
                >
                  {/* Header with Task Name and Status Badge */}
                  <div className="flex items-center space-x-3 mb-4">
                    {getNotificationIcon(extension.type)}
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      Extension Request for "{extension.task_name}"
                    </h3>
                    {getStatusBadge(extension.status)}
                  </div>
                  
                  {/* Metadata Grid - Top Section */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 p-3 bg-white/50 rounded-lg border border-white/20">
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Requested by</p>
                        <p className="text-sm font-medium text-gray-900">{extension.requester_name || 'Unknown User'}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Project</p>
                        <p className="text-sm font-medium text-gray-900">{extension.project_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Current Due</p>
                        <p className="text-sm font-medium text-gray-900">{new Date(extension.current_due_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Requested</p>
                        <p className="text-sm font-medium text-gray-900">{formatTimeAgo(extension.created_at)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Requested Due Date - New Section */}
                  <div className="mb-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-orange-600 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-orange-600 uppercase tracking-wide font-medium">Requested Due Date</p>
                        <p className="text-sm font-medium text-gray-900">{new Date(extension.requested_due_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Reason Content - Middle Section */}
                  <div className="bg-white/30 rounded-lg p-4 border border-white/20 mb-4">
                    <div className="text-sm text-gray-800">
                      <span className="font-semibold text-gray-700 mb-2 block">Reason:</span>
                      <p className="text-gray-700">{extension.reason}</p>
                    </div>
                  </div>

                  {/* Admin Review Information */}
                  {extension.status !== 'pending' && extension.reviewer_name && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-sm font-medium text-gray-900">
                          Admin Review by {extension.reviewer_name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {extension.reviewed_at && new Date(extension.reviewed_at).toLocaleDateString()}
                        </span>
                      </div>
                      {extension.review_notes && (
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Notes:</span> {extension.review_notes}
                        </p>
                      )}
                    </div>
                  )}
                  
                  {/* Action Buttons - Bottom Section */}
                  <div className="flex items-center justify-between">
                    {/* View Task Details Button - Left Side */}
                    <Button 
                      size="sm" 
                      onClick={() => handleViewTask(extension.task_id)}
                      className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
                    >
                      <Eye className="w-4 h-4" />
                      <span>View Details</span>
                    </Button>
                    
                    {/* Approve/Deny buttons for pending extensions - Right Side */}
                    {extension.status === 'pending' && (
                      <div className="flex space-x-3">
                        <Button 
                          size="sm" 
                          onClick={() => openExtensionModal(extension, 'approved')}
                          className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>Approve</span>
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => openExtensionModal(extension, 'rejected')}
                          className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
                        >
                          <AlertTriangle className="w-4 h-4" />
                          <span>Deny</span>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Task Remarks */}
      {filteredNotifications.remarks.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div 
                className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 -m-2 rounded-md transition-colors flex-1"
                onClick={() => setIsRemarksCollapsed(!isRemarksCollapsed)}
              >
                <CardTitle className="flex items-center space-x-2">
                  <MessageSquare className="w-5 h-5 text-blue-500" />
                  <span>Recent Remarks ({filteredNotifications.remarks.length})</span>
                </CardTitle>
                {isRemarksCollapsed ? (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                )}
              </div>
              
              {/* Filter and Sort dropdowns - only show when not collapsed */}
              {!isRemarksCollapsed && (
                <div className="flex items-center space-x-4 ml-4">
                  {/* Filter dropdown */}
                  <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium text-gray-700">Filter:</label>
                    <select
                      value={remarkFilterType}
                      onChange={(e) => setRemarkFilterType(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all">All Types</option>
                      <option value="complete">Completed</option>
                      <option value="skipped">Skipped</option>
                      <option value="general">General</option>
                      <option value="other">Other</option>
                    </select>
                    {remarkFilterType !== 'all' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRemarkFilterType('all')}
                        className="text-gray-500 hover:text-gray-700 p-1 h-6 w-6"
                        title="Clear filter"
                      >
                        ×
                      </Button>
                    )}
                  </div>
                  
                  {/* Sort dropdown */}
                  <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium text-gray-700">Sort by:</label>
                    <select
                      value={remarkSortBy}
                      onChange={(e) => setRemarkSortBy(e.target.value as 'date' | 'type')}
                      className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="date">Date</option>
                      <option value="type">Type</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          {!isRemarksCollapsed && (
            <CardContent>
            <div className="space-y-4">
              {filteredNotifications.remarks.map((remark) => (
                <div 
                  key={remark.id} 
                  className={`p-5 border rounded-xl ${getNotificationColor(remark.type, remark.remark_type)} shadow-sm hover:shadow-md transition-shadow duration-200`}
                >
                  {/* Header with Task Name and Badge */}
                  <div className="flex items-center space-x-3 mb-4">
                    {getNotificationIcon(remark.type)}
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      Remark on "{remark.task_name}"
                    </h3>
                    {getRemarkTypeBadge(remark.remark_type)}
                  </div>
                  
                  {/* Metadata Grid - Top Section */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 p-3 bg-white/50 rounded-lg border border-white/20">
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Added by</p>
                        <p className="text-sm font-medium text-gray-900">{remark.user_name || 'Unknown User'}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Project</p>
                        <p className="text-sm font-medium text-gray-900">{remark.project_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Date</p>
                        <p className="text-sm font-medium text-gray-900">{new Date(remark.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Added</p>
                        <p className="text-sm font-medium text-gray-900">{formatTimeAgo(remark.created_at)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Server Location and File Name - New Section */}
                  {(remark.server_location || remark.file_name) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      {remark.server_location && (
                        <div className="flex items-center space-x-2">
                          <FolderOpen className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs text-blue-600 uppercase tracking-wide font-medium">Server Location</p>
                            <div className="flex items-center space-x-2">
                              <p className="text-sm font-medium text-gray-900 truncate">{remark.server_location}</p>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyServerLocation(remark.server_location!)}
                                className="p-2 h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-100 border border-blue-200 rounded-md"
                                title="Copy server location"
                              >
                                <Copy className="w-8 h-8" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                      {remark.file_name && (
                        <div className="flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-blue-600 uppercase tracking-wide font-medium">File Name</p>
                            <p className="text-sm font-medium text-gray-900">{remark.file_name}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Remark Content - Middle Section */}
                  <div className="bg-white/30 rounded-lg p-4 border border-white/20 mb-4">
                    <div className="text-sm text-gray-800">
                      <span className="font-semibold text-gray-700 mb-2 block">Remark:</span>
                      <div className="prose prose-sm max-w-none">
                        <RichTextDisplay content={remark.remark} />
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Buttons - Bottom Section */}
                  <div className="flex items-center justify-between">
                    {/* View Task Details Button - Left Side */}
                    <Button 
                      size="sm" 
                      onClick={() => handleViewTask(remark.task_id)}
                      className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
                    >
                      <Eye className="w-4 h-4" />
                      <span>View Details</span>
                    </Button>
                    
                    {/* Approve/Deny buttons for completed remarks on under-review tasks - Right Side */}
                    {remark.remark_type === 'complete' && remark.task_status === 'under-review' && (
                      <div className="flex space-x-3">
                        <Button 
                          size="sm" 
                          onClick={() => handleApproveTask(remark.task_id)}
                          className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>Approve</span>
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => handleDenyTask(remark.task_id)}
                          className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
                        >
                          <AlertTriangle className="w-4 h-4" />
                          <span>Deny</span>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            </CardContent>
          )}
        </Card>
      )}


      {/* No Notifications */}
      {totalNotifications === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No New Notifications</h3>
            <p className="text-gray-600">
              You're all caught up! No new extension requests or remarks.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Extension Review Modal */}
      {isExtensionModalOpen && selectedExtension && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {extensionAction === 'approved' ? 'Approve' : 'Reject'} Extension Request
                </h2>
                <button
                  onClick={() => setIsExtensionModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              {/* Extension Details */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Extension Details</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Requested by:</span> {selectedExtension.requester_name}</p>
                  <p><span className="font-medium">Reason:</span> {selectedExtension.reason}</p>
                  <p><span className="font-medium">Current due date:</span> {new Date(selectedExtension.current_due_date).toLocaleDateString()}</p>
                  <p><span className="font-medium">Requested due date:</span> {new Date(selectedExtension.requested_due_date).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Approve Until Date (only for approval) */}
              {extensionAction === 'approved' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Approve Until Date
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Default: User requested until {selectedExtension.requested_due_date ? new Date(selectedExtension.requested_due_date).toLocaleDateString() : 'N/A'}
                  </p>
                  <input
                    type="date"
                    value={approvedDate}
                    onChange={(e) => setApprovedDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min={selectedExtension.current_due_date}
                    placeholder="Select date"
                  />
                </div>
              )}

              {/* Review Notes */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Review Notes
                </label>
                <textarea
                  value={extensionNotes}
                  onChange={(e) => setExtensionNotes(e.target.value)}
                  placeholder={extensionAction === 'approved' ? 'Add notes for approval...' : 'Add notes for rejection...'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-24 resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3">
                <Button
                  onClick={() => setIsExtensionModalOpen(false)}
                  variant="outline"
                  className="px-4 py-2"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleExtensionReview}
                  className={`px-4 py-2 ${
                    extensionAction === 'approved' 
                      ? 'bg-green-600 hover:bg-green-700 text-white' 
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  {extensionAction === 'approved' ? 'Approve Extension' : 'Reject Extension'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}