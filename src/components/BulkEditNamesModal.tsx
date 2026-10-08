import React, { useState, useEffect, useRef } from 'react';
import { Edit2, X, AlertCircle, CheckCircle, Loader2, Save } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { taskService } from '../services/apiService';

interface BulkEditNamesModalProps {
  isOpen: boolean;
  selectedTasks: Array<{ id: number | string; name: string; task_name?: string }>;
  onClose: () => void;
  onSuccess: (updatedCount: number) => Promise<void> | void;
}

interface EditableTask {
  id: number;
  originalName: string;
  editedName: string;
  hasChanges: boolean;
  error?: string;
}

const MAX_NAME_LENGTH = 255;

export function BulkEditNamesModal({
  isOpen,
  selectedTasks,
  onClose,
  onSuccess,
}: BulkEditNamesModalProps) {
  const [tasks, setTasks] = useState<EditableTask[]>([]);
  const [busy, setBusy] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const inputRefs = useRef<Map<number, HTMLInputElement>>(new Map());

  // Initialize tasks when modal opens
  useEffect(() => {
    if (isOpen && selectedTasks.length > 0) {
      const editableTasks: EditableTask[] = selectedTasks.map((task) => {
        const id = typeof task.id === 'string' ? parseInt(task.id, 10) : task.id;
        const name = task.name || task.task_name || '';
        return {
          id,
          originalName: name,
          editedName: name,
          hasChanges: false,
        };
      });
      setTasks(editableTasks);
      setGlobalError(null);
    }
  }, [isOpen, selectedTasks]);

  const handleNameChange = (id: number, newName: string) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== id) return task;

        let error: string | undefined;
        if (!newName.trim()) {
          error = 'Task name cannot be empty';
        } else if (newName.length > MAX_NAME_LENGTH) {
          error = `Name exceeds ${MAX_NAME_LENGTH} characters`;
        }

        return {
          ...task,
          editedName: newName,
          hasChanges: newName !== task.originalName,
          error,
        };
      })
    );
  };

  const handleReset = (id: number) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== id) return task;
        return {
          ...task,
          editedName: task.originalName,
          hasChanges: false,
          error: undefined,
        };
      })
    );
  };

  const handleResetAll = () => {
    setTasks((prev) =>
      prev.map((task) => ({
        ...task,
        editedName: task.originalName,
        hasChanges: false,
        error: undefined,
      }))
    );
    setGlobalError(null);
  };

  const handleSubmit = async () => {
    setGlobalError(null);

    // Validate all tasks
    const hasErrors = tasks.some((task) => task.error);
    if (hasErrors) {
      setGlobalError('Please fix validation errors before saving');
      return;
    }

    // Get only changed tasks
    const changedTasks = tasks.filter((task) => task.hasChanges);
    if (changedTasks.length === 0) {
      setGlobalError('No changes detected');
      return;
    }

    setBusy(true);
    try {
      // Prepare update payload
      const updates = changedTasks.map((task) => ({
        id: task.id,
        name: task.editedName.trim(),
      }));

      // Call bulk update API
      const result = await taskService.bulkUpdateNames(updates);
      const updatedCount = Number(result?.updatedCount ?? changedTasks.length);

      // Success
      await onSuccess(updatedCount);
      onClose();
    } catch (err: any) {
      setGlobalError(err?.message || 'Failed to update task names');
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    if (!busy) {
      onClose();
      // Reset state after modal closes
      setTimeout(() => {
        setTasks([]);
        setGlobalError(null);
      }, 200);
    }
  };

  const changedCount = tasks.filter((task) => task.hasChanges).length;
  const hasErrors = tasks.some((task) => task.error);
  const canSubmit = changedCount > 0 && !hasErrors && !busy;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Bulk Edit Task Names" size="xl">
      <div className="space-y-4">
        {/* Header info */}
        <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg border border-indigo-200">
          <div className="flex items-center gap-2">
            <Edit2 className="w-5 h-5 text-indigo-600" />
            <div>
              <p className="text-sm font-semibold text-indigo-900">
                {tasks.length} Task{tasks.length !== 1 ? 's' : ''} Selected
              </p>
              <p className="text-xs text-indigo-700">
                {changedCount > 0
                  ? `${changedCount} change${changedCount !== 1 ? 's' : ''} pending`
                  : 'Edit task names directly below'}
              </p>
            </div>
          </div>
          {changedCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleResetAll} disabled={busy}>
              <X className="w-4 h-4 mr-1" />
              Reset All
            </Button>
          )}
        </div>

        {/* Global error */}
        {globalError && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            {globalError}
          </div>
        )}

        {/* Task list */}
        <div className="border border-gray-200 rounded-lg max-h-[500px] overflow-y-auto">
          <div className="divide-y divide-gray-100">
            {tasks.map((task, index) => {
              const inputRef = (el: HTMLInputElement | null) => {
                if (el) inputRefs.current.set(task.id, el);
                else inputRefs.current.delete(task.id);
              };

              return (
                <div
                  key={task.id}
                  className={`p-3 transition-colors ${
                    task.hasChanges
                      ? 'bg-blue-50/50'
                      : index % 2 === 0
                      ? 'bg-white'
                      : 'bg-gray-50/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Task number */}
                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-gray-100 text-gray-600 rounded-lg text-sm font-medium mt-1">
                      {index + 1}
                    </div>

                    {/* Input field */}
                    <div className="flex-1 min-w-0">
                      <div className="relative">
                        <input
                          ref={inputRef}
                          type="text"
                          value={task.editedName}
                          onChange={(e) => handleNameChange(task.id, e.target.value)}
                          disabled={busy}
                          className={`
                            w-full px-3 py-2 text-sm rounded-lg border outline-none
                            transition-all duration-150 font-medium
                            ${busy ? 'bg-gray-100 cursor-not-allowed' : ''}
                            ${
                              task.error
                                ? 'border-red-300 bg-red-50 text-red-900 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                                : task.hasChanges
                                ? 'border-blue-400 bg-white text-blue-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
                                : 'border-gray-300 bg-white text-gray-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200'
                            }
                          `}
                          placeholder="Enter task name..."
                          maxLength={MAX_NAME_LENGTH + 10} // Allow typing past limit to show error
                        />
                        {task.hasChanges && !task.error && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                              MODIFIED
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Error message */}
                      {task.error && (
                        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {task.error}
                        </p>
                      )}

                      {/* Character count */}
                      <div className="mt-1 flex items-center justify-between text-xs">
                        <span
                          className={
                            task.editedName.length > MAX_NAME_LENGTH
                              ? 'text-red-600 font-medium'
                              : task.editedName.length > MAX_NAME_LENGTH * 0.9
                              ? 'text-amber-600'
                              : 'text-gray-400'
                          }
                        >
                          {task.editedName.length} / {MAX_NAME_LENGTH} characters
                        </span>
                        {task.hasChanges && (
                          <button
                            onClick={() => handleReset(task.id)}
                            disabled={busy}
                            className="text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Status icon */}
                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center mt-1">
                      {task.error ? (
                        <div className="w-6 h-6 flex items-center justify-center bg-red-100 text-red-600 rounded-full">
                          <X className="w-4 h-4" />
                        </div>
                      ) : task.hasChanges ? (
                        <div className="w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full">
                          <CheckCircle className="w-4 h-4" />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Info text */}
        <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 space-y-1">
          <p className="font-semibold text-gray-700">Tips:</p>
          <p>• Task names are limited to {MAX_NAME_LENGTH} characters</p>
          <p>• Only modified tasks will be updated</p>
          <p>• Empty task names are not allowed</p>
          <p>• Changes are saved when you click "Save Changes"</p>
        </div>

        {/* Footer buttons */}
        <div className="flex justify-end gap-3 pt-2 border-t border-gray-200">
          <Button variant="outline" onClick={handleClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={busy} disabled={!canSubmit}>
            <Save className="w-4 h-4 mr-2" />
            Save {changedCount > 0 ? `${changedCount} ` : ''}Change
            {changedCount !== 1 ? 's' : ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
