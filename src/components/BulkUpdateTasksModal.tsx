import React, { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, X, AlertCircle, CheckCircle, FileSpreadsheet, Loader2, Edit2 } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

interface BulkUpdateTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedRow {
  rowIndex: number;
  'Task ID': string;
  'Task Name'?: string;
  Description?: string;
  Project?: string;
  Stage?: string;
  Status?: string;
  Priority?: string;
  'Estimated Hours'?: string;
  'Actual Hours'?: string;
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

const VALID_STATUSES = [
  'not-started',
  'in-progress',
  'under-review',
  'completed',
  'blocked',
  'skipped',
  'returned',
  'redo-requested',
  'resubmitted',
  'on-hold',
];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const MAX_ROWS = 1000;
const MAX_FILE_SIZE_MB = 2;
const NAME_MAX = 255;
const DESCRIPTION_MAX = 5000;
const LOCATION_MAX = 500;

const STATUS_DISPLAY: Record<string, string> = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  'under-review': 'Under Review',
  completed: 'Completed',
  blocked: 'Blocked',
  skipped: 'Skipped',
  returned: 'Returned',
  'redo-requested': 'Redo Requested',
  resubmitted: 'Resubmitted',
  'on-hold': 'On Hold',
};

const TEMPLATE_HEADERS = [
  'Task ID',
  'Task Name',
  'Description',
  'Project',
  'Stage',
  'Status',
  'Priority',
  'Estimated Hours',
  'Actual Hours',
  'Start Date',
  'Due Date',
  'Assignees',
  'File Location',
  'Grade',
  'Book',
  'Unit',
  'Lesson',
];

