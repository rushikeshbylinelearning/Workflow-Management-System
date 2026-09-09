import React, { useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, CheckSquare, Circle, PauseCircle, PlayCircle, Trash2, UserCheck } from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';
import { taskService } from '../services/apiService';
import { getTaskStatusLabel } from '../utils/taskStatusDisplay';

type BulkStatus = 'on-hold' | 'in-progress' | 'not-started' | 'completed';

interface TeamMemberOption {
  id: number | string;
  name: string;
  is_active?: boolean | number;
}

interface BulkTaskSelectionActionsProps {
  selectedTaskIds: Array<string | number>;
  selectedTaskNames: string[];
  teamMembers: TeamMemberOption[];
  onSuccess: () => Promise<void> | void;
  onDelete?: () => void;
}

const COMPACT_BTN = 'flex-shrink-0 whitespace-nowrap';

const STATUS_ACTIONS: Array<{
  status: BulkStatus;
  label: string;
  icon: React.ReactNode;
  className: string;
}> = [
  {
    status: 'on-hold',
    label: 'On Hold',
    icon: <PauseCircle className="w-3.5 h-3.5 mr-1" />,
    className: 'border-slate-300 text-slate-700 hover:bg-slate-50',
  },
  {
    status: 'in-progress',
    label: 'Progress',
    icon: <PlayCircle className="w-3.5 h-3.5 mr-1" />,
    className: 'border-blue-300 text-blue-700 hover:bg-blue-50',
  },
  {
    status: 'not-started',
    label: 'Not Started',
    icon: <Circle className="w-3.5 h-3.5 mr-1" />,
    className: 'border-gray-300 text-gray-700 hover:bg-gray-50',
  },
];

function parseSelectedIds(rawIds: Array<string | number>): number[] {
  return [...new Set(
    rawIds
      .map((id) => parseInt(String(id), 10))
      .filter((id) => !Number.isNaN(id) && id > 0)
  )];
}

function isActiveMember(member: TeamMemberOption): boolean {
  return member.is_active === undefined || member.is_active === true || member.is_active === 1;
}

