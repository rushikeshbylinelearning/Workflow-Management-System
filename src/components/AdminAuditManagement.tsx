import React, { useState, useEffect } from 'react';
import { 
  Trash2, 
  AlertCircle, 
  Clock, 
  User, 
  Flag, 
  Calendar,
  Search,
  Filter,
  CheckSquare,
  Square,
  FileText,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { useToast } from './ui/Toast';
import { adminAuditService } from '../services/apiService';

interface PerformanceFlag {
  id: number;
  team_member_id: number;
  team_member_name: string;
  team_member_email: string;
  task_id?: number;
  task_name?: string;
  project_name?: string;
  type: 'red' | 'orange' | 'yellow' | 'green';
  reason: string;
  added_by_name: string;
  created_at: string;
  created_at_ist: string;
}

interface ExtensionRequest {
  id: number;
  task_id: number;
  task_name: string;
  project_name?: string;
  requested_by_name: string;
  requested_by_type: 'admin' | 'team';
  current_due_date: string;
  requested_due_date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by_name?: string;
  reviewed_at?: string;
  review_notes?: string;
  created_at: string;
  created_at_ist: string;
  reviewed_at_ist?: string;
}

interface FlagAuditLog {
  id: number;
  flag_id: number;
  team_member_name: string;
  task_name?: string;
  flag_type: 'red' | 'orange' | 'yellow' | 'green';
  flag_reason: string;
  original_added_by: string;
  deleted_by_name: string;
  deleted_at_ist: string;
  original_created_at_ist: string;
}

interface ExtensionAuditLog {
  id: number;
  extension_id: number;
  task_name: string;
  project_name?: string;
  requested_by_name: string;
  status: 'pending' | 'approved' | 'rejected';
  deleted_by_name: string;
  deleted_at_ist: string;
}

export function AdminAuditManagement() {
  const [activeTab, setActiveTab] = useState<'flags' | 'extensions'>('flags');
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  
  // Performance Flags State
  const [performanceFlags, setPerformanceFlags] = useState<PerformanceFlag[]>([]);
  const [selectedFlags, setSelectedFlags] = useState<number[]>([]);
  const [flagsLoading, setFlagsLoading] = useState(false);
  const [flagFilter, setFlagFilter] = useState({
    teamMemberId: '',
    taskId: '',
    flagType: ''
  });
  const [flagAuditLogs, setFlagAuditLogs] = useState<FlagAuditLog[]>([]);
  
  // Extension Requests State
  const [extensionRequests, setExtensionRequests] = useState<ExtensionRequest[]>([]);
  const [selectedExtensions, setSelectedExtensions] = useState<number[]>([]);
  const [extensionsLoading, setExtensionsLoading] = useState(false);
  const [extensionFilter, setExtensionFilter] = useState({
    status: '',
    taskId: '',
    projectId: ''
  });
  const [extensionAuditLogs, setExtensionAuditLogs] = useState<ExtensionAuditLog[]>([]);
  
  // Add loading state to prevent double-clicks
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { showToast } = useToast();

  // Load performance flags
  const loadPerformanceFlags = async () => {
    try {
      setFlagsLoading(true);
      const params: any = {};
      if (flagFilter.teamMemberId) params.teamMemberId = flagFilter.teamMemberId;
      if (flagFilter.taskId) params.taskId = flagFilter.taskId;
      if (flagFilter.flagType) params.flagType = flagFilter.flagType;
      
      const response = await adminAuditService.getAllPerformanceFlags(params);
      setPerformanceFlags(response.data || response || []);
    } catch (error: any) {
      console.error('Failed to load performance flags:', error);
      // Don't show error toast if it's just an empty result
      if (error?.message && !error.message.includes('not found')) {
        showToast('Failed to load performance flags', 'error');
      }
      setPerformanceFlags([]);
    } finally {
      setFlagsLoading(false);
    }
  };

  // Load extension requests
  const loadExtensionRequests = async () => {
    try {
      setExtensionsLoading(true);
      const params: any = {};
      if (extensionFilter.status) params.status = extensionFilter.status;
      if (extensionFilter.taskId) params.taskId = extensionFilter.taskId;
      if (extensionFilter.projectId) params.projectId = extensionFilter.projectId;
      
      const response = await adminAuditService.getAllExtensionRequests(params);
      setExtensionRequests(response.data || response || []);
    } catch (error: any) {
      console.error('Failed to load extension requests:', error);
      // Don't show error toast if it's just an empty result
      if (error?.message && !error.message.includes('not found')) {
        showToast('Failed to load extension requests', 'error');
      }
      setExtensionRequests([]);
    } finally {
      setExtensionsLoading(false);
    }
  };

  // Load flag audit logs
  const loadFlagAuditLogs = async () => {
    try {
      const response = await adminAuditService.getFlagAuditLogs();
      setFlagAuditLogs(response.data || response || []);
    } catch (error: any) {
      console.error('Failed to load flag audit logs:', error);
      // Don't show error toast if it's just an empty result
      if (error?.message && !error.message.includes('not found')) {
        showToast('Failed to load flag audit logs', 'error');
      }
      setFlagAuditLogs([]);
    }
  };

  // Load extension audit logs
  const loadExtensionAuditLogs = async () => {
    try {
      const response = await adminAuditService.getExtensionAuditLogs();
      setExtensionAuditLogs(response.data || response || []);
    } catch (error: any) {
      console.error('Failed to load extension audit logs:', error);
      // Don't show error toast if it's just an empty result
      if (error?.message && !error.message.includes('not found')) {
        showToast('Failed to load extension audit logs', 'error');
      }
      setExtensionAuditLogs([]);
    }
  };

  // Load data on component mount and tab change
  useEffect(() => {
    if (activeTab === 'flags') {
      loadPerformanceFlags();
      if (showAuditLogs) loadFlagAuditLogs();
    } else {
      loadExtensionRequests();
      if (showAuditLogs) loadExtensionAuditLogs();
    }
  }, [activeTab, showAuditLogs]);

  // Delete single performance flag
  const deletePerformanceFlag = async (flagId: number) => {
    if (isDeleting) return; // Prevent double-click
    
    if (!confirm('Are you sure you want to delete this performance flag? This action will be logged in the audit trail.')) {
      return;
    }

    try {
      setIsDeleting(true);
      const response = await adminAuditService.deletePerformanceFlag(flagId);
      showToast(`Flag deleted successfully at ${response.audit?.deleted_at_ist || 'now'}`, 'success');
      
      // Use setTimeout to avoid race conditions
      setTimeout(() => {
        loadPerformanceFlags();
        if (showAuditLogs) loadFlagAuditLogs();
        setIsDeleting(false);
      }, 300);
    } catch (error: any) {
      console.error('Failed to delete performance flag:', error);
      const errorMessage = error?.message || 'Failed to delete performance flag';
      showToast(errorMessage, 'error');
      setIsDeleting(false);
    }
  };

  // Bulk delete performance flags
  const bulkDeleteFlags = async () => {
    if (isDeleting) return; // Prevent double-click
    
    if (selectedFlags.length === 0) {
      showToast('Please select flags to delete', 'warning');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedFlags.length} performance flag(s)? This action will be logged in the audit trail.`)) {
      return;
    }

    try {
      setIsDeleting(true);
      const response = await adminAuditService.bulkDeletePerformanceFlags(selectedFlags);
      showToast(response.message || 'Flags deleted successfully', 'success');
      setSelectedFlags([]);
      
      // Use setTimeout to avoid race conditions
      setTimeout(() => {
        loadPerformanceFlags();
        if (showAuditLogs) loadFlagAuditLogs();
        setIsDeleting(false);
      }, 300);
    } catch (error: any) {
      console.error('Failed to bulk delete flags:', error);
      const errorMessage = error?.message || 'Failed to bulk delete flags';
      showToast(errorMessage, 'error');
      setIsDeleting(false);
    }
  };

  // Delete single extension request
  const deleteExtensionRequest = async (extensionId: number) => {
    if (isDeleting) return; // Prevent double-click
    
    if (!confirm('Are you sure you want to delete this extension request? This action will be logged in the audit trail.')) {
      return;
    }

    try {
      setIsDeleting(true);
      const response = await adminAuditService.deleteExtensionRequest(extensionId);
      showToast(`Extension request deleted successfully at ${response.audit?.deleted_at_ist || 'now'}`, 'success');
      
      // Use setTimeout to avoid race conditions
      setTimeout(() => {
        loadExtensionRequests();
        if (showAuditLogs) loadExtensionAuditLogs();
        setIsDeleting(false);
      }, 300);
    } catch (error: any) {
      console.error('Failed to delete extension request:', error);
      const errorMessage = error?.message || 'Failed to delete extension request';
      showToast(errorMessage, 'error');
      setIsDeleting(false);
    }
  };

  // Bulk delete extension requests
  const bulkDeleteExtensions = async () => {
    if (isDeleting) return; // Prevent double-click
    
    if (selectedExtensions.length === 0) {
      showToast('Please select extension requests to delete', 'warning');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedExtensions.length} extension request(s)? This action will be logged in the audit trail.`)) {
      return;
    }

    try {
      setIsDeleting(true);
      const response = await adminAuditService.bulkDeleteExtensionRequests(selectedExtensions);
      showToast(response.message || 'Extension requests deleted successfully', 'success');
      setSelectedExtensions([]);
      
      // Use setTimeout to avoid race conditions
      setTimeout(() => {
        loadExtensionRequests();
        if (showAuditLogs) loadExtensionAuditLogs();
        setIsDeleting(false);
      }, 300);
    } catch (error: any) {
      console.error('Failed to bulk delete extension requests:', error);
      const errorMessage = error?.message || 'Failed to bulk delete extension requests';
      showToast(errorMessage, 'error');
      setIsDeleting(false);
    }
  };

  // Toggle flag selection
  const toggleFlagSelection = (flagId: number) => {
    setSelectedFlags(prev => 
      prev.includes(flagId) 
        ? prev.filter(id => id !== flagId)
        : [...prev, flagId]
    );
  };

  // Toggle extension selection
  const toggleExtensionSelection = (extensionId: number) => {
    setSelectedExtensions(prev => 
      prev.includes(extensionId) 
        ? prev.filter(id => id !== extensionId)
        : [...prev, extensionId]
    );
  };

  // Select all flags
  const selectAllFlags = () => {
    if (selectedFlags.length === performanceFlags.length) {
      setSelectedFlags([]);
    } else {
      setSelectedFlags(performanceFlags.map(flag => flag.id));
    }
  };

  // Select all extensions
  const selectAllExtensions = () => {
    if (selectedExtensions.length === extensionRequests.length) {
      setSelectedExtensions([]);
    } else {
      setSelectedExtensions(extensionRequests.map(ext => ext.id));
    }
  };

  // Get flag color
  const getFlagColor = (type: string) => {
    switch (type) {
      case 'red': return 'bg-red-100 text-red-800 border-red-300';
      case 'orange': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'yellow': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'green': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Admin Audit Management</h3>
          <p className="text-sm text-gray-600 mt-1">
            Manage and revert performance flags and extension requests with complete audit trailing
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant={showAuditLogs ? 'primary' : 'secondary'}
            size="sm"
            icon={<FileText className="w-4 h-4" />}
            onClick={() => setShowAuditLogs(!showAuditLogs)}
          >
            {showAuditLogs ? 'Hide' : 'Show'} Audit Logs
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
        <Button
          variant={activeTab === 'flags' ? 'primary' : 'ghost'}
          size="sm"
          icon={<Flag className="w-4 h-4" />}
          onClick={() => {
            setActiveTab('flags');
            setSelectedFlags([]);
          }}
        >
          Performance Flags
        </Button>
        <Button
          variant={activeTab === 'extensions' ? 'primary' : 'ghost'}
          size="sm"
          icon={<Clock className="w-4 h-4" />}
          onClick={() => {
            setActiveTab('extensions');
            setSelectedExtensions([]);
          }}
        >
          Extension Requests
        </Button>
      </div>

      {/* Performance Flags Tab */}
      {activeTab === 'flags' && (
        <div className="space-y-4">
          {/* Filters and Actions */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Filter className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Filters</span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<RefreshCw className="w-4 h-4" />}
                  onClick={loadPerformanceFlags}
                >
                  Refresh
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <input
                  type="text"
                  placeholder="Team Member ID"
                  value={flagFilter.teamMemberId}
                  onChange={(e) => setFlagFilter({ ...flagFilter, teamMemberId: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  placeholder="Task ID"
                  value={flagFilter.taskId}
                  onChange={(e) => setFlagFilter({ ...flagFilter, taskId: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <select
                  value={flagFilter.flagType}
                  onChange={(e) => setFlagFilter({ ...flagFilter, flagType: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">All Flag Types</option>
                  <option value="red">Red Flag</option>
                  <option value="orange">Orange Flag</option>
                  <option value="yellow">Yellow Flag</option>
                  <option value="green">Green Flag</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Search className="w-4 h-4" />}
                  onClick={loadPerformanceFlags}
                >
                  Apply Filters
                </Button>
                {selectedFlags.length > 0 && (
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Trash2 className="w-4 h-4" />}
                    onClick={bulkDeleteFlags}
                  >
                    Delete Selected ({selectedFlags.length})
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Performance Flags List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Performance Flags ({performanceFlags.length})</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={selectedFlags.length === performanceFlags.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  onClick={selectAllFlags}
                  disabled={performanceFlags.length === 0}
                >
                  Select All
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {flagsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : performanceFlags.length === 0 ? (
                <div className="text-center py-12">
                  <Flag className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-600">No performance flags found</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {performanceFlags.map((flag) => (
                    <div key={flag.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          <input
                            type="checkbox"
                            checked={selectedFlags.includes(flag.id)}
                            onChange={() => toggleFlagSelection(flag.id)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <Badge className={getFlagColor(flag.type)}>
                                {flag.type.toUpperCase()} FLAG
                              </Badge>
                              {flag.task_name && (
                                <span className="text-sm text-gray-600">
                                  Task: {flag.task_name}
                                </span>
                              )}
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2 text-sm">
                                <User className="w-4 h-4 text-gray-400" />
                                <span className="font-medium">{flag.team_member_name}</span>
                                <span className="text-gray-500">({flag.team_member_email})</span>
                              </div>
                              <p className="text-sm text-gray-700">{flag.reason}</p>
                              <div className="flex items-center space-x-4 text-xs text-gray-500">
                                <span>Added by: {flag.added_by_name}</span>
                                <span>•</span>
                                <span>Created: {flag.created_at_ist}</span>
                                {flag.project_name && (
                                  <>
                                    <span>•</span>
                                    <span>Project: {flag.project_name}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 className="w-4 h-4 text-red-600" />}
                          onClick={() => deletePerformanceFlag(flag.id)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Flag Audit Logs */}
          {showAuditLogs && (
            <Card>
              <CardHeader>
                <CardTitle>Flag Deletion Audit Trail ({flagAuditLogs.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {flagAuditLogs.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-600">No flag deletion audit logs found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {flagAuditLogs.map((log) => (
                      <div key={log.id} className="p-4 hover:bg-gray-50">
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Badge className={getFlagColor(log.flag_type)}>
                              {log.flag_type.toUpperCase()}
                            </Badge>
                            <span className="text-sm font-medium">{log.team_member_name}</span>
                            {log.task_name && (
                              <span className="text-sm text-gray-600">- {log.task_name}</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-700">{log.flag_reason}</p>
                          <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
                            <div>
                              <span className="font-medium">Originally added by:</span> {log.original_added_by}
                            </div>
                            <div>
                              <span className="font-medium">Original date:</span> {log.original_created_at_ist}
                            </div>
                            <div className="text-red-600 font-medium">
                              <span>Deleted by:</span> {log.deleted_by_name}
                            </div>
                            <div className="text-red-600 font-medium">
                              <span>Deleted at (IST):</span> {log.deleted_at_ist}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Extension Requests Tab */}
      {activeTab === 'extensions' && (
        <div className="space-y-4">
          {/* Filters and Actions */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Filter className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Filters</span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<RefreshCw className="w-4 h-4" />}
                  onClick={loadExtensionRequests}
                >
                  Refresh
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <select
                  value={extensionFilter.status}
                  onChange={(e) => setExtensionFilter({ ...extensionFilter, status: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <input
                  type="text"
                  placeholder="Task ID"
                  value={extensionFilter.taskId}
                  onChange={(e) => setExtensionFilter({ ...extensionFilter, taskId: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  placeholder="Project ID"
                  value={extensionFilter.projectId}
                  onChange={(e) => setExtensionFilter({ ...extensionFilter, projectId: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-center justify-between">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Search className="w-4 h-4" />}
                  onClick={loadExtensionRequests}
                >
                  Apply Filters
                </Button>
                {selectedExtensions.length > 0 && (
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Trash2 className="w-4 h-4" />}
                    onClick={bulkDeleteExtensions}
                  >
                    Delete Selected ({selectedExtensions.length})
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Extension Requests List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Extension Requests ({extensionRequests.length})</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={selectedExtensions.length === extensionRequests.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  onClick={selectAllExtensions}
                  disabled={extensionRequests.length === 0}
                >
                  Select All
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {extensionsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : extensionRequests.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-600">No extension requests found</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {extensionRequests.map((request) => (
                    <div key={request.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          <input
                            type="checkbox"
                            checked={selectedExtensions.includes(request.id)}
                            onChange={() => toggleExtensionSelection(request.id)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <Badge className={getStatusColor(request.status)}>
                                {request.status.toUpperCase()}
                              </Badge>
                              <span className="text-sm font-medium">{request.task_name}</span>
                              {request.project_name && (
                                <span className="text-sm text-gray-600">({request.project_name})</span>
                              )}
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm text-gray-700">{request.reason}</p>
                              <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
                                <div>
                                  <span className="font-medium">Requested by:</span> {request.requested_by_name} ({request.requested_by_type})
                                </div>
                                <div>
                                  <span className="font-medium">Requested at:</span> {request.created_at_ist}
                                </div>
                                <div>
                                  <span className="font-medium">Current due:</span> {new Date(request.current_due_date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                                </div>
                                <div>
                                  <span className="font-medium">Requested due:</span> {new Date(request.requested_due_date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                                </div>
                                {request.reviewed_by_name && (
                                  <>
                                    <div>
                                      <span className="font-medium">Reviewed by:</span> {request.reviewed_by_name}
                                    </div>
                                    <div>
                                      <span className="font-medium">Reviewed at:</span> {request.reviewed_at_ist}
                                    </div>
                                  </>
                                )}
                              </div>
                              {request.review_notes && (
                                <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                                  <span className="font-medium">Review notes:</span> {request.review_notes}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 className="w-4 h-4 text-red-600" />}
                          onClick={() => deleteExtensionRequest(request.id)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Extension Audit Logs */}
          {showAuditLogs && (
            <Card>
              <CardHeader>
                <CardTitle>Extension Request Deletion Audit Trail ({extensionAuditLogs.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {extensionAuditLogs.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-600">No extension deletion audit logs found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {extensionAuditLogs.map((log) => (
                      <div key={log.id} className="p-4 hover:bg-gray-50">
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Badge className={getStatusColor(log.status)}>
                              {log.status.toUpperCase()}
                            </Badge>
                            <span className="text-sm font-medium">{log.task_name}</span>
                            {log.project_name && (
                              <span className="text-sm text-gray-600">({log.project_name})</span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
                            <div>
                              <span className="font-medium">Requested by:</span> {log.requested_by_name}
                            </div>
                            <div className="text-red-600 font-medium">
                              <span>Deleted by:</span> {log.deleted_by_name}
                            </div>
                            <div className="text-red-600 font-medium col-span-2">
                              <span>Deleted at (IST):</span> {log.deleted_at_ist}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