function downloadTemplate() {
  const examplePartial = [
    '1234',
    'Updated task name',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ];
  const exampleFull = [
    '1235',
    'Rewrite lesson intro',
    'Optional new description',
    'My Project Name',
    'Plan',
    'in-progress',
    'high',
    '8',
    '',
    '2026-04-15',
    '2026-04-22',
    'jane@example.com',
    '\\\\Server\\Projects\\Byline\\Assets',
    'Grade 1',
    'Math Book 1',
    'Numbers',
    'Counting 1-10',
  ];

  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, examplePartial, exampleFull]);
  ws['!cols'] = TEMPLATE_HEADERS.map((h) => ({ wch: Math.max(h.length + 4, 18) }));

  const instructions = XLSX.utils.aoa_to_sheet([
    ['Bulk Update rules'],
    ['Task ID is required. It must match an existing task. New tasks are never created.'],
    ['Every other column is optional. Leave a cell blank to keep the current value.'],
    ['Blank cells do not clear fields.'],
    ['If any row is invalid (unknown Task ID, bad status, missing assignee email, etc.), the entire file is rejected and nothing is updated.'],
    ['Duplicate Task IDs in the same file are not allowed.'],
    ['Valid Status: ' + VALID_STATUSES.join(', ')],
    ['Valid Priority: ' + VALID_PRIORITIES.join(', ')],
    ['Assignees: comma-separated emails of existing team or admin users.'],
    ['Dates: YYYY-MM-DD'],
    ['Hierarchy names (Grade/Book/Unit/Lesson) must already exist for the task\'s project.'],
  ]);
  instructions['!cols'] = [{ wch: 110 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Task Updates');
  XLSX.utils.book_append_sheet(wb, instructions, 'Instructions');
  XLSX.writeFile(wb, 'bulk_task_update_template.xlsx');
}

function dateToLocalYMD(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseDate(val: unknown): string {
  if (!val && val !== 0) return '';
  if (val instanceof Date) return dateToLocalYMD(val);
  const s = val.toString().trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const mdyMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (/^\d+$/.test(s)) {
    const serial = parseInt(s, 10);
    const excelEpoch = new Date(1899, 11, 30);
    const d = new Date(excelEpoch.getTime() + serial * 86400000);
    return dateToLocalYMD(d);
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return dateToLocalYMD(parsed);
  return s;
}

const EXCEL_ERROR_RE = /^(#REF!|#N\/A|#VALUE!|#NAME\?|#DIV\/0!|#NULL!|#NUM!|#GETTING_DATA!)$/i;

function normalizeHeaderKey(key: string): string {
  return String(key).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

function getCell(row: Record<string, unknown>, aliases: string[]): unknown {
  const map = new Map<string, unknown>();
  Object.entries(row).forEach(([key, value]) => {
    map.set(normalizeHeaderKey(key), value);
  });
  for (const alias of aliases) {
    if (map.has(normalizeHeaderKey(alias))) return map.get(normalizeHeaderKey(alias));
  }
  return '';
}

function normalize(val: unknown): string {
  if (val === undefined || val === null || val === '') return '';
  if (val instanceof Date) return dateToLocalYMD(val);
  return val.toString().trim();
}

function isExcelError(val: string): boolean {
  return EXCEL_ERROR_RE.test(val);
}

function collectSheetFormulaErrors(sheet: XLSX.WorkSheet): RowError[] {
  const errors: RowError[] = [];
  if (!sheet['!ref']) return errors;

  const range = XLSX.utils.decode_range(sheet['!ref']);
  const headerByCol = new Map<number, string>();
  for (let col = range.s.c; col <= range.e.c; col += 1) {
    const headerCell = sheet[XLSX.utils.encode_cell({ r: range.s.r, c: col })];
    const header = String(headerCell?.w || headerCell?.v || '').replace(/\u00a0/g, ' ').trim();
    if (header) headerByCol.set(col, header);
  }

  for (let row = range.s.r + 1; row <= range.e.r; row += 1) {
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
      if (!cell || cell.t !== 'e') continue;
      const header = headerByCol.get(col) || XLSX.utils.encode_col(col);
      const formulaError = String(cell.w || '#REF!');
      errors.push({
        row: row + 1,
        error: `${header} has a broken Excel formula (${formulaError}). Replace it with the real name.`,
      });
    }
  }

  return errors;
}

function normalizeStatus(val: unknown): string {
  if (!val) return '';
  return val.toString().toLowerCase().trim().replace(/\s+/g, '-');
}

function rowHasUpdates(row: ParsedRow): boolean {
  return Boolean(
    row['Task Name']
    || row.Description
    || row.Project
    || row.Stage
    || row.Status
    || row.Priority
    || row['Estimated Hours']
    || row['Actual Hours']
    || row['Start Date']
    || row['Due Date']
    || row.Assignees
    || row['File Location']
    || row.Grade
    || row.Book
    || row.Unit
    || row.Lesson
  );
}

function validateRows(rows: ParsedRow[]): RowError[] {
  const errors: RowError[] = [];
  const seenIds = new Map<string, number>();

  if (!rows.some(rowHasUpdates)) {
    errors.push({ row: 0, error: 'No fields to update. Fill at least one column besides Task ID.' });
  }

  rows.forEach((row) => {
    const r = row.rowIndex;
    const taskId = row['Task ID']?.toString().trim();

    if (!taskId) {
      errors.push({ row: r, error: 'Task ID is required' });
    } else if (!/^\d+(\.0+)?$/.test(taskId) || parseInt(taskId, 10) <= 0) {
      errors.push({ row: r, error: 'Task ID must be a positive integer' });
    } else {
      const normalizedId = String(parseInt(taskId, 10));
      if (seenIds.has(normalizedId)) {
        errors.push({
          row: r,
          error: `Duplicate Task ID ${normalizedId} (already listed on row ${seenIds.get(normalizedId)})`,
        });
      } else {
        seenIds.set(normalizedId, r);
      }
    }

    if (row['Task Name'] && row['Task Name'].length > NAME_MAX) {
      errors.push({ row: r, error: `Task Name must not exceed ${NAME_MAX} characters` });
    }
    if (row.Description && row.Description.length > DESCRIPTION_MAX) {
      errors.push({ row: r, error: `Description must not exceed ${DESCRIPTION_MAX} characters` });
    }
    if (row['File Location'] && row['File Location'].length > LOCATION_MAX) {
      errors.push({ row: r, error: `File Location must not exceed ${LOCATION_MAX} characters` });
    }

    if (row.Status && !VALID_STATUSES.includes(row.Status)) {
      errors.push({
        row: r,
        error: `Invalid Status "${row.Status}". Must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }
    if (row.Priority && !VALID_PRIORITIES.includes(row.Priority)) {
      errors.push({
        row: r,
        error: `Invalid Priority "${row.Priority}". Must be one of: ${VALID_PRIORITIES.join(', ')}`,
      });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (row['Start Date'] && !dateRegex.test(row['Start Date'])) {
      errors.push({ row: r, error: 'Invalid Start Date format. Use YYYY-MM-DD' });
    }
    if (row['Due Date'] && !dateRegex.test(row['Due Date'])) {
      errors.push({ row: r, error: 'Invalid Due Date format. Use YYYY-MM-DD' });
    }
    if (row['Start Date'] && row['Due Date'] && row['Start Date'] > row['Due Date']) {
      errors.push({ row: r, error: 'Start Date cannot be after Due Date' });
    }

    if (row['Estimated Hours']) {
      const h = Number(row['Estimated Hours']);
      if (Number.isNaN(h) || h < 0) {
        errors.push({ row: r, error: 'Estimated Hours must be a number 0 or greater' });
      }
    }
    if (row['Actual Hours']) {
      const h = Number(row['Actual Hours']);
      if (Number.isNaN(h) || h < 0) {
        errors.push({ row: r, error: 'Actual Hours must be a number 0 or greater' });
      }
    }

    (
      [
        ['Grade', row.Grade],
        ['Book', row.Book],
        ['Unit', row.Unit],
        ['Lesson', row.Lesson],
      ] as Array<[string, string | undefined]>
    ).forEach(([label, value]) => {
      if (value && isExcelError(value)) {
        errors.push({ row: r, error: `${label} has a broken Excel formula (${value}). Replace it with the real name.` });
      }
    });

    const grade = row.Grade?.toString().trim();
    const book = row.Book?.toString().trim();
    const unit = row.Unit?.toString().trim();
    const lesson = row.Lesson?.toString().trim();
    if (lesson && isExcelError(lesson)) {
      return;
    }
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

export function BulkUpdateTasksModal({ isOpen, onClose, onSuccess }: BulkUpdateTasksModalProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'submitting' | 'done'>('upload');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<RowError[]>([]);
  const [serverErrors, setServerErrors] = useState<RowError[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep('upload');
    setParsedRows([]);
    setValidationErrors([]);
    setServerErrors([]);
    setUploadError(null);
    setFileName(null);
    setSuccessCount(0);
    setSkippedCount(0);
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
        if (!(data instanceof ArrayBuffer)) {
          setUploadError('Failed to read file.');
          return;
        }
        const wb = XLSX.read(new Uint8Array(data), { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd' });
        const sheetName = wb.SheetNames.find((name) => name.toLowerCase() !== 'instructions') || wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        const json: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
          defval: '',
          raw: false,
          dateNF: 'yyyy-mm-dd',
        });

        if (json.length === 0) {
          setUploadError('The file is empty or has no data rows.');
          return;
        }

        if (json.length > MAX_ROWS) {
          setUploadError(`File contains ${json.length} rows. Maximum allowed is ${MAX_ROWS}.`);
          return;
        }

        const excelCellErrors = collectSheetFormulaErrors(sheet);

        const rows: ParsedRow[] = json.map((rawRow, i) => ({
          rowIndex: i + 2,
          'Task ID': normalize(getCell(rawRow, ['Task ID', 'Task Id', 'taskId', 'task_id', 'id'])),
          'Task Name': normalize(getCell(rawRow, ['Task Name', 'Name'])),
          Description: normalize(getCell(rawRow, ['Description'])),
          Project: normalize(getCell(rawRow, ['Project'])),
          Stage: normalize(getCell(rawRow, ['Stage'])),
          Status: normalizeStatus(getCell(rawRow, ['Status'])),
          Priority: normalizeStatus(getCell(rawRow, ['Priority'])),
          'Estimated Hours': normalize(getCell(rawRow, ['Estimated Hours'])),
          'Actual Hours': normalize(getCell(rawRow, ['Actual Hours'])),
          'Start Date': parseDate(getCell(rawRow, ['Start Date'])),
          'Due Date': parseDate(getCell(rawRow, ['Due Date', 'End Date'])),
          Assignees: normalize(getCell(rawRow, ['Assignees', 'Assignee Email'])),
          'File Location': normalize(getCell(rawRow, ['File Location', 'Server Location'])),
          Grade: normalize(getCell(rawRow, ['Grade', 'Level 1 (Grade)'])),
          Book: normalize(getCell(rawRow, ['Book', 'Level 2 (Book)'])),
          Unit: normalize(getCell(rawRow, ['Unit', 'Level 3 (Unit)'])),
          Lesson: normalize(getCell(rawRow, ['Lesson', 'Level 4 (Lesson)', 'Lesson Name'])),
        }));

        setParsedRows(rows);
        setValidationErrors([...excelCellErrors, ...validateRows(rows)]);
        setServerErrors([]);
        setStep('preview');
      } catch {
        setUploadError('Failed to parse file. Please ensure it is a valid Excel or CSV file.');
      }
    };
    reader.readAsArrayBuffer(file);
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

      const response = await fetch(`${API_URL}/tasks/bulk-update`, {
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
          const message = typeof result.error === 'string'
            ? result.error
            : result.error?.message || result.message || 'Update failed';
          setServerErrors([{ row: 0, error: message }]);
          setStep('preview');
        }
        return;
      }

      setSuccessCount(result.updated || 0);
      setSkippedCount(result.skipped || 0);
      setStep('done');
      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Network error. Please try again.';
      setServerErrors([{ row: 0, error: message }]);
      setStep('preview');
    }
  };

  const errorRowSet = new Set([...validationErrors, ...serverErrors].map((e) => e.row));
  const previewColumns: Array<{ key: keyof ParsedRow; label: string }> = [
    { key: 'Task ID', label: 'Task ID' },
    { key: 'Task Name', label: 'Task Name' },
    { key: 'Description', label: 'Description' },
    { key: 'Project', label: 'Project' },
    { key: 'Stage', label: 'Stage' },
    { key: 'Status', label: 'Status' },
    { key: 'Priority', label: 'Priority' },
    { key: 'Estimated Hours', label: 'Est. Hours' },
    { key: 'Start Date', label: 'Start Date' },
    { key: 'Due Date', label: 'Due Date' },
    { key: 'Assignees', label: 'Assignees' },
    { key: 'File Location', label: 'File Location' },
    { key: 'Grade', label: 'Grade' },
    { key: 'Book', label: 'Book' },
    { key: 'Unit', label: 'Unit' },
    { key: 'Lesson', label: 'Lesson' },
  ];

  const dash = <span className="text-gray-300">—</span>;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Bulk Update Tasks" size="xl">
      <div className="space-y-5">
        {step === 'upload' && (
          <>
            <div className="flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-200">
              <div>
                <p className="text-sm font-semibold text-amber-900">Update existing tasks by Task ID</p>
                <p className="text-xs text-amber-800 mt-0.5">
                  Excel is applied as updates only. Blank cells keep the current value — no field is required except Task ID.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="w-4 h-4 mr-2" />
                Download Template
              </Button>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                isDragging ? 'border-amber-500 bg-amber-50' : 'border-gray-300 hover:border-amber-400 hover:bg-gray-50'
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

            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 space-y-1">
              <p className="font-semibold text-gray-700">How this works</p>
              <p>Task ID* | Task Name | Description | Project | Stage | Status | Priority | Estimated Hours | Actual Hours | Start Date | Due Date | Assignees | File Location | Grade | Book | Unit | Lesson</p>
              <p>Only Task ID is required. Leave any other cell blank to leave that field unchanged. This never creates new tasks.</p>
              <p>If one row fails (unknown Task ID, invalid status, unknown assignee, and so on), the whole file is rejected and nothing is saved.</p>
              <p>Valid Status: {VALID_STATUSES.join(', ')}</p>
              <p>Valid Priority: {VALID_PRIORITIES.join(', ')}</p>
            </div>
          </>
        )}

        {step === 'preview' && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Edit2 className="w-5 h-5 text-amber-600" />
                <div>
                  <p className="text-sm font-semibold text-gray-800">{fileName}</p>
                  <p className="text-xs text-gray-500">
                    {parsedRows.length} rows parsed — {parsedRows.filter((row) => row.Lesson).length} include Lesson.
                    Blank cells keep the current value.
                  </p>
                </div>
              </div>
              <button
                onClick={reset}
                className="text-xs text-amber-700 hover:underline flex items-center gap-1"
              >
                <Upload className="w-3 h-3" /> Upload different file
              </button>
            </div>

            {(validationErrors.length > 0 || serverErrors.length > 0) && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-36 overflow-y-auto">
                <p className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {validationErrors.length + serverErrors.length} error(s) found — nothing will be updated until these are fixed
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
                All {parsedRows.length} rows passed validation. Existing tasks will be updated; no new tasks will be created.
              </div>
            )}

            <div className="overflow-auto max-h-72 border border-gray-200 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">#</th>
                    {previewColumns.map((col) => (
                      <th key={col.key} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {parsedRows.map((row) => {
                    const hasError = errorRowSet.has(row.rowIndex);
                    return (
                      <tr key={row.rowIndex} className={hasError ? 'bg-red-50' : 'hover:bg-gray-50'}>
                        <td className="px-3 py-2 text-gray-400">{row.rowIndex}</td>
                        {previewColumns.map((col) => {
                          const value = row[col.key];
                          if (col.key === 'Status' && value) {
                            return (
                              <td key={col.key} className="px-3 py-2">
                                <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                  {STATUS_DISPLAY[String(value)] || value}
                                </span>
                              </td>
                            );
                          }
                          return (
                            <td
                              key={col.key}
                              className={`px-3 py-2 text-gray-700 truncate ${col.key === 'Lesson' ? 'max-w-[240px]' : 'max-w-[140px]'}`}
                              title={value ? String(value) : ''}
                            >
                              {value ? String(value) : dash}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={handleSubmit}
                disabled={validationErrors.length > 0}
                className={validationErrors.length > 0 ? 'opacity-50 cursor-not-allowed' : ''}
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Update {parsedRows.length} Task{parsedRows.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </>
        )}

        {step === 'submitting' && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="w-10 h-10 text-amber-600 animate-spin" />
            <p className="text-sm font-medium text-gray-700">Updating {parsedRows.length} existing tasks...</p>
            <p className="text-xs text-gray-400">If any row fails, no changes will be saved.</p>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-9 h-9 text-green-600" />
            </div>
            <p className="text-lg font-semibold text-gray-800">
              {successCount} Task{successCount !== 1 ? 's' : ''} Updated Successfully
            </p>
            <p className="text-sm text-gray-500">
              {skippedCount > 0
                ? `${skippedCount} row${skippedCount !== 1 ? 's' : ''} skipped because no fields were filled.`
                : 'The task list has been refreshed.'}
            </p>
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
