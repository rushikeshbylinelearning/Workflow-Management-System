import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, MessageSquare, RefreshCw } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { useToast } from './ui/Toast';
import { taskService } from '../services/apiService';
import {
  applyPasteGrid,
  BULK_REMARK_STAGE_OPTIONS,
  ADMIN_BULK_REMARK_DECISIONS,
  formatTaskTags,
  isClaudeAccountField,
  MAX_BULK_ROWS_ADMIN,
  parseClipboardGrid,
  statusToRemarkStage,
} from '../utils/bulkRemark';
import { useRemarkOptions } from '../hooks/useRemarkOptions';
import { missingRequiredRemarkFields, useRemarkFields } from '../hooks/useRemarkFields';

interface BulkRemarkModalProps {
  isOpen: boolean;
  taskIds: Array<string | number>;
  selectedTasks?: any[];
  onClose: () => void;
  onSuccess: (updatedCount: number) => Promise<void> | void;
  /** Admin bulk remark adds Approve / Reject / Resubmit and hides Claude Account. */
  adminMode?: boolean;
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
  extra: Record<string, string>;
  stageInvalid?: boolean;
  error?: string | null;
}

const INPUT_CLASS =
  'w-full min-w-[8rem] px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent';

function toRow(task: any, fallback?: any, options?: { prefillFiles?: boolean }): BulkRemarkRow {
  const merged = { ...fallback, ...task };
  // Assignees always enter a fresh location/name for new remarks — never pre-fill prior values.
  const prefillFiles = options?.prefillFiles === true;
  return {
    taskId: Number(merged.taskId ?? merged.id),
    tags: formatTaskTags(task) || formatTaskTags(fallback) || formatTaskTags(merged),
    name: merged.name || fallback?.name || '',
    description: merged.description || fallback?.description || '',
    stage: statusToRemarkStage(merged.stage || merged.status),
    fileLocation: prefillFiles ? (merged.fileLocation || merged.server_location || '') : '',
    fileName: prefillFiles ? (merged.fileName || merged.file_name || '') : '',
    remark: '',
    extra: {},
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
  adminMode = false,
}: BulkRemarkModalProps) {
  const [rows, setRows] = useState<BulkRemarkRow[]>([]);
  const [sharedRemarkMode, setSharedRemarkMode] = useState(false);
  const [sharedRemark, setSharedRemark] = useState('');
  const [sharedStage, setSharedStage] = useState('');
  const [sharedFileLocation, setSharedFileLocation] = useState('');
  const [sharedFileName, setSharedFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const { showToast } = useToast();
  const { options: stageOptions } = useRemarkOptions();
  const { fields: extraFieldDefs, enforceRequired } = useRemarkFields();
  const visibleExtraFields = adminMode
    ? extraFieldDefs.filter((field) => !isClaudeAccountField(field))
    : extraFieldDefs;
  const extraSlugs = visibleExtraFields.map((field) => field.slug);
  const stageCatalog = adminMode
    ? ADMIN_BULK_REMARK_DECISIONS
    : (stageOptions.length > 0 ? stageOptions : BULK_REMARK_STAGE_OPTIONS);
  const successCountRef = useRef(0);
  const selectedTasksRef = useRef(selectedTasks);
  selectedTasksRef.current = selectedTasks;
  const idsKey = taskIds.join(',');

  useEffect(() => {
    if (!isOpen) {
      setRows([]);
      setSharedRemarkMode(false);
      setSharedRemark('');
      setSharedStage('');
      setSharedFileLocation('');
      setSharedFileName('');
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
              const row = toRow(apiTask || fallback, fallback, { prefillFiles: adminMode });
              return adminMode ? { ...row, stage: '' } : row;
            })
            .filter((row): row is BulkRemarkRow => !!row)
        );
      } catch (err: any) {
        if (cancelled) return;
        const fallbackRows = selectedTasksRef.current
          .map((task) => {
            const row = toRow(task, task, { prefillFiles: adminMode });
            return adminMode ? { ...row, stage: '' } : row;
          })
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
  }, [isOpen, idsKey, adminMode]);

  const useOneRemark = !adminMode && sharedRemarkMode;
  const missingRemarkCount = useMemo(
    () => (useOneRemark
      ? (sharedRemark.trim() ? 0 : rows.length)
      : rows.filter((row) => !row.remark.trim()).length),
    [rows, useOneRemark, sharedRemark]
  );
  const missingExtraCount = useMemo(
    () => rows.filter((row) => missingRequiredRemarkFields(visibleExtraFields, row.extra || {}, enforceRequired).length > 0).length,
    [rows, visibleExtraFields, enforceRequired]
  );
  const missingDecisionCount = useMemo(
    () => (adminMode ? rows.filter((row) => !['approve', 'reject', 'resubmit'].includes(row.stage)).length : 0),
    [adminMode, rows]
  );
  const canSubmit = rows.length > 0 && missingRemarkCount === 0 && missingExtraCount === 0 && missingDecisionCount === 0 && !busy && !loading;

  const updateRow = (taskId: number, patch: Partial<BulkRemarkRow>) => {
    setRows((prev) => prev.map((row) => (
      row.taskId === taskId ? { ...row, ...patch } : row
    )));
  };

  const handlePaste = (
    event: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    rowIndex: number,
    column: string
  ) => {
    const text = event.clipboardData.getData('text/plain');
    if (!text || (!text.includes('\t') && !text.includes('\n'))) return;

    event.preventDefault();
    setRows((prev) => {
      const { rows: next, invalidStageCells, validStageCells } = applyPasteGrid(
        prev,
        rowIndex,
        column,
        parseClipboardGrid(text),
        stageCatalog,
        extraSlugs
      );
      return next.map((row) => {
        const key = String(row.taskId);
        if (invalidStageCells.has(key)) return { ...row, stageInvalid: true };
        if (validStageCells.has(key)) return { ...row, stageInvalid: false };
        return row;
      });
    });
  };

  const rowsWithRemark = (targets: BulkRemarkRow[]) => (
    useOneRemark
      ? targets.map((row) => ({
          ...row,
          remark: sharedRemark,
          stage: sharedStage.trim() || row.stage,
          fileLocation: sharedFileLocation.trim() || row.fileLocation,
          fileName: sharedFileName.trim() || row.fileName,
        }))
      : targets
  );

  const submitUpdates = async (targets: BulkRemarkRow[]) => {
    const payload = rowsWithRemark(targets).map((row) => ({
      taskId: row.taskId,
      stage: row.stage,
      fileLocation: row.fileLocation,
      fileName: row.fileName,
      remark: row.remark.trim(),
      extraFields: row.extra || {},
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
    const remark = useOneRemark ? sharedRemark.trim() : row.remark.trim();
    if (!remark || busy) return;
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
          {useOneRemark
            ? ' · One remark, stage, file location, and file name can apply to every task'
            : (
              <>
                {' · '}Paste Stage, File Location, File Name
                {visibleExtraFields.length > 0 ? `, ${visibleExtraFields.map((field) => field.label).join(', ')}` : ''}
                {', Remark from Excel'}
              </>
            )}
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
          {!adminMode && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-purple-900">Same details for all selected tasks</p>
                <p className="text-xs text-purple-700">
                  Turn this on to set one remark, and optionally one stage, file location, and file name, for every selected task.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={sharedRemarkMode}
                aria-label="Use one remark for all selected tasks"
                onClick={() => {
                  setSharedRemarkMode((current) => {
                    if (current) {
                      setRows((prev) => prev.map((row) => ({
                        ...row,
                        remark: row.remark.trim() ? row.remark : sharedRemark,
                        stage: sharedStage.trim() || row.stage,
                        fileLocation: sharedFileLocation.trim() || row.fileLocation,
                        fileName: sharedFileName.trim() || row.fileName,
                      })));
                      return false;
                    }
                    const filled = rows.map((row) => row.remark.trim()).filter(Boolean);
                    const unique = new Set(filled);
                    if (unique.size === 1) setSharedRemark([...unique][0]);
                    return true;
                  });
                }}
                className={`relative box-border h-6 w-11 shrink-0 overflow-hidden rounded-full border-0 p-0 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${sharedRemarkMode ? 'bg-purple-600' : 'bg-gray-300'}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${sharedRemarkMode ? 'left-5' : 'left-0.5'}`}
                />
              </button>
            </div>
          )}

          {useOneRemark && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stage <span className="font-normal text-gray-400">(optional)</span>
                  </label>
                  <select
                    value={sharedStage}
                    onChange={(e) => setSharedStage(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Keep each task&apos;s stage</option>
                    {stageCatalog.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    File location <span className="font-normal text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={sharedFileLocation}
                    onChange={(e) => setSharedFileLocation(e.target.value)}
                    placeholder="Keep each task's location"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    File name <span className="font-normal text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={sharedFileName}
                    onChange={(e) => setSharedFileName(e.target.value)}
                    placeholder="Keep each task's file name"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Remark for all {rows.length} task{rows.length !== 1 ? 's' : ''}
                </label>
                <textarea
                  value={sharedRemark}
                  onChange={(e) => setSharedRemark(e.target.value)}
                  rows={4}
                  placeholder="This remark is added to every selected task"
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent ${sharedRemark.trim() ? 'border-gray-300' : 'border-amber-400'}`}
                />
              </div>
            </div>
          )}

          <p className="text-sm text-gray-600">
            Tags, task name, and description are locked.
            {adminMode
              ? ' The assignee stays as assigned. Choose Approve, Reject, or Resubmit for each row. That choice updates Status/Progress.'
              : useOneRemark
                ? ' Stage, file location, and file name are optional. Leave a field blank to keep each task’s current value. Stage can change Status/Progress.'
                : ' Stage uses the same options as Add Remark and can change Status/Progress.'}
            {' '}Only Remark is required
            {enforceRequired && visibleExtraFields.some((field) => field.is_required)
              ? ', plus any extra required fields assigned to you'
              : ''}
            .
            {visibleExtraFields.length > 0
              ? ' Extra fields assigned in Access Management appear as additional columns and are included in Teams updates.'
              : ''}
          </p>

          {missingDecisionCount > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Choose Approve, Reject, or Resubmit for every row.
                {' '}{missingDecisionCount} row{missingDecisionCount !== 1 ? 's' : ''} still need a decision.
              </span>
            </div>
          )}
          {missingRemarkCount > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                {useOneRemark
                  ? 'Submit is disabled until the shared remark is filled in.'
                  : (
                    <>
                      Submit is disabled until every row has a remark.
                      {' '}{missingRemarkCount} row{missingRemarkCount !== 1 ? 's' : ''} still missing a remark.
                    </>
                  )}
              </span>
            </div>
          )}
          {missingExtraCount > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Fill every required extra field before submitting.
                {' '}{missingExtraCount} row{missingExtraCount !== 1 ? 's' : ''} still missing required extra data.
              </span>
            </div>
          )}

          <div className="overflow-x-auto overflow-y-auto max-h-[55vh] border border-gray-200 rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  {(useOneRemark
                    ? ['Tags', 'Task Name', 'Description']
                    : ['Tags', 'Task Name', 'Description', adminMode ? 'Decision' : 'Stage', 'File Location', 'File Name']
                  ).map((header) => (
                    <th
                      key={header}
                      className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap"
                    >
                      {header}
                    </th>
                  ))}
                  {visibleExtraFields.map((field) => (
                    <th
                      key={field.slug}
                      className="px-3 py-2 text-left text-xs font-semibold text-indigo-700 uppercase tracking-wide whitespace-nowrap"
                    >
                      {field.label}
                      {enforceRequired && field.is_required ? ' *' : ''}
                    </th>
                  ))}
                  {!useOneRemark && (
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">
                      Remark *
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => {
                  const missingRemark = useOneRemark ? !sharedRemark.trim() : !row.remark.trim();
                  const missingDecision = adminMode && !['approve', 'reject', 'resubmit'].includes(row.stage);
                  return (
                    <tr
                      key={row.taskId}
                      className={`border-t border-gray-100 ${row.error ? 'bg-red-50' : (!useOneRemark && missingRemark) || missingDecision ? 'bg-amber-50/40' : 'bg-white'}`}
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
                        {useOneRemark && row.error && (
                          <div className="mt-1 flex items-center justify-between gap-2 text-xs font-normal text-red-700">
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
                      <td className="px-3 py-2 align-top text-gray-600 max-w-[14rem]">
                        <span className="block text-xs leading-snug line-clamp-3" title={row.description}>
                          {row.description || '—'}
                        </span>
                      </td>
                      {!useOneRemark && (
                        <>
                          <td className="px-3 py-2 align-top min-w-[11rem]">
                            <div className="flex items-center gap-1">
                              <select
                                value={row.stage}
                                onChange={(e) => updateRow(row.taskId, { stage: e.target.value, stageInvalid: false, error: null })}
                                onPaste={(e) => handlePaste(e, rowIndex, 'stage')}
                                className={`${INPUT_CLASS} ${missingDecision ? 'border-amber-400' : ''}`}
                              >
                                {adminMode && !row.stage && (
                                  <option value="">Select</option>
                                )}
                                {([
                                  ...stageCatalog,
                                  ...(stageCatalog.some((option) => option.value === row.stage) || (adminMode && !row.stage)
                                    ? []
                                    : [{ value: row.stage, label: row.stage }]),
                                ]).map((option) => (
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
                              onPaste={(e) => handlePaste(e, rowIndex, 'fileLocation')}
                              className={INPUT_CLASS}
                              placeholder="Server location"
                            />
                          </td>
                          <td className="px-3 py-2 align-top min-w-[8rem]">
                            <input
                              type="text"
                              value={row.fileName}
                              onChange={(e) => updateRow(row.taskId, { fileName: e.target.value, error: null })}
                              onPaste={(e) => handlePaste(e, rowIndex, 'fileName')}
                              className={INPUT_CLASS}
                              placeholder="File name"
                            />
                          </td>
                        </>
                      )}
                      {visibleExtraFields.map((field) => {
                        const extraMissing = enforceRequired && field.is_required && !String(row.extra?.[field.slug] || '').trim();
                        return (
                          <td key={field.slug} className="px-3 py-2 align-top min-w-[9rem]">
                            <input
                              type="text"
                              value={row.extra?.[field.slug] || ''}
                              onChange={(e) => updateRow(row.taskId, {
                                extra: { ...(row.extra || {}), [field.slug]: e.target.value },
                                error: null,
                              })}
                              onPaste={(e) => handlePaste(e, rowIndex, field.slug)}
                              className={`${INPUT_CLASS} ${extraMissing ? 'border-amber-400' : ''}`}
                              placeholder={field.label}
                            />
                          </td>
                        );
                      })}
                      {!useOneRemark && (
                        <td className="px-3 py-2 align-top min-w-[12rem]">
                          <textarea
                            value={row.remark}
                            onChange={(e) => updateRow(row.taskId, { remark: e.target.value, error: null })}
                            onPaste={(e) => handlePaste(e, rowIndex, 'remark')}
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
                      )}
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
