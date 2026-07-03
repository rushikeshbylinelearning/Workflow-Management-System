import { useMemo, useRef, useEffect } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  height?: string;
}

export function RichTextEditor({ 
  value, 
  onChange, 
  placeholder = "Enter your content...", 
  className = "",
  readOnly = false,
  height = "200px"
}: RichTextEditorProps) {
  const quillRef = useRef<ReactQuill>(null);

  // Simplified toolbar with essential options only
  const modules = useMemo(() => ({
    toolbar: {
      container: [
        // Essential text formatting in one line
        ['bold', 'italic', 'underline'],
        ['blockquote'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['link'],
        ['table'],
        ['clean']
      ],
      handlers: {
        'table': function() {
          const quill = quillRef.current?.getEditor();
          if (quill) {
            insertTable(quill);
          }
        }
      }
    }
  }), []);

  const formats = [
    'bold', 'italic', 'underline',
    'list', 'bullet',
    'link',
    'blockquote'
  ];

  // Function to insert a table
  const insertTable = (quill: any) => {
    const range = quill.getSelection();
    if (range) {
      const tableHTML = `
        <table style="border-collapse: collapse; width: 100%; margin: 10px 0; border: 1px solid #ddd;">
          <tbody>
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px; min-width: 100px;">&nbsp;</td>
              <td style="border: 1px solid #ddd; padding: 8px; min-width: 100px;">&nbsp;</td>
              <td style="border: 1px solid #ddd; padding: 8px; min-width: 100px;">&nbsp;</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px; min-width: 100px;">&nbsp;</td>
              <td style="border: 1px solid #ddd; padding: 8px; min-width: 100px;">&nbsp;</td>
              <td style="border: 1px solid #ddd; padding: 8px; min-width: 100px;">&nbsp;</td>
            </tr>
          </tbody>
        </table>
      `;
      
      quill.clipboard.dangerouslyPasteHTML(range.index, tableHTML);
      quill.setSelection(range.index + 1);
    }
  };



  // Add custom styles for tables
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .ql-editor table {
        border-collapse: collapse;
        width: 100%;
        margin: 10px 0;
        border: 1px solid #ddd;
      }
      
      .ql-editor table td,
      .ql-editor table th {
        border: 1px solid #ddd;
        padding: 8px;
        min-width: 100px;
        position: relative;
      }
      
      .ql-editor table td:focus,
      .ql-editor table th:focus {
        outline: 2px solid #0078d4;
        outline-offset: -2px;
      }
      
      .ql-editor table tr:hover {
        background-color: #f5f5f5;
      }
      
      .ql-editor table td:hover,
      .ql-editor table th:hover {
        background-color: #e6f3ff;
      }
      
      /* Table toolbar button */
      .ql-toolbar .ql-table {
        background: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3crect x='3' y='3' width='18' height='18' rx='2' ry='2'/%3e%3cpath d='M9 9h6v6H9z'/%3e%3c/svg%3e") no-repeat center;
        background-size: 18px;
        width: 24px;
        height: 24px;
        border: none;
        cursor: pointer;
        margin: 0 2px;
      }
      
      .ql-toolbar .ql-table:hover {
        background-color: #f0f0f0;
        border-radius: 3px;
      }
      
      /* Rich text editor container */
      .rich-text-editor {
        border: 1px solid #ddd;
        border-radius: 8px;
        overflow: hidden;
      }
      
      .rich-text-editor .ql-toolbar {
        border-bottom: 1px solid #ddd;
        background: #f8f9fa;
        padding: 8px 12px;
        display: flex;
        flex-wrap: nowrap;
        align-items: center;
        gap: 4px;
      }
      
      .rich-text-editor .ql-toolbar .ql-formats {
        display: flex;
        align-items: center;
        gap: 4px;
        margin: 0;
      }
      
      .rich-text-editor .ql-toolbar button {
        width: 28px;
        height: 28px;
        padding: 4px;
        border-radius: 4px;
        border: 1px solid transparent;
        background: transparent;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .rich-text-editor .ql-toolbar button:hover {
        background: #e9ecef;
        border-color: #dee2e6;
      }
      
      .rich-text-editor .ql-toolbar button.ql-active {
        background: #007bff;
        color: white;
        border-color: #007bff;
      }
      
      .rich-text-editor .ql-container {
        border: none;
        font-family: inherit;
      }
      
      .rich-text-editor .ql-editor {
        min-height: ${height};
        font-size: 14px;
        line-height: 1.5;
        padding: 12px;
      }
      
      .rich-text-editor .ql-editor.ql-blank::before {
        color: #999;
        font-style: normal;
      }
      
      /* Read-only styles */
      .rich-text-editor.read-only .ql-toolbar {
        display: none;
      }
      
      .rich-text-editor.read-only .ql-editor {
        border: none;
        padding: 12px;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, [height]);

  return (
    <div className={`rich-text-editor ${readOnly ? 'read-only' : ''} ${className}`}>
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        readOnly={readOnly}
        modules={modules}
        formats={formats}
        style={{ height: readOnly ? 'auto' : 'auto' }}
      />
    </div>
  );
}

// Component for displaying rich text content safely
interface RichTextDisplayProps {
  content: string;
  className?: string;
}

export function RichTextDisplay({ content, className = "" }: RichTextDisplayProps) {
  // Sanitize HTML content to prevent XSS attacks
  const sanitizeHTML = (html: string) => {
    // Basic sanitization - in production, use a proper library like DOMPurify
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  };

  return (
    <div 
      className={`rich-text-display ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizeHTML(content) }}
      style={{
        fontSize: '14px',
        lineHeight: '1.5',
        color: '#333'
      }}
    />
  );
}
