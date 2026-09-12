import React, { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, X, AlertCircle, CheckCircle, FileSpreadsheet, Loader2, Tags } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

interface BulkTagTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedRow {
  rowIndex: number;
  'Task ID': string;
  Grade?: string;
  Book?: string;
  Unit?: string;
  Lesson?: string;
}

interface RowError {
  row: number;
  error: string;
}

const MAX_ROWS = 500;
const MAX_FILE_SIZE_MB = 2;

function downloadTemplate() {
  const headers = ['Task ID', 'Grade', 'Book', 'Unit', 'Lesson'];
  const example = ['1234', 'Grade 1', 'Math Book 1', 'Numbers', 'Counting 1-10'];

  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 18) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Task Tags');
  XLSX.writeFile(wb, 'bulk_task_tagging_template.xlsx');
}

function validateRows(rows: ParsedRow[]): RowError[] {
  const errors: RowError[] = [];

  rows.forEach((row) => {
    const r = row.rowIndex;
    const taskId = row['Task ID']?.toString().trim();

    if (!taskId) {
      errors.push({ row: r, error: 'Task ID is required' });
    } else if (!/^\d+$/.test(taskId) || parseInt(taskId, 10) <= 0) {
      errors.push({ row: r, error: 'Task ID must be a positive integer' });
    }

    const grade = row.Grade?.toString().trim();
    const book = row.Book?.toString().trim();
    const unit = row.Unit?.toString().trim();
    const lesson = row.Lesson?.toString().trim();

    if (!grade && !book && !unit && !lesson) {
      errors.push({ row: r, error: 'At least one of Grade, Book, Unit, or Lesson is required' });
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

export function BulkTagTasksModal({ isOpen, onClose, onSuccess }: BulkTagTasksModalProps) {
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
        const wb = XLSX.read(data, { type: 'binary', cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

        if (json.length === 0) {
          setUploadError('The file is empty or has no data rows.');
          return;
        }

        if (json.length > MAX_ROWS) {
          setUploadError(`File contains ${json.length} rows. Maximum allowed is ${MAX_ROWS}.`);
          return;
        }

        const normalize = (val: any): string => {
          if (!val && val !== 0) return '';
          return val.toString().trim();
        };

        const rows: ParsedRow[] = json.map((row, i) => ({
          rowIndex: i + 2,
          'Task ID': normalize(row['Task ID'] ?? row['Task Id'] ?? row.taskId ?? row.task_id),
          Grade: normalize(row.Grade ?? row['Level 1 (Grade)']),
          Book: normalize(row.Book ?? row['Level 2 (Book)']),
          Unit: normalize(row.Unit ?? row['Level 3 (Unit)']),
          Lesson: normalize(row.Lesson ?? row['Level 4 (Lesson)']),
        }));

        const errors = validateRows(rows);
        setParsedRows(rows);
        setValidationErrors(errors);
        setStep('preview');
      } catch {
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

      const response = await fetch(`${API_URL}/tasks/bulk-tag`, {
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

      setSuccessCount(result.updated || parsedRows.length);
      setStep('done');
      onSuccess();
    } catch (err: any) {
      setServerErrors([{ row: 0, error: err.message || 'Network error. Please try again.' }]);
      setStep('preview');
    }
  };

  const errorRowSet = new Set([...validationErrors, ...serverErrors].map((e) => e.row));

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Bulk Tag Tasks" size="xl">
      <div className="space-y-5">
        {step === 'upload' && (
          <>
            <div className="flex items-center justify-between p-4 bg-purple-50 rounded-xl border border-purple-200">
              <div>
                <p className="text-sm font-semibold text-purple-800">Tag existing tasks by Task ID</p>
                <p className="text-xs text-purple-600 mt-0.5">
                  Upload a sheet with Task ID and Grade/Book/Unit/Lesson to apply Educational Hierarchy tags.
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
                isDragging ? 'border-purple-500 bg-purple-50' : 'border-gray-300 hover:border-purple-400 hover:bg-gray-50'
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

            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
              <p className="font-semibold text-gray-700 mb-1">Template columns:</p>
              <p>Task ID* | Grade | Book | Unit | Lesson</p>
              <p className="mt-1">Hierarchy names must match existing Educational Hierarchy for the task&apos;s project. You can export tasks and reuse Task ID + hierarchy columns.</p>
            </div>
          </>
        )}

        {step === 'preview' && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Tags className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="text-sm font-semibold text-gray-800">{fileName}</p>
                  <p className="text-xs text-gray-500">{parsedRows.length} rows parsed</p>
                </div>
              </div>
              <button
                onClick={reset}
                className="text-xs text-purple-600 hover:underline flex items-center gap-1"
              >
                <Upload className="w-3 h-3" /> Upload different file
              </button>
            </div>

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

            <div className="overflow-auto max-h-72 border border-gray-200 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">#</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Task ID</th>
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
                        <td className="px-3 py-2 font-medium text-gray-800">{row['Task ID']}</td>
                        <td className="px-3 py-2 text-purple-600">{row.Grade || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2 text-purple-600">{row.Book || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2 text-purple-600">{row.Unit || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2 text-purple-600">{row.Lesson || <span className="text-gray-300">—</span>}</td>
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
                <Tags className="w-4 h-4 mr-2" />
                Tag {parsedRows.length} Task{parsedRows.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </>
        )}

        {step === 'submitting' && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="w-10 h-10 text-purple-600 animate-spin" />
            <p className="text-sm font-medium text-gray-700">Tagging {parsedRows.length} tasks...</p>
            <p className="text-xs text-gray-400">Please wait, this may take a moment.</p>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-9 h-9 text-green-600" />
            </div>
            <p className="text-lg font-semibold text-gray-800">{successCount} Task{successCount !== 1 ? 's' : ''} Tagged Successfully</p>
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
