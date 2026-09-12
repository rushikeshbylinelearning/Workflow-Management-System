import React, { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, X, AlertCircle, CheckCircle, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projects: any[];
  teamMembers: any[];
}

interface ParsedRow {
  rowIndex: number;
  'Task Name': string;
  Description?: string;
  Project: string;
  Stage: string;
  Status?: string;
  Priority?: string;
  'Estimated Hours'?: number | string;
  'Start Date'?: string;
  'Due Date'?: string;
  Assignees?: string;
  'File Location'?: string;
  Grade?: string;
  Book?: string;
  Unit?: string;
  Lesson?: string;
}

interface RowError {
  row: number;
  error: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_STATUSES = ['not-started', 'in-progress', 'under-review', 'completed', 'blocked', 'skipped'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const MAX_ROWS = 500;
const MAX_FILE_SIZE_MB = 2;

const STATUS_DISPLAY: Record<string, string> = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  'under-review': 'Under Review',
  completed: 'Completed',
  blocked: 'Blocked',
  skipped: 'Skipped',
};

// ─── Template download ────────────────────────────────────────────────────────

function downloadTemplate() {
  const headers = [
    'Task Name',
    'Description',
    'Project',
    'Stage',
    'Status',
    'Priority',
    'Estimated Hours',
    'Start Date',
    'Due Date',
    'Assignees',
    'File Location',
    'Grade',
    'Book',
    'Unit',
    'Lesson',
  ];

  const example = [
    'Design Homepage',
    'Create wireframes for the homepage',
    'My Project Name',
    'Plan',
    'not-started',
    'medium',
    '8',
    '2026-04-15',
    '2026-04-22',
    'john@example.com, jane@example.com',
    '\\\\Server\\Projects\\Byline\\Assets',
    'Grade 1',
    'Math Book 1',
    'Numbers',
    'Counting 1-10',
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, example]);

  // Column widths
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 18) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tasks');
  XLSX.writeFile(wb, 'bulk_tasks_template.xlsx');
}

// ─── Frontend validation ──────────────────────────────────────────────────────

