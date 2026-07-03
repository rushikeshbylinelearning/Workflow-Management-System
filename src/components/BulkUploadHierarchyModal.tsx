import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface BulkUploadHierarchyModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  onUploadComplete: () => void;
}

interface ParsedRow {
  grade: string;
  gradeDescription?: string;
  gradeWeight?: number;
  book: string;
  bookType?: string;
  bookDescription?: string;
  bookWeight?: number;
  unit: string;
  unitDescription?: string;
  unitWeight?: number;
  lesson: string;
  lessonDescription?: string;
  lessonWeight?: number;
}

const BulkUploadHierarchyModal: React.FC<BulkUploadHierarchyModalProps> = ({
  isOpen,
  onClose,
  projectId,
  onUploadComplete
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParsedRow[]>([]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setSuccess(null);

    // Parse and preview the file
    try {
      const data = await parseExcelFile(selectedFile);
      setPreview(data.slice(0, 5)); // Show first 5 rows as preview
    } catch (err: any) {
      setError(err.message || 'Failed to parse Excel file');
    }
  };

  const parseExcelFile = (file: File): Promise<ParsedRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

          const parsedData: ParsedRow[] = jsonData.map((row: any) => ({
            grade: row['Grade'] || row['grade'] || '',
            gradeDescription: row['Grade Description'] || row['grade_description'] || '',
            gradeWeight: parseFloat(row['Grade Weight'] || row['grade_weight'] || '0'),
            book: row['Book'] || row['book'] || '',
            bookType: row['Book Type'] || row['book_type'] || 'student',
            bookDescription: row['Book Description'] || row['book_description'] || '',
            bookWeight: parseFloat(row['Book Weight'] || row['book_weight'] || '0'),
            unit: row['Unit'] || row['unit'] || '',
            unitDescription: row['Unit Description'] || row['unit_description'] || '',
            unitWeight: parseFloat(row['Unit Weight'] || row['unit_weight'] || '0'),
            lesson: row['Lesson'] || row['lesson'] || '',
            lessonDescription: row['Lesson Description'] || row['lesson_description'] || '',
            lessonWeight: parseFloat(row['Lesson Weight'] || row['lesson_weight'] || '0')
          }));

          resolve(parsedData);
        } catch (err: any) {
          reject(new Error('Invalid Excel file format'));
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsBinaryString(file);
    });
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const parsedData = await parseExcelFile(file);
      
      // Send to backend
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const token = sessionStorage.getItem('access_token') || sessionStorage.getItem('teamToken');
      
      const response = await fetch(`${API_URL}/grades/bulk-upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          project_id: projectId,
          data: parsedData
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Upload failed');
      }

      setSuccess(`Successfully uploaded ${result.data.created.grades} grades, ${result.data.created.books} books, ${result.data.created.units} units, and ${result.data.created.lessons} lessons`);
      setFile(null);
      setPreview([]);
      
      // Refresh the hierarchy
      onUploadComplete();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to upload data');
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    // Create a sample template
    const template = [
      {
        'Grade': 'Grade 1',
        'Grade Description': 'First grade curriculum',
        'Grade Weight': 10,
        'Book': 'Math Book 1',
        'Book Type': 'student',
        'Book Description': 'Student mathematics book',
        'Book Weight': 50,
        'Unit': 'Numbers',
        'Unit Description': 'Introduction to numbers',
        'Unit Weight': 25,
        'Lesson': 'Counting 1-10',
        'Lesson Description': 'Learn to count from 1 to 10',
        'Lesson Weight': 10
      },
      {
        'Grade': 'Grade 1',
        'Grade Description': '',
        'Grade Weight': 0,
        'Book': 'Math Book 1',
        'Book Type': '',
        'Book Description': '',
        'Book Weight': 0,
        'Unit': 'Numbers',
        'Unit Description': '',
        'Unit Weight': 0,
        'Lesson': 'Counting 11-20',
        'Lesson Description': 'Learn to count from 11 to 20',
        'Lesson Weight': 10
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'educational_hierarchy_template.xlsx');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Bulk Upload Educational Hierarchy">
      <div className="space-y-4">
        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Upload Instructions</h4>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Download the template to see the required format</li>
            <li>Fill in your grades, books, units, and lessons</li>
            <li>For repeated items (same grade/book/unit), leave those columns empty</li>
            <li>Upload the completed Excel file</li>
          </ul>
        </div>

        {/* Download Template Button */}
        <Button
          type="button"
          variant="outline"
          onClick={downloadTemplate}
          className="w-full flex items-center justify-center space-x-2"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Download Template</span>
        </Button>

        {/* File Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Excel File
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
            />
          </div>
        </div>

        {/* Preview */}
        {preview.length > 0 && (
          <div className="border rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Preview (First 5 rows)</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-1 text-left">Grade</th>
                    <th className="px-2 py-1 text-left">Book</th>
                    <th className="px-2 py-1 text-left">Unit</th>
                    <th className="px-2 py-1 text-left">Lesson</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-2 py-1">{row.grade}</td>
                      <td className="px-2 py-1">{row.book}</td>
                      <td className="px-2 py-1">{row.unit}</td>
                      <td className="px-2 py-1">{row.lesson}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start space-x-2">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={uploading}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleUpload}
            disabled={!file || uploading}
            className="flex items-center space-x-2"
          >
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Upload</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default BulkUploadHierarchyModal;
