import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Clock,
  AlertTriangle,
  Calendar,
  Target,
  Activity,
  MessageSquare,
  Award,
  BarChart3,
  Copy,
  FolderOpen,
  Users,
  Flag,
  CheckSquare,
  XCircle
} from 'lucide-react';
import { FlagEmployeeModal } from './modals/FlagEmployeeModal';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { RichTextEditor, RichTextDisplay } from './ui/RichTextEditor';
import { useToast } from './ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { taskService } from '../services/apiService';
import { copyTextToClipboard } from '../utils/clipboard';
import { requestProjectTasksRefresh, requestTasksListRefresh, TASKS_LIST_REFRESH_EVENT } from '../utils/taskManagerCache';
import { TaskRemarksTimeline, type RemarkTimelineEntry } from './TaskRemarksTimeline';
import { ResubmissionDeadlinePicker } from './ResubmissionDeadlinePicker';
import {
  RESUBMISSION_DEADLINE_ENABLED,
  formatResubmissionDisplay,
  getDefaultResubmissionDate,
  validateResubmissionDeadline,
} from '../utils/resubmissionDeadline';

import type { Task } from '../types';
import { getTaskDisplayProgress } from '../utils/taskProgressDisplay';
import { getTaskStatusBadgeVariant, getTaskStatusLabel } from '../utils/taskStatusDisplay';
import {
  getRemarkLengthMessage,
  getRemarkPlainTextLength,
  isRemarkTooLong,
  REMARK_MAX_PLAIN_LENGTH,
} from '../utils/remarkLimits';

const remarkHistoryFetcher = {
  getRemarksHistory: taskService.getRemarksHistory.bind(taskService),
};

function buildOptimisticTimelineEntry(
  partial: Omit<RemarkTimelineEntry, 'id' | 'timestamp'> & { id?: string }
): RemarkTimelineEntry {
  return {
    id: partial.id ?? `optimistic-${Date.now()}`,
    timestamp: new Date().toISOString(),
    user: partial.user,
    role: partial.role,
    action: partial.action,
    action_type: partial.action_type,
    remark: partial.remark,
  };
}

interface TeamTaskDetailProps {
  task?: Task;
  taskId?: string | number;
  onBack: () => void;
  onTaskUpdate?: () => void;
  /** Render inside a modal/panel without full-page chrome */
  embedded?: boolean;
  onTaskMeta?: (meta: { name: string; status: string; priority: string }) => void;
}

