import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, MessageSquare, RefreshCw } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { useToast } from './ui/Toast';
import { taskService } from '../services/apiService';
import {
  applyPasteGrid,
  BULK_REMARK_STAGE_OPTIONS,
  EDITABLE_BULK_REMARK_COLUMNS,
  formatTaskTags,
  MAX_BULK_ROWS_ADMIN,
  parseClipboardGrid,
  statusToRemarkStage,
  type BulkRemarkEditableColumn,
} from '../utils/bulkRemark';

interface BulkRemarkModalProps {
  isOpen: boolean;
  taskIds: Array<string | number>;
  selectedTasks?: any[];
  onClose: () => void;
  onSuccess: (updatedCount: number) => Promise<void> | void;
}

interface BulkRemarkRow {
  taskId: number;
  tags: string;
  name: string;
  description: string;
  stage: string;
  fileLocation: string;
  fileName: string;
  remark: string;
  stageInvalid?: boolean;
  error?: string | null;
}

const INPUT_CLASS =
  'w-full min-w-[8rem] px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent';

function toRow(task: any, fallback?: any): BulkRemarkRow {
  const merged = { ...fallback, ...task };
  return {
    taskId: Number(merged.taskId ?? merged.id),
    tags: formatTaskTags(task) || formatTaskTags(fallback) || formatTaskTags(merged),
    name: merged.name || fallback?.name || '',
    description: merged.description || fallback?.description || '',
    stage: statusToRemarkStage(merged.stage || merged.status),
    fileLocation: merged.fileLocation || merged.server_location || '',
    fileName: merged.fileName || '',
    remark: '',
    stageInvalid: false,
    error: null,
  };
}