export function BulkTaskSelectionActions({
  selectedTaskIds,
  selectedTaskNames,
  teamMembers,
  onSuccess,
  onDelete,
}: BulkTaskSelectionActionsProps) {
  const { showToast } = useToast();
  const [pendingStatus, setPendingStatus] = useState<BulkStatus | null>(null);
  const [pendingApprove, setPendingApprove] = useState(false);
  const [isReassignOpen, setIsReassignOpen] = useState(false);
  const [isDatesOpen, setIsDatesOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState('');
  const [busy, setBusy] = useState(false);

  const taskIds = useMemo(() => parseSelectedIds(selectedTaskIds), [selectedTaskIds]);
  const count = taskIds.length;

  const activeMembers = useMemo(
    () => teamMembers.filter((member) => member.name && isActiveMember(member)),
    [teamMembers]
  );

  const filteredMembers = useMemo(() => {
    const query = assigneeSearch.trim().toLowerCase();
    if (!query) return activeMembers;
    return activeMembers.filter((member) => member.name.toLowerCase().includes(query));
  }, [activeMembers, assigneeSearch]);

  const selectedAssignee = activeMembers.find(
    (member) => String(member.id) === selectedAssigneeId
  );

  const closeStatusModal = () => {
    if (!busy) setPendingStatus(null);
  };

  const closeApproveModal = () => {
    if (!busy) setPendingApprove(false);
  };

  const closeReassignModal = () => {
    if (busy) return;
    setIsReassignOpen(false);
    setAssigneeSearch('');
    setSelectedAssigneeId('');
  };

  const closeDatesModal = () => {
    if (busy) return;
    setIsDatesOpen(false);
    setStartDate('');
    setDueDate('');
  };

  const handleConfirmStatus = async () => {
    if (!pendingStatus || count === 0 || busy) return;
    setBusy(true);
    try {
      const result = await taskService.bulkUpdateStatus(taskIds, pendingStatus);
      const updated = Number(result?.updatedCount ?? count);
      const skipped = Number(result?.skippedCount ?? 0);
      const label = getTaskStatusLabel(pendingStatus);
      const skipNote = skipped > 0 ? ` (${skipped} already ${label})` : '';
      showToast(
        updated > 0
          ? `${updated} task${updated !== 1 ? 's' : ''} set to ${label}.${skipNote}`
          : `Selected tasks are already ${label}.`,
        updated > 0 ? 'success' : 'info'
      );
      setPendingStatus(null);
      await onSuccess();
    } catch (err: any) {
      showToast(err?.message || 'Failed to update selected tasks', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmApprove = async () => {
    if (count === 0 || busy) return;
    setBusy(true);
    try {
      const result = await taskService.bulkApprove(taskIds);
      const approved = Number(result?.approvedCount ?? 0);
      const skipped = Number(result?.skippedCount ?? 0);
      const skipNote = skipped > 0 ? ` ${skipped} not under review skipped.` : '';
      showToast(
        approved > 0
          ? `${approved} task${approved !== 1 ? 's' : ''} approved.${skipNote}`
          : 'No selected tasks are under review.',
        approved > 0 ? 'success' : 'info'
      );
      setPendingApprove(false);
      await onSuccess();
    } catch (err: any) {
      showToast(err?.message || 'Failed to approve selected tasks', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmReassign = async () => {
    if (!selectedAssignee || count === 0 || busy) return;
    setBusy(true);
    try {
      const result = await taskService.bulkReassign({
        taskIds,
        assignee_id: Number(selectedAssignee.id),
        assignee_type: 'team',
      });
      const reassigned = Number(result?.reassignedCount ?? count);
      showToast(
        `${reassigned} task${reassigned !== 1 ? 's' : ''} reassigned to ${selectedAssignee.name}.`,
        'success'
      );
      setIsReassignOpen(false);
      setAssigneeSearch('');
      setSelectedAssigneeId('');
      await onSuccess();
    } catch (err: any) {
      showToast(err?.message || 'Failed to reassign selected tasks', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDates = async () => {
    if (count === 0 || busy) return;
    if (!startDate && !dueDate) {
      showToast('Choose a start date, due date, or both.', 'error');
      return;
    }
    if (startDate && dueDate && dueDate < startDate) {
      showToast('Due date must be on or after start date.', 'error');
      return;
    }

    setBusy(true);
    try {
      const result = await taskService.bulkUpdateDates({
        taskIds,
        ...(startDate ? { start_date: startDate } : {}),
        ...(dueDate ? { end_date: dueDate } : {}),
      });
      const updated = Number(result?.updatedCount ?? count);
      const parts = [
        startDate ? 'start date' : null,
        dueDate ? 'due date' : null,
      ].filter(Boolean).join(' and ');
      showToast(
        `${updated} task${updated !== 1 ? 's' : ''} ${parts} updated.`,
        'success'
      );
      setIsDatesOpen(false);
      setStartDate('');
      setDueDate('');
      await onSuccess();
    } catch (err: any) {
      showToast(err?.message || 'Failed to update dates', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (count === 0) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 justify-end">
        {STATUS_ACTIONS.map((action) => (
          <Button
            key={action.status}
            variant="outline"
            size="xs"
            disabled={busy}
            onClick={() => setPendingStatus(action.status)}
            className={`${COMPACT_BTN} ${action.className}`}
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
        <Button
          variant="outline"
          size="xs"
          disabled={busy}
          onClick={() => setPendingApprove(true)}
          className={`${COMPACT_BTN} border-emerald-300 text-emerald-700 hover:bg-emerald-50`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
          Approve
        </Button>
        <Button
          variant="outline"
          size="xs"
          disabled={busy}
          onClick={() => setPendingStatus('completed')}
          className={`${COMPACT_BTN} border-green-300 text-green-700 hover:bg-green-50`}
        >
          <CheckSquare className="w-3.5 h-3.5 mr-1" />
          Completed
        </Button>
        <Button
          variant="outline"
          size="xs"
          disabled={busy}
          onClick={() => setIsReassignOpen(true)}
          className={`${COMPACT_BTN} border-indigo-300 text-indigo-700 hover:bg-indigo-50`}
        >
          <UserCheck className="w-3.5 h-3.5 mr-1" />
          Reassigned
        </Button>
        <Button
          variant="outline"
          size="xs"
          disabled={busy}
          onClick={() => setIsDatesOpen(true)}
          className={`${COMPACT_BTN} border-teal-300 text-teal-700 hover:bg-teal-50`}
        >
          <CalendarDays className="w-3.5 h-3.5 mr-1" />
          Dates
        </Button>
        {onDelete && (
          <Button
            variant="danger"
            size="xs"
            disabled={busy}
            onClick={onDelete}
            className={`${COMPACT_BTN} bg-red-600 hover:bg-red-700 text-white`}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            Delete
          </Button>
        )}
      </div>

      <Modal
        isOpen={pendingStatus !== null}
        onClose={closeStatusModal}
        title="Confirm Bulk Status Update"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Set {count} selected task{count !== 1 ? 's' : ''} to{' '}
            <strong>{pendingStatus ? getTaskStatusLabel(pendingStatus) : ''}</strong>?
            Tasks already in this status will be skipped.{' '}
            {pendingStatus === 'on-hold'
              ? 'On Hold keeps current progress.'
              : pendingStatus === 'completed'
                ? 'Progress will be set to 100%.'
                : 'Progress is updated to match the new status.'}
          </p>

          {selectedTaskNames.length > 0 && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Selected tasks</h4>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {selectedTaskNames.map((name, index) => (
                  <div key={`${name}-${index}`} className="text-sm text-gray-600 flex items-center">
                    <span className="w-2 h-2 bg-blue-400 rounded-full mr-2 flex-shrink-0" />
                    <span className="truncate">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-2">
            <Button type="button" variant="outline" onClick={closeStatusModal} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" onClick={handleConfirmStatus} loading={busy}>
              Update {count} Task{count !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={pendingApprove}
        onClose={closeApproveModal}
        title="Confirm Bulk Approve"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Approve {count} selected task{count !== 1 ? 's' : ''}? Only tasks that are
            under review will be marked completed. Other selected tasks will be skipped.
          </p>

          {selectedTaskNames.length > 0 && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Selected tasks</h4>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {selectedTaskNames.map((name, index) => (
                  <div key={`${name}-${index}`} className="text-sm text-gray-600 flex items-center">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full mr-2 flex-shrink-0" />
                    <span className="truncate">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-2">
            <Button type="button" variant="outline" onClick={closeApproveModal} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" onClick={handleConfirmApprove} loading={busy}>
              Approve {count} Task{count !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isReassignOpen}
        onClose={closeReassignModal}
        title="Reassign Selected Tasks"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            This replaces current assignees on {count} selected task{count !== 1 ? 's' : ''}
            with the team member you choose.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assign to
            </label>
            <input
              type="text"
              value={assigneeSearch}
              onChange={(e) => setAssigneeSearch(e.target.value)}
              placeholder="Search team members..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
            />
            <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
              {filteredMembers.length === 0 ? (
                <div className="px-3 py-4 text-sm text-gray-400">No members found</div>
              ) : (
                filteredMembers.map((member) => {
                  const value = String(member.id);
                  const checked = selectedAssigneeId === value;
                  return (
                    <label
                      key={value}
                      className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm hover:bg-indigo-50 ${
                        checked ? 'bg-indigo-50 text-indigo-800' : 'text-gray-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="bulk-reassign-assignee"
                        checked={checked}
                        onChange={() => setSelectedAssigneeId(value)}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="truncate">{member.name}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {selectedTaskNames.length > 0 && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Tasks to reassign</h4>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {selectedTaskNames.map((name, index) => (
                  <div key={`${name}-${index}`} className="text-sm text-gray-600 flex items-center">
                    <span className="w-2 h-2 bg-indigo-400 rounded-full mr-2 flex-shrink-0" />
                    <span className="truncate">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-2">
            <Button type="button" variant="outline" onClick={closeReassignModal} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmReassign}
              loading={busy}
              disabled={!selectedAssigneeId}
            >
              Reassign {count} Task{count !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isDatesOpen}
        onClose={closeDatesModal}
        title="Update Start & Due Dates"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Apply new dates to {count} selected task{count !== 1 ? 's' : ''}.
            Fill in start date, due date, or both. Empty fields are left unchanged.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                min={startDate || undefined}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {selectedTaskNames.length > 0 && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Selected tasks</h4>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {selectedTaskNames.map((name, index) => (
                  <div key={`${name}-${index}`} className="text-sm text-gray-600 flex items-center">
                    <span className="w-2 h-2 bg-teal-400 rounded-full mr-2 flex-shrink-0" />
                    <span className="truncate">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-2">
            <Button type="button" variant="outline" onClick={closeDatesModal} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmDates}
              loading={busy}
              disabled={!startDate && !dueDate}
            >
              Update Dates
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
