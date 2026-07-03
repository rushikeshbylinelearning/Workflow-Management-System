import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Download, ChevronDown, Loader2, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';

interface TaskExportButtonProps {
  /** Currently active filters to pass to the export endpoint */
  filters: {
    status?: string;
    priorities?: string[];
    project?: string;
    stage?: string;
    dueDate?: string;
    team?: string;
    assignees?: string[];
    search?: string;
    dateRangeStart?: string;
    dateRangeEnd?: string;
  };
  /** IDs of currently selected tasks (for "Export Selected") */
  selectedTaskIds?: string[];
  /** Whether any tasks are selected */
  hasSelection?: boolean;
}

type ExportMode = 'all' | 'filtered' | 'selected';
type ExportState = 'idle' | 'loading' | 'success' | 'error';

const API_URL = import.meta.env.VITE_API_URL || 'https://workflow.bylinelms.com/api';

const getAuthHeaders = (): Record<string, string> => {
  const token = sessionStorage.getItem('access_token') || sessionStorage.getItem('teamToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const generateFilename = (): string => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `tasks_export_${now.getFullYear()}_${pad(now.getMonth() + 1)}_${pad(now.getDate())}_${pad(now.getHours())}_${pad(now.getMinutes())}.xlsx`;
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/** Portal-rendered dropdown — escapes any overflow:hidden ancestor */
function DropdownPortal({
  anchorRef,
  onClose,
  children,
}: {
  anchorRef: React.RefObject<HTMLButtonElement>;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  const reposition = useCallback(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const menuWidth = 224; // w-56 = 14rem = 224px
    const viewportWidth = window.innerWidth;

    // Prefer right-aligned; shift left if it would overflow viewport
    let left = rect.right - menuWidth;
    if (left < 8) left = rect.left;
    if (left + menuWidth > viewportWidth - 8) left = viewportWidth - menuWidth - 8;

    setCoords({
      top: rect.bottom + 8,
      left,
      width: menuWidth,
    });
  }, [anchorRef]);

  useEffect(() => {
    reposition();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [reposition]);

  // Close on outside click
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose, anchorRef]);

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: coords.top,
        left: coords.left,
        width: coords.width,
        zIndex: 9999,
        animation: 'exportDropdownIn 140ms ease-out both',
      }}
    >
      {children}
    </div>,
    document.body
  );
}