export function BulkRemarkModal({
  isOpen,
  taskIds,
  selectedTasks = [],
  onClose,
  onSuccess,
}: BulkRemarkModalProps) {
  const [rows, setRows] = useState<BulkRemarkRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const { showToast } = useToast();
  const successCountRef = useRef(0);
  const selectedTasksRef = useRef(selectedTasks);
  selectedTasksRef.current = selectedTasks;
  const idsKey = taskIds.join(',');

  useEffect(() => {
    if (!isOpen) {
      setRows([]);
      setLoadError(null);
      setLoading(false);
      setBusy(false);
      setRetryingId(null);
      successCountRef.current = 0;
      return;
    }

    const ids = idsKey.split(',').filter(Boolean);
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      successCountRef.current = 0;
      try {
        const data = await taskService.getBulkRemarkDefaults(ids);
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        const fallbackById = new Map(
          selectedTasksRef.current.map((task) => [Number(task.id ?? task.taskId), task])
        );
        const apiById = new Map(
          list.map((task) => [Number(task.taskId ?? task.id), task])
        );
        const orderedIds = (ids.length > 0 ? ids : list.map((task) => task.taskId ?? task.id))
          .map((id) => Number(id))
          .filter((id) => !Number.isNaN(id));
        const uniqueIds = [...new Set(orderedIds.length > 0 ? orderedIds : [...apiById.keys()])];
        setRows(
          uniqueIds
            .map((id) => {
              const apiTask = apiById.get(id);
              const fallback = fallbackById.get(id);
              if (!apiTask && !fallback) return null;
              return toRow(apiTask || fallback, fallback);
            })
            .filter((row): row is BulkRemarkRow => !!row)
        );
      } catch (err: any) {
        if (cancelled) return;
        const fallbackRows = selectedTasksRef.current
          .map((task) => toRow(task, task))
          .filter((row) => row.taskId > 0);
        if (fallbackRows.length > 0) {
          setRows(fallbackRows);
          setLoadError(null);
        } else {
          setLoadError(err?.message || 'Failed to load selected tasks');
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, idsKey]);

  const missingRemarkCount = useMemo(
    () => rows.filter((row) => !row.remark.trim()).length,
    [rows]
  );
  const canSubmit = rows.length > 0 && missingRemarkCount === 0 && !busy && !loading;

  const updateRow = (taskId: number, patch: Partial<BulkRemarkRow>) => {
    setRows((prev) => prev.map((row) => (
      row.taskId === taskId ? { ...row, ...patch } : row
    )));
  };

  const handlePaste = (
    event: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    rowIndex: number,
    column: BulkRemarkEditableColumn
  ) => {
    const text = event.clipboardData.getData('text/plain');
    if (!text || (!text.includes('\t') && !text.includes('\n'))) return;

    event.preventDefault();
    setRows((prev) => {
      const { rows: next, invalidStageCells, validStageCells } = applyPasteGrid(
        prev,
        rowIndex,
        column,
        parseClipboardGrid(text)
      );
      return next.map((row) => {
        const key = String(row.taskId);
        if (invalidStageCells.has(key)) return { ...row, stageInvalid: true };
        if (validStageCells.has(key)) return { ...row, stageInvalid: false };
        return row;
      });
    });
  };

  const submitUpdates = async (targets: BulkRemarkRow[]) => {
    const payload = targets.map((row) => ({
      taskId: row.taskId,
      stage: row.stage,
      fileLocation: row.fileLocation,
      fileName: row.fileName,
      remark: row.remark.trim(),
    }));
    return taskService.bulkRemark(payload);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const result = await submitUpdates(rows);
      const results: Array<{ taskId: number; success: boolean; error?: string }> = result?.results || [];
      const failedIds = new Set(
        results.filter((item) => !item.success).map((item) => Number(item.taskId))
      );
      const updatedCount = Number(result?.updatedCount ?? results.filter((item) => item.success).length);

      successCountRef.current += updatedCount;

      if (failedIds.size === 0) {
        await onSuccess(successCountRef.current);
        return;
      }

      showToast(
        `${updatedCount} task${updatedCount !== 1 ? 's' : ''} updated. ${failedIds.size} failed — retry those rows.`,
        updatedCount > 0 ? 'info' : 'error'
      );
      setRows((prev) => prev
        .filter((row) => failedIds.has(row.taskId))
        .map((row) => {
          const match = results.find((item) => Number(item.taskId) === row.taskId);
          return { ...row, error: match?.error || 'Failed to update task' };
        }));
    } catch (err: any) {
      setRows((prev) => prev.map((row) => ({
        ...row,
        error: err?.message || 'Failed to update task',
      })));
    } finally {
      setBusy(false);
    }
  };

  const handleRetryRow = async (row: BulkRemarkRow) => {
    if (!row.remark.trim() || busy) return;
    setRetryingId(row.taskId);
    try {
      const result = await submitUpdates([row]);
      const item = result?.results?.[0];
      if (item?.success) {
        successCountRef.current += 1;
        const remaining = rows.filter((r) => r.taskId !== row.taskId);
        if (remaining.length === 0) {
          await onSuccess(successCountRef.current);
          return;
        }
        setRows(remaining);
      } else {
        updateRow(row.taskId, { error: item?.error || 'Failed to update task' });
      }
    } catch (err: any) {
      updateRow(row.taskId, { error: err?.message || 'Failed to update task' });
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Bulk Add Remark"
      size="2xl"
      subtitle={
        <span className="text-sm text-gray-500">
          {rows.length > 0 ? `${rows.length} task${rows.length !== 1 ? 's' : ''}` : `${Math.min(taskIds.length, MAX_BULK_ROWS_ADMIN)} selected`}
          {' · '}Paste Stage, File Location, File Name, Remark from Excel
        </span>
      }
      bodyClassName="px-5 py-4"
    >
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading selected tasks…
        </div>
      ) : loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {loadError}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Tags, task name, and description are locked. Stage uses the same options as Add Remark
            and can change Status/Progress. Only Remark is required.
          </p>

          {missingRemarkCount > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Submit is disabled until every row has a remark.
                {' '}{missingRemarkCount} row{missingRemarkCount !== 1 ? 's' : ''} still missing a remark.
              </span>
            </div>
          )}

          <div className="overflow-x-auto overflow-y-auto max-h-[55vh] border border-gray-200 rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  {['Tags', 'Task Name', 'Description', 'Stage', 'File Location', 'File Name', 'Remark'].map((header) => (
                    <th
                      key={header}
                      className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap"
                    >
                      {header}
                      {header === 'Remark' ? ' *' : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => {
                  const missingRemark = !row.remark.trim();
                  return (
                    <tr
                      key={row.taskId}
                      className={`border-t border-gray-100 ${row.error ? 'bg-red-50' : missingRemark ? 'bg-amber-50/40' : 'bg-white'}`}
                    >
                      <td className="px-3 py-2 align-top text-gray-600 min-w-[12rem] max-w-[16rem]">
                        {row.tags ? (
                          <span className="block text-xs leading-snug text-purple-700 break-words" title={row.tags}>
                            📚 {row.tags}
                          </span>
                        ) : (
                          <span className="block text-xs leading-snug text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top font-medium text-gray-900 max-w-[12rem]">
                        <span className="block leading-snug" title={row.name}>{row.name || '—'}</span>
                      </td>
                      <td className="px-3 py-2 align-top text-gray-600 max-w-[14rem]">
                        <span className="block text-xs leading-snug line-clamp-3" title={row.description}>
                          {row.description || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top min-w-[11rem]">
                        <div className="flex items-center gap-1">
                          <select
                            value={row.stage}
                            onChange={(e) => updateRow(row.taskId, { stage: e.target.value, stageInvalid: false, error: null })}
                            onPaste={(e) => handlePaste(e, rowIndex, EDITABLE_BULK_REMARK_COLUMNS[0])}
                            className={INPUT_CLASS}
                          >
                            {BULK_REMARK_STAGE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                          {row.stageInvalid && (
                            <span title="Pasted stage did not match a known option">
                              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top min-w-[10rem]">
                        <input
                          type="text"
                          value={row.fileLocation}
                          onChange={(e) => updateRow(row.taskId, { fileLocation: e.target.value, error: null })}
                          onPaste={(e) => handlePaste(e, rowIndex, EDITABLE_BULK_REMARK_COLUMNS[1])}
                          className={INPUT_CLASS}
                          placeholder="Server location"
                        />
                      </td>
                      <td className="px-3 py-2 align-top min-w-[8rem]">
                        <input
                          type="text"
                          value={row.fileName}
                          onChange={(e) => updateRow(row.taskId, { fileName: e.target.value, error: null })}
                          onPaste={(e) => handlePaste(e, rowIndex, EDITABLE_BULK_REMARK_COLUMNS[2])}
                          className={INPUT_CLASS}
                          placeholder="File name"
                        />
                      </td>
                      <td className="px-3 py-2 align-top min-w-[12rem]">
                        <textarea
                          value={row.remark}
                          onChange={(e) => updateRow(row.taskId, { remark: e.target.value, error: null })}
                          onPaste={(e) => handlePaste(e, rowIndex, EDITABLE_BULK_REMARK_COLUMNS[3])}
                          className={`${INPUT_CLASS} min-h-[2.5rem] ${missingRemark ? 'border-amber-400' : ''}`}
                          rows={2}
                          placeholder="Required remark"
                        />
                        {row.error && (
                          <div className="mt-1 flex items-center justify-between gap-2 text-xs text-red-700">
                            <span>{row.error}</span>
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              disabled={busy || missingRemark}
                              onClick={() => void handleRetryRow(row)}
                              className="border-red-300 text-red-700 hover:bg-red-50"
                            >
                              {retryingId === row.taskId ? (
                                <Loader2 className="w-3 h-3 animate-spin mr-1" />
                              ) : (
                                <RefreshCw className="w-3 h-3 mr-1" />
                              )}
                              Retry
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* TODO(Bulk Add Remark spec §7): File Location / File Name have no format validation in v1. */}
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmit()}
              loading={busy}
              disabled={!canSubmit}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <MessageSquare className="w-4 h-4 mr-1" />
              Submit {rows.length} Remark{rows.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