function validateRows(rows: ParsedRow[]): RowError[] {
  const errors: RowError[] = [];

  rows.forEach((row) => {
    const r = row.rowIndex;

    if (!row['Task Name']?.toString().trim()) {
      errors.push({ row: r, error: 'Task Name is required' });
    }
    if (!row['Project']?.toString().trim()) {
      errors.push({ row: r, error: 'Project is required' });
    }
    if (row['Status']) {
      const s = row['Status'].toString().toLowerCase().trim().replace(/\s+/g, '-');
      if (!VALID_STATUSES.includes(s)) {
        errors.push({ row: r, error: `Invalid Status "${row['Status']}". Must be one of: ${VALID_STATUSES.join(', ')}` });
      }
    }

    if (row['Priority']) {
      const p = row['Priority'].toString().toLowerCase().trim().replace(/\s+/g, '-');
      if (!VALID_PRIORITIES.includes(p)) {
        errors.push({ row: r, error: `Invalid Priority "${row['Priority']}". Must be one of: ${VALID_PRIORITIES.join(', ')}` });
      }
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (row['Start Date'] && !dateRegex.test(row['Start Date'].toString().trim())) {
      errors.push({ row: r, error: `Invalid Start Date format. Use YYYY-MM-DD` });
    }
    if (row['Due Date'] && !dateRegex.test(row['Due Date'].toString().trim())) {
      errors.push({ row: r, error: `Invalid Due Date format. Use YYYY-MM-DD` });
    }

    if (row['Estimated Hours'] !== undefined && row['Estimated Hours'] !== '') {
      const h = Number(row['Estimated Hours']);
      if (isNaN(h) || h < 0) {
        errors.push({ row: r, error: 'Estimated Hours must be a positive number' });
      }
    }

    const grade = row.Grade?.toString().trim();
    const book = row.Book?.toString().trim();
    const unit = row.Unit?.toString().trim();
    const lesson = row.Lesson?.toString().trim();
    if ((book || unit || lesson) && !grade) {
      errors.push({ row: r, error: 'Grade is required when Book, Unit, or Lesson is provided' });
    }
    if ((unit || lesson) && !book) {
      errors.push({ row: r, error: 'Book is required when Unit or Lesson is provided' });
    }
    if (lesson && !unit) {
      errors.push({ row: r, error: 'Unit is required when Lesson is provided' });
    }
  });

  return errors;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BulkUploadModal({ isOpen, onClose, onSuccess, projects, teamMembers }: BulkUploadModalProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'submitting' | 'done'>('upload');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<RowError[]>([]);
  const [serverErrors, setServerErrors] = useState<RowError[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep('upload');
    setParsedRows([]);
    setValidationErrors([]);
    setServerErrors([]);
    setUploadError(null);
    setFileName(null);
    setSuccessCount(0);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const parseFile = useCallback((file: File) => {
    setUploadError(null);

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setUploadError(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      setUploadError('Only .xlsx, .xls, and .csv files are supported.');
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'binary', cellDates: true, dateNF: 'yyyy-mm-dd' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false, dateNF: 'yyyy-mm-dd' });

        if (json.length === 0) {
          setUploadError('The file is empty or has no data rows.');
          return;
        }

        if (json.length > MAX_ROWS) {
          setUploadError(`File contains ${json.length} rows. Maximum allowed is ${MAX_ROWS}.`);
          return;
        }

        // Normalize date fields (XLSX may parse them as Date objects, serial numbers, or various string formats)
        const rows: ParsedRow[] = json.map((row, i) => {
          // Format a Date as YYYY-MM-DD using LOCAL date parts to avoid UTC offset shifting the day
          const dateToLocalYMD = (d: Date): string => {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
          };

          // Parse any date value into YYYY-MM-DD, preserving the calendar date as-is
          const parseDate = (val: any): string => {
            if (!val && val !== 0) return '';
            // Already a Date object (cellDates:true)
            if (val instanceof Date) return dateToLocalYMD(val);
            const s = val.toString().trim();
            if (!s) return '';
            // Already YYYY-MM-DD
            if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
            // M/D/YYYY or MM/DD/YYYY (US format from Excel display)
            const mdyMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (mdyMatch) {
              const [, m, d, y] = mdyMatch;
              return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }
            // D/M/YYYY or DD/MM/YYYY (try as fallback — less common in US Excel)
            // Excel serial number (numeric string)
            if (/^\d+$/.test(s)) {
              const serial = parseInt(s, 10);
              // Excel epoch: Jan 1 1900 = serial 1 (with leap year bug: serial 60 = Feb 29 1900 which didn't exist)
              const excelEpoch = new Date(1899, 11, 30); // Dec 30 1899
              const d = new Date(excelEpoch.getTime() + serial * 86400000);
              return dateToLocalYMD(d);
            }
            // Fallback: let JS parse it but use local parts
            const parsed = new Date(s);
            if (!isNaN(parsed.getTime())) return dateToLocalYMD(parsed);
            return s; // return as-is, validation will catch bad formats
          };

          const normalize = (val: any): string => {
            if (!val) return '';
            if (val instanceof Date) return dateToLocalYMD(val);
            return val.toString().trim();
          };

          const normalizeStatus = (val: any): string => {
            if (!val) return 'not-started';
            return val.toString().toLowerCase().trim().replace(/\s+/g, '-');
          };

          const normalizePriority = (val: any): string => {
            if (!val) return 'medium';
            return val.toString().toLowerCase().trim();
          };

          return {
            rowIndex: i + 2, // 1-indexed, row 1 = header
            'Task Name': normalize(row['Task Name']),
            Description: normalize(row['Description']),
            Project: normalize(row['Project']),
            Stage: normalize(row['Stage']),
            Status: normalizeStatus(row['Status']),
            Priority: normalizePriority(row['Priority']),
            'Estimated Hours': row['Estimated Hours'] !== '' ? row['Estimated Hours'] : undefined,
            'Start Date': parseDate(row['Start Date']) || dateToLocalYMD(new Date()),
            'Due Date': parseDate(row['Due Date']) || dateToLocalYMD(new Date(Date.now() + 7 * 86400000)),
            Assignees: normalize(row['Assignees']),
            'File Location': normalize(row['File Location']),
            Grade: normalize(row.Grade ?? row['Level 1 (Grade)']),
            Book: normalize(row.Book ?? row['Level 2 (Book)']),
            Unit: normalize(row.Unit ?? row['Level 3 (Unit)']),
            Lesson: normalize(row.Lesson ?? row['Level 4 (Lesson)']),
          };
        });

        const errors = validateRows(rows);
        setParsedRows(rows);
        setValidationErrors(errors);
        setStep('preview');
      } catch (err) {
        setUploadError('Failed to parse file. Please ensure it is a valid Excel or CSV file.');
      }
    };
    reader.readAsBinaryString(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  };

  const handleSubmit = async () => {
    if (validationErrors.length > 0) return;

    setStep('submitting');
    setServerErrors([]);

    try {
      const token = sessionStorage.getItem('access_token') || sessionStorage.getItem('teamToken');
      const API_URL = import.meta.env.VITE_API_URL || 'https://workflow.bylinelms.com/api';

      const response = await fetch(`${API_URL}/tasks/bulk-upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(parsedRows),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.errors && Array.isArray(result.errors)) {
          setServerErrors(result.errors);
          setStep('preview');
        } else {
          setServerErrors([{ row: 0, error: result.error || result.message || 'Upload failed' }]);
          setStep('preview');
        }
        return;
      }

      setSuccessCount(result.created || parsedRows.length);
      setStep('done');
      onSuccess();
    } catch (err: any) {
      setServerErrors([{ row: 0, error: err.message || 'Network error. Please try again.' }]);
      setStep('preview');
    }
  };

  const errorRowSet = new Set([...validationErrors, ...serverErrors].map((e) => e.row));

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Bulk Upload Tasks" size="xl">
      <div className="space-y-5">
        {/* ── Step: Upload ── */}
        {step === 'upload' && (
          <>
            {/* Download template */}
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div>
                <p className="text-sm font-semibold text-blue-800">Step 1 — Download the template</p>
                <p className="text-xs text-blue-600 mt-0.5">Fill in the Excel template and upload it below.</p>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="w-4 h-4 mr-2" />
                Download Template
              </Button>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
              }`}
            >
              <FileSpreadsheet className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700">Drag & drop your file here, or click to browse</p>
              <p className="text-xs text-gray-400 mt-1">Supports .xlsx, .xls, .csv — max {MAX_FILE_SIZE_MB}MB, {MAX_ROWS} rows</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {uploadError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {uploadError}
              </div>
            )}

            {/* Template field reference */}
            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
              <p className="font-semibold text-gray-700 mb-1">Template columns:</p>
              <p>Task Name* | Description | Project* | Stage* | Status | Priority | Estimated Hours | Start Date (YYYY-MM-DD) | Due Date (YYYY-MM-DD) | Assignees (comma-separated emails) | File Location | Grade | Book | Unit | Lesson</p>
              <p className="mt-1">Optional hierarchy columns auto-tag tasks to Educational Hierarchy (names must match existing hierarchy for the project).</p>
              <p className="mt-1">Valid Status: {VALID_STATUSES.join(', ')}</p>
              <p>Valid Priority: {VALID_PRIORITIES.join(', ')}</p>
            </div>
          </>
        )}

        {/* ── Step: Preview ── */}
        {step === 'preview' && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-semibold text-gray-800">{fileName}</p>
                  <p className="text-xs text-gray-500">{parsedRows.length} rows parsed</p>
                </div>
              </div>
              <button
                onClick={reset}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                <Upload className="w-3 h-3" /> Upload different file
              </button>
            </div>

            {/* Validation errors panel */}
            {(validationErrors.length > 0 || serverErrors.length > 0) && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-36 overflow-y-auto">
                <p className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {validationErrors.length + serverErrors.length} error(s) found — fix and re-upload
                </p>
                {[...validationErrors, ...serverErrors].map((e, i) => (
                  <p key={i} className="text-xs text-red-600">
                    {e.row > 0 ? `Row ${e.row}: ` : ''}{e.error}
                  </p>
                ))}
              </div>
            )}

            {validationErrors.length === 0 && serverErrors.length === 0 && (
              <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
                <CheckCircle className="w-4 h-4" />
                All {parsedRows.length} rows passed validation. Ready to submit.
              </div>
            )}

            {/* Preview table */}
            <div className="overflow-auto max-h-72 border border-gray-200 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">#</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Task Name</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Project</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Stage</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Status</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Priority</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Start Date</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Due Date</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Assignees</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">File Location</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Grade</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Book</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Unit</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Lesson</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {parsedRows.map((row) => {
                    const hasError = errorRowSet.has(row.rowIndex);
                    return (
                      <tr key={row.rowIndex} className={hasError ? 'bg-red-50' : 'hover:bg-gray-50'}>
                        <td className="px-3 py-2 text-gray-400">{row.rowIndex}</td>
                        <td className="px-3 py-2 font-medium text-gray-800 max-w-[160px] truncate">{row['Task Name']}</td>
                        <td className="px-3 py-2 text-gray-600 max-w-[120px] truncate">{row['Project']}</td>
                        <td className="px-3 py-2 text-gray-600">{row['Stage']}</td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            row['Status'] === 'completed' ? 'bg-green-100 text-green-700' :
                            row['Status'] === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                            row['Status'] === 'blocked' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {STATUS_DISPLAY[row['Status'] || ''] || row['Status']}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600 capitalize">{row['Priority']}</td>
                        <td className="px-3 py-2 text-gray-600">{row['Start Date']}</td>
                        <td className="px-3 py-2 text-gray-600">{row['Due Date']}</td>
                        <td className="px-3 py-2 text-gray-500 max-w-[140px] truncate">{row['Assignees']}</td>
                        <td className="px-3 py-2 text-gray-500 max-w-[160px] truncate font-mono text-xs">{row['File Location'] || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2 text-purple-600 max-w-[100px] truncate">{row.Grade || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2 text-purple-600 max-w-[100px] truncate">{row.Book || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2 text-purple-600 max-w-[100px] truncate">{row.Unit || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2 text-purple-600 max-w-[100px] truncate">{row.Lesson || <span className="text-gray-300">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={handleSubmit}
                disabled={validationErrors.length > 0}
                className={validationErrors.length > 0 ? 'opacity-50 cursor-not-allowed' : ''}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload {parsedRows.length} Task{parsedRows.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </>
        )}

        {/* ── Step: Submitting ── */}
        {step === 'submitting' && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            <p className="text-sm font-medium text-gray-700">Uploading {parsedRows.length} tasks...</p>
            <p className="text-xs text-gray-400">Please wait, this may take a moment.</p>
          </div>
        )}

        {/* ── Step: Done ── */}
        {step === 'done' && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-9 h-9 text-green-600" />
            </div>
            <p className="text-lg font-semibold text-gray-800">{successCount} Task{successCount !== 1 ? 's' : ''} Created Successfully</p>
            <p className="text-sm text-gray-500">The task list has been refreshed.</p>
            <Button onClick={handleClose}>
              <X className="w-4 h-4 mr-2" />
              Close
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}