export function TaskExportButton({
  filters,
  selectedTaskIds = [],
  hasSelection = false,
}: TaskExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Auto-clear success/error state after 3 seconds
  useEffect(() => {
    if (exportState === 'success' || exportState === 'error') {
      const timer = setTimeout(() => setExportState('idle'), 3000);
      return () => clearTimeout(timer);
    }
  }, [exportState]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  const buildFilterParams = (): URLSearchParams => {
    const params = new URLSearchParams();
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters.priorities && filters.priorities.length === 1) {
      params.set('priority', filters.priorities[0]);
    } else if (filters.priorities && filters.priorities.length > 1) {
      params.set('priorityIn', filters.priorities.join(','));
    }
    if (filters.project && filters.project !== 'all') params.set('project_id', filters.project);
    if (filters.stage && filters.stage !== 'all') params.set('stage_id', filters.stage);
    if (filters.team && filters.team !== 'all') params.set('team_id', filters.team);
    if (filters.assignees && filters.assignees.length === 1 && filters.assignees[0] === 'none') {
      params.set('assignee_id', 'none');
    } else if (filters.assignees && filters.assignees.length === 1) {
      params.set('assignee_id', filters.assignees[0]);
    } else if (filters.assignees && filters.assignees.length > 1) {
      params.set('assigneeIdIn', filters.assignees.join(','));
    }
    if (filters.search) params.set('search', filters.search);
    // Add date range filters
    if (filters.dateRangeStart) params.set('dateRangeStart', filters.dateRangeStart);
    if (filters.dateRangeEnd) params.set('dateRangeEnd', filters.dateRangeEnd);
    
    return params;
  };

  const handleExport = async (mode: ExportMode) => {
    setIsOpen(false);
    setExportState('loading');
    setErrorMessage('');

    try {
      let response: Response;

      if (mode === 'selected') {
        if (selectedTaskIds.length === 0) {
          setExportState('error');
          setErrorMessage('No tasks selected');
          return;
        }
        response = await fetch(`${API_URL}/tasks/export/selected`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ taskIds: selectedTaskIds.map(id => parseInt(id, 10)) }),
        });
      } else {
        const params = mode === 'filtered' ? buildFilterParams() : new URLSearchParams();
        const url = `${API_URL}/tasks/export${params.toString() ? `?${params.toString()}` : ''}`;
        response = await fetch(url, { method: 'GET', headers: getAuthHeaders() });
      }

      if (!response.ok) {
        let errMsg = `Export failed (${response.status})`;
        try {
          const errData = await response.json();
          errMsg = errData.error?.message || errData.message || errMsg;
        } catch { /* ignore */ }
        throw new Error(errMsg);
      }

      const blob = await response.blob();
      if (blob.size === 0) throw new Error('Received empty file from server');

      downloadBlob(blob, generateFilename());
      setExportState('success');
    } catch (err: any) {
      console.error('Export error:', err);
      setExportState('error');
      setErrorMessage(err.message || 'Export failed. Please try again.');
    }
  };

  const isLoading = exportState === 'loading';

  const hasActiveFilters = Object.entries(filters).some(
    ([, val]) => val && val !== 'all' && val !== ''
  );

  // Button appearance based on state
  const buttonClass = [
    'inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border',
    'transition-all duration-150 select-none focus:outline-none focus:ring-2 focus:ring-offset-1',
    isLoading
      ? 'bg-white/10 border-white/20 text-white/50 cursor-not-allowed'
      : exportState === 'success'
        ? 'bg-green-500/20 border-green-400/40 text-green-300 hover:bg-green-500/30 focus:ring-green-400'
        : exportState === 'error'
          ? 'bg-red-500/20 border-red-400/40 text-red-300 hover:bg-red-500/30 focus:ring-red-400'
          : 'bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/30 focus:ring-white/40',
  ].join(' ');

  return (
    /* Wrapper — no overflow:hidden, no relative positioning needed for dropdown */
    <div className="flex items-center">
      <button
        ref={buttonRef}
        onClick={() => !isLoading && setIsOpen(prev => !prev)}
        disabled={isLoading}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className={buttonClass}
        title={exportState === 'error' ? errorMessage : 'Export tasks to Excel'}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Exporting…</span>
          </>
        ) : exportState === 'success' ? (
          <>
            <CheckCircle className="w-4 h-4" />
            <span>Exported!</span>
          </>
        ) : exportState === 'error' ? (
          <>
            <AlertCircle className="w-4 h-4" />
            <span>Failed</span>
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            <span>Export</span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            />
          </>
        )}
      </button>

      {/* Portal dropdown — renders directly on <body>, escapes overflow:hidden */}
      {isOpen && !isLoading && (
        <DropdownPortal anchorRef={buttonRef} onClose={() => setIsOpen(false)}>
          <div className="bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
              <FileSpreadsheet className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Export Options
              </span>
            </div>

            <div className="py-1">
              {/* Export All */}
              <button
                onClick={() => handleExport('all')}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors group"
              >
                <div className="mt-0.5 p-1 rounded-md bg-gray-100 group-hover:bg-gray-200 transition-colors shrink-0">
                  <Download className="w-3.5 h-3.5 text-gray-600" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-800">Export All</div>
                  <div className="text-xs text-gray-500 mt-0.5">Every task in the system</div>
                </div>
              </button>

              {/* Export Filtered */}
              <button
                onClick={() => hasActiveFilters && handleExport('filtered')}
                className={[
                  'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors group',
                  hasActiveFilters
                    ? 'hover:bg-indigo-50 active:bg-indigo-100 cursor-pointer'
                    : 'opacity-40 cursor-not-allowed',
                ].join(' ')}
                disabled={!hasActiveFilters}
                title={!hasActiveFilters ? 'Apply at least one filter first' : 'Export tasks matching current filters'}
              >
                <div className={[
                  'mt-0.5 p-1 rounded-md shrink-0 transition-colors',
                  hasActiveFilters ? 'bg-indigo-100 group-hover:bg-indigo-200' : 'bg-gray-100',
                ].join(' ')}>
                  <Download className={`w-3.5 h-3.5 ${hasActiveFilters ? 'text-indigo-600' : 'text-gray-400'}`} />
                </div>
                <div>
                  <div className={`text-sm font-semibold ${hasActiveFilters ? 'text-indigo-700' : 'text-gray-400'}`}>
                    Export Filtered
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {hasActiveFilters ? 'Tasks matching active filters' : 'No active filters applied'}
                  </div>
                </div>
              </button>

              {/* Divider */}
              <div className="mx-4 border-t border-gray-100 my-1" />

              {/* Export Selected */}
              <button
                onClick={() => hasSelection && handleExport('selected')}
                className={[
                  'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors group',
                  hasSelection
                    ? 'hover:bg-blue-50 active:bg-blue-100 cursor-pointer'
                    : 'opacity-40 cursor-not-allowed',
                ].join(' ')}
                disabled={!hasSelection}
                title={!hasSelection ? 'Select tasks first using the checkboxes' : `Export ${selectedTaskIds.length} selected task(s)`}
              >
                <div className={[
                  'mt-0.5 p-1 rounded-md shrink-0 transition-colors',
                  hasSelection ? 'bg-blue-100 group-hover:bg-blue-200' : 'bg-gray-100',
                ].join(' ')}>
                  <Download className={`w-3.5 h-3.5 ${hasSelection ? 'text-blue-600' : 'text-gray-400'}`} />
                </div>
                <div>
                  <div className={`text-sm font-semibold ${hasSelection ? 'text-blue-700' : 'text-gray-400'}`}>
                    Export Selected
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {hasSelection
                      ? `${selectedTaskIds.length} task${selectedTaskIds.length !== 1 ? 's' : ''} selected`
                      : 'No tasks selected'}
                  </div>
                </div>
              </button>
            </div>

            {/* Footer */}
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-gray-400">Exports as .xlsx · 6 sheets</p>
            </div>
          </div>
        </DropdownPortal>
      )}

      {/* Error tooltip — also portal-rendered */}
      {exportState === 'error' && errorMessage && (
        <DropdownPortal anchorRef={buttonRef} onClose={() => setExportState('idle')}>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 shadow-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700">{errorMessage}</p>
            </div>
          </div>
        </DropdownPortal>
      )}
    </div>
  );
}