export function TeamTaskDetail({ task: taskProp, taskId, onBack, onTaskUpdate, embedded = false, onTaskMeta }: TeamTaskDetailProps) {
  const { showToast } = useToast();
  const { user: adminUser } = useAuth();
  const [localTask, setLocalTask] = useState<Task | null>(taskProp ?? null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);
  const [isRemarkModalOpen, setIsRemarkModalOpen] = useState(false);

  const [extensionReason, setExtensionReason] = useState('');
  const [extensionDate, setExtensionDate] = useState('');
  const [remarkContent, setRemarkContent] = useState('');
  const [remarkDate, setRemarkDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarkType, setRemarkType] = useState('general');
  const [serverLocation, setServerLocation] = useState('');
  const [fileName, setFileName] = useState('');
  const [remarks, setRemarks] = useState<any[]>([]);
  const [extensions, setExtensions] = useState<any[]>([]);
  const [, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flaggingMember, setFlaggingMember] = useState<{ id: number; name: string } | null>(null);
  const [timelineRefresh, setTimelineRefresh] = useState(0);
  const [optimisticTimelineEntry, setOptimisticTimelineEntry] = useState<RemarkTimelineEntry | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'deny'>('approve');
  const [resubmissionDate, setResubmissionDate] = useState<Date | null>(null);
  const [deadlineValid, setDeadlineValid] = useState(true);
  const [showDenyConfirm, setShowDenyConfirm] = useState(false);

  // Resolve the effective task ID from either source.
  // Coerce to number so that string "5" and number 5 both work,
  // and treat 0 / NaN as invalid (no task selected).
  const resolvedTaskId = (() => {
    const raw = taskProp?.id ?? taskId;
    if (raw === undefined || raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  })();

  // Always fetch latest task from API when opening by id (avoids stale list cache after resubmit)
  useEffect(() => {
    if (!resolvedTaskId) return;
    const fetchTask = async () => {
      try {
        if (!taskProp) setLoading(true);
        setFetchError(null);
        const fetched = await taskService.getById(resolvedTaskId);
        if (fetched) {
          setLocalTask(fetched);
        } else {
          setFetchError('Task not found.');
        }
      } catch (err) {
        console.error('Failed to fetch task:', err);
        setFetchError('Failed to load task details. Please try again.');
      } finally {
        if (!taskProp) setLoading(false);
      }
    };
    fetchTask();
  }, [resolvedTaskId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onListRefresh = () => {
      void refreshTask();
    };
    window.addEventListener(TASKS_LIST_REFRESH_EVENT, onListRefresh);
    return () => window.removeEventListener(TASKS_LIST_REFRESH_EVENT, onListRefresh);
  }, [resolvedTaskId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep localTask in sync if parent passes a new task object
  useEffect(() => {
    if (taskProp) {
      setLocalTask(taskProp);
    }
  }, [taskProp?.id]);

  useEffect(() => {
    if (embedded && localTask && onTaskMeta) {
      onTaskMeta({
        name: localTask.name,
        status: localTask.status,
        priority: localTask.priority,
      });
    }
  }, [embedded, localTask, onTaskMeta]);

  // Load task details (remarks/extensions) once we have a task id
  useEffect(() => {
    if (resolvedTaskId) {
      loadTaskDetails();
    }
  }, [resolvedTaskId]);

  const refreshTask = async () => {
    if (!resolvedTaskId) return;
    try {
      const updated = await taskService.getById(resolvedTaskId);
      if (updated) setLocalTask(updated);
    } catch {
      // silently ignore — parent will refresh on onTaskUpdate
    }
  };



  const loadTaskDetails = async () => {
    if (!resolvedTaskId) return;
    try {
      setLoading(true);
      const [remarksData, extensionsData] = await Promise.all([
        taskService.getRemarks(resolvedTaskId).catch(() => []),
        taskService.getExtensions(resolvedTaskId).catch(() => [])
      ]);
      setRemarks(Array.isArray(remarksData) ? remarksData : []);
      setExtensions(Array.isArray(extensionsData) ? extensionsData : []);
    } catch (error) {
      console.error('Failed to load task details:', error);
    } finally {
      setLoading(false);
    }
  };

  const isOverdue = () => {
    if (!localTask?.end_date) return false;
    return new Date(localTask.end_date) < new Date();
  };

  const getDaysUntilDue = () => {
    if (!localTask?.end_date) return null;
    const today = new Date();
    const dueDate = new Date(localTask.end_date);
    const diffTime = dueDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };


  const handleRequestExtension = () => {
    setIsExtensionModalOpen(true);
  };

  const handleAddRemark = () => {
    setIsRemarkModalOpen(true);
  };

  const copyServerLocation = async (serverLocation: string) => {
    try {
      await copyTextToClipboard(serverLocation);
      showToast('Server location copied to clipboard!', 'success');
    } catch (error) {
      console.error('Failed to copy server location:', error);
      showToast('❌ Failed to copy server location', 'error');
    }
  };


  const submitExtensionRequest = async () => {
    // Client-side validation
    if (!extensionDate.trim()) {
      showToast('❌ Please select a new due date for the extension.', 'error');
      return;
    }
    
    if (!extensionReason.trim()) {
      showToast('❌ Please provide a reason for the extension.', 'error');
      return;
    }

    try {
      await taskService.requestExtension(resolvedTaskId!, {
        requested_due_date: extensionDate,
        reason: extensionReason
      });
      showToast('Extension request submitted successfully!', 'success');
      await loadTaskDetails();
      onTaskUpdate?.();
    } catch (error: any) {
      console.error('Failed to submit extension request:', error);
      showToast('Failed to submit extension request. Please try again.', 'error');
    }
    setIsExtensionModalOpen(false);
    setExtensionReason('');
    setExtensionDate('');
  };

  const submitRemark = async () => {
    const hasContent = remarkContent.replace(/<[^>]*>/g, '').trim().length > 0;
    
    if (hasContent) {
      try {
        // Client-side validation for mandatory fields
        if (!serverLocation.trim()) {
          showToast('❌ Server Location is required. Please provide the exact path where you saved the file.', 'error');
          return;
        }

        if (!fileName.trim()) {
          showToast('❌ File Name is required. Please provide the exact name of the file you worked on.', 'error');
          return;
        }

        const remarkLengthError = getRemarkLengthMessage(remarkContent);
        if (remarkLengthError) {
          showToast(`❌ ${remarkLengthError}`, 'error');
          return;
        }

        const isAssignee = adminUser?.type === 'team';
        setOptimisticTimelineEntry(
          buildOptimisticTimelineEntry({
            user: adminUser?.name || 'You',
            role: isAssignee ? 'Assignee' : 'Admin',
            action: remarkType === 'complete' ? 'Submitted' : 'Remark Added',
            action_type: remarkType === 'complete' ? 'submitted' : 'remark_added',
            remark: remarkContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
          })
        );

        await taskService.addRemark(resolvedTaskId!, {
          remark: remarkContent,
          remark_date: remarkDate,
          remark_type: remarkType,
          server_location: serverLocation,
          file_name: fileName
        });

        if (remarkType === 'complete') {
          showToast(`Task "${localTask?.name}" has been submitted for review with completion remark!`, 'success');
        } else if (remarkType === 'skipped') {
          showToast(`Task "${localTask?.name}" has been marked as skipped!`, 'success');
        } else {
          showToast('Remark added successfully!', 'success');
        }

        setOptimisticTimelineEntry(null);
        setTimelineRefresh((n) => n + 1);
        await loadTaskDetails();
        await refreshTask();
        onTaskUpdate?.();
      } catch (error: any) {
        console.error('Failed to add remark:', error);
        setOptimisticTimelineEntry(null);

        const errorMessage = error?.message;
        if (errorMessage) {
          if (errorMessage.includes('Server location is required')) {
            showToast('❌ Server Location is required. Please provide the exact path where you saved the file.', 'error');
          } else if (errorMessage.includes('File name is required')) {
            showToast('❌ File Name is required. Please provide the exact name of the file you worked on.', 'error');
          } else {
            showToast(`❌ ${errorMessage}`, 'error');
          }
        } else {
          showToast('Failed to add remark. Please try again.', 'error');
        }
      }
    }
    setIsRemarkModalOpen(false);
    setRemarkContent('');
    setRemarkDate(new Date().toISOString().split('T')[0]);
    setRemarkType('general');
    setServerLocation('');
    setFileName('');
  };

  const handleOpenFlagModal = (memberId: number, memberName: string) => {
    setFlaggingMember({ id: memberId, name: memberName });
    setShowFlagModal(true);
  };

  const submitReview = async (action: 'approve' | 'deny') => {
    if (!resolvedTaskId || !localTask) return;

    const deadlineIso =
      action === 'deny' && RESUBMISSION_DEADLINE_ENABLED && resubmissionDate
        ? resubmissionDate.toISOString()
        : undefined;

    try {
      setReviewSubmitting(true);
      const timelineRemark =
        action === 'approve'
          ? reviewNotes.trim() || 'Task approved.'
          : [
              reviewNotes.trim() || 'Returned for redo.',
              deadlineIso ? `Resubmit by: ${formatResubmissionDisplay(deadlineIso)}` : '',
            ]
              .filter(Boolean)
              .join('\n\n');

      setOptimisticTimelineEntry(
        buildOptimisticTimelineEntry({
          user: adminUser?.name || 'Admin',
          role: 'Admin',
          action: action === 'approve' ? 'Approved' : 'Returned for redo',
          action_type: action === 'approve' ? 'approved' : 'returned_for_rework',
          remark: timelineRemark,
        })
      );

      await taskService.reviewTask(
        resolvedTaskId,
        action,
        reviewNotes.trim() || undefined,
        deadlineIso
      );

      showToast(
        action === 'approve'
          ? `Task "${localTask.name}" approved and marked as completed.`
          : `Task "${localTask.name}" sent back for rework.`,
        'success'
      );
      setReviewNotes('');
      setReviewAction('approve');
      setResubmissionDate(null);
      setShowDenyConfirm(false);
      setOptimisticTimelineEntry(null);
      setTimelineRefresh((n) => n + 1);
      await refreshTask();
      await loadTaskDetails();
      requestTasksListRefresh();
      const projectId = localTask.project_id ?? localTask.projectId;
      if (projectId != null) {
        requestProjectTasksRefresh(projectId, { taskId: localTask.id, action: 'updated' });
      }
      onTaskUpdate?.();
    } catch (error: any) {
      console.error('Failed to review task:', error);
      const msg =
        error?.response?.data?.error?.message ||
        error?.message ||
        'Failed to review task. Please try again.';
      showToast(msg, 'error');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleApproveClick = () => {
    setReviewAction('approve');
    setResubmissionDate(null);
    if (!window.confirm(`Approve "${localTask?.name}" and mark it as completed?`)) return;
    submitReview('approve');
  };

  const handleDenyClick = () => {
    setReviewAction('deny');
    if (!reviewNotes.trim()) {
      showToast('Please add a remark explaining why the task was denied.', 'error');
      return;
    }
    if (RESUBMISSION_DEADLINE_ENABLED) {
      const date = resubmissionDate ?? getDefaultResubmissionDate();
      const validation = validateResubmissionDeadline(date);
      if (!validation.valid) {
        showToast(validation.message || 'Please select a resubmission deadline', 'error');
        return;
      }
      setResubmissionDate(date);
    }
    setShowDenyConfirm(true);
  };

  const daysUntilDue = getDaysUntilDue();
  const overdue = isOverdue();

  // Show loading or error state while task is being fetched (admin side via taskId)
  if (!localTask) {
    // Guard: if the resolved ID is invalid (0, null, NaN), show error immediately
    const displayError = fetchError ?? (!resolvedTaskId ? 'Invalid task ID. Please go back and try again.' : null);
    return (
      <div className={embedded ? 'py-12 flex items-center justify-center' : 'min-h-screen bg-gray-50 flex items-center justify-center'}>
        <div className="text-center">
          {displayError ? (
            <>
              <p className="text-red-600 font-semibold mb-4">{displayError}</p>
              <Button variant="outline" onClick={onBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                {embedded ? 'Close' : 'Back to Tasks'}
              </Button>
            </>
          ) : (
            <p className="text-gray-500">Loading task details...</p>
          )}
        </div>
      </div>
    );
  }

  // Alias localTask as task so all existing JSX references work unchanged
  const task = localTask;
  const displayProgress = getTaskDisplayProgress(task);

  const reviewHeaderActions = adminUser && task.status === 'under-review' ? (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        onClick={() => { setReviewAction('approve'); handleApproveClick(); }}
        disabled={reviewSubmitting}
        className="bg-green-600 hover:bg-green-700 text-white"
      >
        <CheckSquare className="w-4 h-4 mr-1" />
        Approve
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => { setReviewAction('deny'); handleDenyClick(); }}
        disabled={reviewSubmitting}
        className="text-red-600 border-red-300 hover:bg-red-50"
      >
        <XCircle className="w-4 h-4 mr-1" />
        Deny
      </Button>
    </div>
  ) : task.status !== 'completed' && !adminUser ? (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleRequestExtension}>
        <Clock className="w-4 h-4 mr-1" />
        Extension
      </Button>
      <Button size="sm" onClick={handleAddRemark} className="bg-blue-600 hover:bg-blue-700 text-white">
        <MessageSquare className="w-4 h-4 mr-1" />
        Remark
      </Button>
    </div>
  ) : null;

  const sectionHdr = embedded ? 'px-4 py-2.5' : '';
  const sectionBody = embedded ? 'px-4 py-3' : '';
  const sectionTitle = embedded ? 'text-sm font-semibold' : '';

  return (
    <div className={embedded ? 'bg-white' : 'min-h-screen bg-gray-50'}>
      {!embedded && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4 min-w-0">
                <Button variant="ghost" size="sm" onClick={onBack} className="flex items-center space-x-2 shrink-0">
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Tasks</span>
                </Button>
                <div className="h-6 w-px bg-gray-300" />
                <h1 className="text-xl font-semibold text-gray-900 truncate">{task.name}</h1>
              </div>
              {reviewHeaderActions}
            </div>
          </div>
        </div>
      )}

      <div className={embedded ? 'px-5 py-4 space-y-4' : 'max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8'}>
        {embedded && reviewHeaderActions && (
          <div className="flex justify-end rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-2">
            {reviewHeaderActions}
          </div>
        )}
        {adminUser && task.status === 'under-review' && (
          <Card className={embedded ? 'mb-0 border-yellow-200 bg-yellow-50/80 shadow-none' : 'mb-6 border-yellow-300 bg-yellow-50'}>
            <CardHeader className={embedded ? 'px-4 py-2.5' : ''}>
              <CardTitle className={`flex items-center space-x-2 text-yellow-900 ${embedded ? 'text-sm font-semibold' : ''}`}>
                <Clock className="w-5 h-5" />
                <span>Task Submitted for Review</span>
              </CardTitle>
            </CardHeader>
            <CardContent className={embedded ? 'px-4 py-3 space-y-3' : 'space-y-4'}>
              {!embedded && (
              <p className="text-sm text-yellow-800">
                An assignee submitted this task for completion. Approve to mark it completed, or send back for rework with an optional resubmission deadline.
              </p>
              )}
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="review-action"
                    checked={reviewAction === 'approve'}
                    onChange={() => {
                      setReviewAction('approve');
                      setResubmissionDate(null);
                      setDeadlineValid(true);
                    }}
                    className="text-green-600 focus:ring-green-500"
                  />
                  <span>Approve</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="review-action"
                    checked={reviewAction === 'deny'}
                    onChange={() => setReviewAction('deny')}
                    className="text-red-600 focus:ring-red-500"
                  />
                  <span>Return to assignee (redo)</span>
                </label>
              </div>
              <div>
                <label htmlFor="review-notes" className="block text-sm font-medium text-gray-700 mb-1">
                  Review remark
                </label>
                <textarea
                  id="review-notes"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                  placeholder="Add feedback for the assignee (required when sending back)"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                />
              </div>
              <ResubmissionDeadlinePicker
                visible={reviewAction === 'deny'}
                value={resubmissionDate}
                onChange={setResubmissionDate}
                onValidationChange={(valid) => setDeadlineValid(valid)}
              />
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleApproveClick}
                  disabled={reviewSubmitting}
                  className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                >
                  <CheckSquare className="w-4 h-4 mr-2" />
                  Approve Task
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDenyClick}
                  disabled={
                    reviewSubmitting ||
                    reviewAction !== 'deny' ||
                    (RESUBMISSION_DEADLINE_ENABLED && !deadlineValid)
                  }
                  className="text-red-600 border-red-300 hover:bg-red-50 disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Deny / Send Back
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className={embedded ? 'grid grid-cols-1 xl:grid-cols-5 gap-4 items-start' : 'grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start'}>
          {/* Main Content */}
          <div className={embedded ? 'xl:col-span-3 space-y-4 min-w-0' : 'lg:col-span-6 space-y-6 min-w-0'}>
            {/* Task Overview */}
            <Card className={embedded ? 'shadow-none' : ''}>
              <CardHeader className={sectionHdr}>
                <div className="flex items-center justify-between">
                  <CardTitle className={`flex items-center space-x-2 ${sectionTitle}`}>
                    <Target className="w-5 h-5" />
                    <span>Task Overview</span>
                  </CardTitle>
                  {!embedded && (
                  <div className="flex items-center space-x-2">
                    <Badge variant={getTaskStatusBadgeVariant(localTask.status)}>
                      {getTaskStatusLabel(localTask.status)}
                    </Badge>
                    <Badge variant={
                      localTask.priority === 'urgent' ? 'danger' :
                      localTask.priority === 'high' ? 'warning' :
                      localTask.priority === 'medium' ? 'primary' : 'default'
                    }>
                      {localTask.priority}
                    </Badge>
                  </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className={`space-y-4 ${sectionBody}`}>
                {task.description && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Description</h4>
                    <p className="text-gray-700">{task.description}</p>
                  </div>
                )}

                {/* Educational Hierarchy */}
                {(task.grade_name || task.book_name || task.unit_name || task.lesson_name) && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Educational Hierarchy</h4>
                    <div className="flex flex-wrap gap-2">
                      {task.grade_name && (
                        <Badge variant="primary" className="bg-blue-100 text-blue-800">
                          {task.grade_name}
                        </Badge>
                      )}
                      {task.book_name && (
                        <Badge variant="primary" className="bg-indigo-100 text-indigo-800">
                          {task.book_name}
                        </Badge>
                      )}
                      {task.unit_name && (
                        <Badge variant="primary" className="bg-purple-100 text-purple-800">
                          {task.unit_name}
                        </Badge>
                      )}
                      {task.lesson_name && (
                        <Badge variant="primary" className="bg-pink-100 text-pink-800">
                          {task.lesson_name}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Required Skills */}
                {task.required_skills && task.required_skills.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Required Skills</h4>
                    <div className="flex flex-wrap gap-2">
                      {task.required_skills.map((skill: string, index: number) => (
                        <Badge key={index} variant="secondary" className="bg-green-100 text-green-800">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Component Path */}
                {task.componentPath && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Component Path</h4>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                      <span className="text-purple-800 font-medium">{task.componentPath}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Progress & Timeline */}
            <Card className={embedded ? 'shadow-none' : ''}>
              <CardHeader className={sectionHdr}>
                <CardTitle className={`flex items-center space-x-2 ${sectionTitle}`}>
                  <BarChart3 className="w-5 h-5" />
                  <span>Progress & Timeline</span>
                </CardTitle>
              </CardHeader>
              <CardContent className={`${embedded ? 'space-y-4' : 'space-y-6'} ${sectionBody}`}>
                {/* Progress Bar */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Progress</span>
                    <span className="text-sm font-bold text-gray-900">{displayProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-300 ${
                        displayProgress >= 80 ? 'bg-green-500' :
                        displayProgress >= 50 ? 'bg-blue-500' :
                        displayProgress >= 25 ? 'bg-yellow-500' : 'bg-gray-400'
                      }`}
                      style={{ width: `${displayProgress}%` }}
                    />
                  </div>
                </div>



                {/* Timeline */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <Calendar className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Start Date</p>
                      <p className="text-sm text-gray-600">
                        {task.start_date ? new Date(task.start_date).toLocaleDateString() : 'Not set'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <Calendar className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Due Date</p>
                      <p className={`text-sm ${overdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                        {task.end_date ? new Date(task.end_date).toLocaleDateString() : 'Not set'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Time Status */}
                {task.end_date && daysUntilDue !== null && (
                  <div className={`p-4 rounded-lg border-2 ${
                    overdue ? 'bg-red-50 border-red-200' :
                    daysUntilDue <= 1 ? 'bg-orange-50 border-orange-200' :
                    daysUntilDue <= 3 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'
                  }`}>
                    <div className="flex items-center space-x-3">
                      {overdue ? (
                        <AlertTriangle className="w-6 h-6 text-red-600" />
                      ) : (
                        <Clock className="w-6 h-6 text-gray-600" />
                      )}
                      <div>
                        <p className={`font-medium ${
                          overdue ? 'text-red-800' :
                          daysUntilDue <= 1 ? 'text-orange-800' :
                          daysUntilDue <= 3 ? 'text-yellow-800' : 'text-green-800'
                        }`}>
                          {overdue ? `${Math.abs(daysUntilDue)} days overdue` :
                           daysUntilDue === 0 ? 'Due today' :
                           daysUntilDue === 1 ? 'Due tomorrow' :
                           `${daysUntilDue} days left`}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Hours */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                    <Clock className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">Estimated Hours</p>
                      <p className="text-lg font-bold text-blue-900">{task.estimated_hours}h</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                    <Activity className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-green-900">Actual Hours</p>
                      <p className="text-lg font-bold text-green-900">{task.actual_hours || 0}h</p>
                    </div>
                  </div>
                </div>

                {/* File Location */}
                {localTask.server_location && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                      <FolderOpen className="w-4 h-4 text-blue-600" />
                      File Location
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-gray-800 font-mono break-all">{localTask.server_location}</p>
                      <button
                        onClick={() => copyServerLocation(localTask.server_location || '')}
                        title="Copy file location"
                        className="shrink-0 p-1.5 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>

          {/* Middle sidebar — assignees, project, extensions */}
          <div className={embedded ? 'xl:col-span-2 space-y-4 min-w-0' : 'lg:col-span-3 space-y-6 min-w-0'}>
            {/* Assignees Section - Visible to Admins or for reference */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="w-5 h-5" />
                  <span>Assignees</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {task.assigneeDetails && task.assigneeDetails.length > 0 ? (
                  <div className="space-y-3">
                    {task.assigneeDetails.map((user: any) => (
                      <div key={user.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-100">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs relative">
                            {user.name.charAt(0).toUpperCase()}
                            {user.performance_flag && (
                              <div 
                                className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                                  user.performance_flag.type === 'red' ? 'bg-red-500' :
                                  user.performance_flag.type === 'orange' ? 'bg-orange-500' :
                                  user.performance_flag.type === 'yellow' ? 'bg-yellow-400' :
                                  'bg-green-500'
                                }`}
                                title={`Performance Flag: ${user.performance_flag.type.toUpperCase()}\nReason: ${user.performance_flag.reason}`}
                              />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 flex items-center">
                              {user.name}
                              {user.performance_flag && (
                                <Flag 
                                  className={`w-3 h-3 ml-1.5 ${
                                    user.performance_flag.type === 'red' ? 'text-red-500' :
                                    user.performance_flag.type === 'orange' ? 'text-orange-500' :
                                    user.performance_flag.type === 'yellow' ? 'text-yellow-500' :
                                    'text-green-500'
                                  }`} 
                                />
                              )}
                            </p>
                            <p className="text-xs text-gray-500">{user.role || 'Team Member'}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenFlagModal(user.id, user.name)}
                          className="text-gray-400 hover:text-red-600 hover:bg-red-50"
                          title={`Flag ${user.name}`}
                        >
                          <Flag className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-2">No assignees assigned</p>
                )}
              </CardContent>
            </Card>

            {/* Project Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Award className="w-5 h-5" />
                  <span>Project Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">Project</p>
                  <p className="text-sm text-gray-600">{task.project_name || 'Unknown Project'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Stage</p>
                  <p className="text-sm text-gray-600">{task.stage_name || 'Unknown Stage'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Category</p>
                  <p className="text-sm text-gray-600">{task.category_name || 'Unknown Category'}</p>
                </div>
              </CardContent>
            </Card>

            {/* Extension Requests */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-5 h-5" />
                    <span>Extensions ({extensions.length})</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setIsExtensionModalOpen(true)}
                    className="bg-orange-600 hover:bg-orange-700 text-white text-xs px-2 py-1"
                  >
                    <Clock className="w-3 h-3 mr-1" />
                    Request
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {extensions.length === 0 ? (
                  <div className="text-center py-4">
                    <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-xs text-gray-600">No extension requests yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {extensions.map((extension, index) => (
                      <div key={index} className={`border rounded-lg p-3 ${
                        extension.status === 'approved' ? 'bg-green-50 border-green-200' :
                        extension.status === 'rejected' ? 'bg-red-50 border-red-200' :
                        'bg-orange-50 border-orange-200'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant={
                            extension.status === 'approved' ? 'success' :
                            extension.status === 'rejected' ? 'danger' : 'warning'
                          } size="sm">
                            {extension.status}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {new Date(extension.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="text-xs">
                            <span className="font-medium text-gray-700">From:</span>
                            <span className="text-gray-600 ml-1">
                              {new Date(extension.current_due_date).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="text-xs">
                            <span className="font-medium text-gray-700">To:</span>
                            <span className="text-gray-600 ml-1">
                              {new Date(extension.requested_due_date).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        
                        <div className="mt-2">
                          <p className="text-xs font-medium text-gray-700 mb-1">Reason</p>
                          <p className="text-xs text-gray-600 line-clamp-2">{extension.reason}</p>
                        </div>
                        
                        {extension.status !== 'pending' && extension.review_notes && (
                          <div className="mt-2 p-2 bg-white rounded border">
                            <p className="text-xs font-medium text-gray-700 mb-1">
                              Admin Review
                            </p>
                            <p className="text-xs text-gray-600 line-clamp-2">{extension.review_notes}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {embedded && resolvedTaskId && (
              <div className="max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-white">
                <TaskRemarksTimeline
                  taskId={resolvedTaskId}
                  fetcher={remarkHistoryFetcher}
                  refreshToken={timelineRefresh}
                  optimisticEntry={optimisticTimelineEntry}
                />
              </div>
            )}

          </div>

          {/* Far-right column — review & remarks timeline */}
          {!embedded && resolvedTaskId && (
            <aside className="lg:col-span-3 min-w-0 w-full">
              <TaskRemarksTimeline
                taskId={resolvedTaskId}
                fetcher={remarkHistoryFetcher}
                refreshToken={timelineRefresh}
                optimisticEntry={optimisticTimelineEntry}
              />
            </aside>
          )}
        </div>

        {/* Task Remarks - Full Width */}
        <div className={embedded ? 'mt-0' : 'mt-8'}>
          <Card className={embedded ? 'shadow-none' : ''}>
            <CardHeader className={sectionHdr}>
              <CardTitle className={`flex items-center justify-between ${sectionTitle}`}>
                <div className="flex items-center space-x-2">
                  <MessageSquare className="w-5 h-5" />
                  <span>Task Remarks ({remarks.length})</span>
                </div>
                <Button
                  size="sm"
                  onClick={() => setIsRemarkModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <MessageSquare className="w-4 h-4 mr-1" />
                  Add Remark
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className={sectionBody}>
              {remarks.length === 0 ? (
                <div className={embedded ? 'text-center py-4' : 'text-center py-8'}>
                  <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No remarks yet. Add your first remark to track progress or share updates.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {remarks.map((remark, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <Badge variant={
                            remark.remark_type === 'progress' ? 'success' :
                            remark.remark_type === 'issue' ? 'danger' :
                            remark.remark_type === 'update' ? 'primary' :
                            remark.remark_type === 'complete' ? 'success' : 'default'
                          }>
                            {remark.remark_type}
                          </Badge>
                          <span className="text-sm text-gray-600">
                            {remark.user_name || 'You'} • {new Date(remark.remark_date || remark.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      
                      {/* Server Location and File Name */}
                      {(remark.server_location || remark.file_name) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200 overflow-hidden">
                          {remark.server_location && (
                            <div className="flex items-start gap-2 min-w-0">
                              <FolderOpen className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-blue-600 uppercase tracking-wide font-medium">Server Location</p>
                                <div className="flex items-center gap-2 min-w-0 mt-0.5">
                                  <p
                                    className="text-sm font-medium text-gray-900 truncate min-w-0 flex-1"
                                    title={remark.server_location}
                                  >
                                    {remark.server_location}
                                  </p>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => copyServerLocation(remark.server_location!)}
                                    className="shrink-0 p-1.5 h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-100 border border-blue-200 rounded-md"
                                    title="Copy server location"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                          {remark.file_name && (
                            <div className="flex items-start gap-2 min-w-0">
                              <MessageSquare className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-blue-600 uppercase tracking-wide font-medium">File Name</p>
                                <p
                                  className="text-sm font-medium text-gray-900 truncate mt-0.5"
                                  title={remark.file_name}
                                >
                                  {remark.file_name}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="prose prose-sm max-w-none">
                        <RichTextDisplay content={remark.remark} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>


      {/* Extension Request Modal */}
      <Modal
        isOpen={isExtensionModalOpen}
        onClose={() => setIsExtensionModalOpen(false)}
        title="Request Task Extension"
      >
        <div className="space-y-6">
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">
            <h4 className="font-semibold text-gray-900 text-lg">{task.name}</h4>
            <p className="text-sm text-gray-600 mt-1">
              Current due date: {task.end_date ? new Date(task.end_date).toLocaleDateString() : 'No due date'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              New Due Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={extensionDate}
              onChange={(e) => setExtensionDate(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Reason for Extension
            </label>
            <textarea
              value={extensionReason}
              onChange={(e) => setExtensionReason(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              rows={4}
              placeholder="Please explain why you need an extension..."
              required
            />
          </div>

          <div className="flex justify-end space-x-4">
            <Button
              variant="outline"
              onClick={() => setIsExtensionModalOpen(false)}
              className="px-6 py-3 font-semibold"
            >
              Cancel
            </Button>
            <Button
              onClick={submitExtensionRequest}
              disabled={!extensionReason.trim() || !extensionDate.trim()}
              className="px-6 py-3 font-semibold bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit Request
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Remark Modal */}
      <Modal
        isOpen={isRemarkModalOpen}
        onClose={() => setIsRemarkModalOpen(false)}
        title="Add Task Remark"
      >
        <div className="space-y-6">
          <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200">
            <h4 className="font-semibold text-gray-900 text-lg">{task.name}</h4>
            <p className="text-sm text-gray-600 mt-1">
              Add a remark or comment about this task
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Remark Type
            </label>
            <select
              value={remarkType}
              onChange={(e) => setRemarkType(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
            >
              <option value="general">General / In Progress</option>
              <option value="complete">Completed</option>
              <option value="skipped">Skipped</option>
              <option value="other">Other</option>
            </select>
            {remarkType === 'complete' && (
              <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> Selecting "Complete" will submit this task for admin review. The task status will change to "Under Review" and an admin will need to approve it.
                  </p>
                </div>
              </div>
            )}
            {remarkType === 'skipped' && (
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <p className="text-sm text-red-800">
                    <strong>Warning:</strong> Selecting "Skipped" will mark this task as skipped and set its progress to 0.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Server Location - Required for team members */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Server Location <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={serverLocation}
              onChange={(e) => setServerLocation(e.target.value)}
              placeholder="e.g., /var/www/html/project, C:\project\src"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
              required
            />
            <p className="text-xs text-gray-500 mt-1">The exact path of the server where you have saved the file</p>
          </div>

          {/* File Name - Required for team members */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              File Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="e.g., index.html, main.js, styles.css"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
              required
            />
            <p className="text-xs text-gray-500 mt-1">The exact name of the file you worked on</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Remark Content
            </label>
            <RichTextEditor
              value={remarkContent}
              onChange={setRemarkContent}
              placeholder="Add your remark or comment about this task..."
              height="150px"
            />
            <p className={`text-xs mt-1 ${getRemarkPlainTextLength(remarkContent) > REMARK_MAX_PLAIN_LENGTH ? 'text-red-600' : 'text-gray-500'}`}>
              {getRemarkPlainTextLength(remarkContent).toLocaleString()} / {REMARK_MAX_PLAIN_LENGTH.toLocaleString()} characters
            </p>
          </div>

          <div className="flex justify-end space-x-4">
            <Button
              variant="outline"
              onClick={() => setIsRemarkModalOpen(false)}
              className="px-6 py-3 font-semibold"
            >
              Cancel
            </Button>
            <Button
              onClick={submitRemark}
              disabled={
                remarkContent.replace(/<[^>]*>/g, '').trim().length === 0 ||
                isRemarkTooLong(remarkContent) ||
                !serverLocation.trim() ||
                !fileName.trim()
              }
              className="px-6 py-3 font-semibold bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Remark
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showDenyConfirm}
        onClose={() => setShowDenyConfirm(false)}
        title="Send back task?"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            The assignee will need to complete corrections and resubmit this task.
          </p>
          {RESUBMISSION_DEADLINE_ENABLED && resubmissionDate && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
              <span className="font-medium">Resubmission required by:</span>
              <br />
              {formatResubmissionDisplay(resubmissionDate.toISOString())}
            </div>
          )}
          {reviewNotes.trim() && (
            <div className="text-sm text-gray-600 border-t pt-3">
              <span className="font-medium text-gray-800">Your remark:</span>
              <p className="mt-1 whitespace-pre-wrap">{reviewNotes.trim()}</p>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowDenyConfirm(false)} disabled={reviewSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={() => submitReview('deny')}
              disabled={reviewSubmitting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Confirm send back
            </Button>
          </div>
        </div>
      </Modal>

      {/* Flag Employee Modal */}
      {flaggingMember && (
        <FlagEmployeeModal
          isOpen={showFlagModal}
          onClose={() => {
            setShowFlagModal(false);
            setFlaggingMember(null);
          }}
          memberId={flaggingMember.id}
          memberName={flaggingMember.name}
          taskId={task.id}
          taskName={task.name}
          onSuccess={() => {
            refreshTask();
          }}
        />
      )}
    </div>
  );
}

// Export alias for backward compatibility
export { TeamTaskDetail as TaskDetails };
