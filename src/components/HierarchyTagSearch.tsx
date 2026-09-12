import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, ChevronDown } from 'lucide-react';
import {
  HierarchyTagItem,
  filterHierarchyTags,
  findHierarchyTagItem,
} from '../utils/educationalHierarchy';

interface HierarchyTagSearchProps {
  items: HierarchyTagItem[];
  gradeId: string;
  bookId: string;
  unitId: string;
  lessonId: string;
  onChange: (selection: { gradeId: string; bookId: string; unitId: string; lessonId: string }) => void;
  disabled?: boolean;
  variant?: 'form' | 'filter';
  emptyLabel?: string;
  disabledPlaceholder?: string;
  placeholder?: string;
}

const TYPE_LABELS: Record<string, string> = {
  grade: 'Grade',
  book: 'Book',
  unit: 'Unit',
  lesson: 'Lesson',
};

const TYPE_COLORS: Record<string, string> = {
  grade: 'bg-blue-100 text-blue-700',
  book: 'bg-indigo-100 text-indigo-700',
  unit: 'bg-purple-100 text-purple-700',
  lesson: 'bg-violet-100 text-violet-700',
};

const EMPTY_SELECTION = { gradeId: '', bookId: '', unitId: '', lessonId: '' };

export function HierarchyTagSearch({
  items,
  gradeId,
  bookId,
  unitId,
  lessonId,
  onChange,
  disabled = false,
  variant = 'form',
  emptyLabel,
  disabledPlaceholder,
  placeholder,
}: HierarchyTagSearchProps) {
  const isFilter = variant === 'filter';
  const resolvedEmptyLabel = emptyLabel ?? (isFilter ? 'All Tags' : 'Project Level Task (no tag)');
  const resolvedDisabledPlaceholder = disabledPlaceholder ?? 'Select a project first';
  const resolvedPlaceholder = placeholder ?? 'Search tags by grade, book, unit, or lesson...';

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 320 });

  const selectedItem = useMemo(
    () => findHierarchyTagItem(items, gradeId, bookId, unitId, lessonId),
    [items, gradeId, bookId, unitId, lessonId]
  );

  const filteredItems = useMemo(() => filterHierarchyTags(items, query), [items, query]);

  const reposition = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, isFilter ? 280 : rect.width),
    });
  }, [isFilter]);

  useEffect(() => {
    if (!isOpen) return;
    reposition();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [isOpen, reposition]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setIsOpen(false);
      setQuery('');
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  const handleSelect = (item: HierarchyTagItem | null) => {
    if (item) {
      onChange({
        gradeId: item.gradeId.toString(),
        bookId: item.bookId ? item.bookId.toString() : '',
        unitId: item.unitId ? item.unitId.toString() : '',
        lessonId: item.lessonId ? item.lessonId.toString() : '',
      });
    } else {
      onChange(EMPTY_SELECTION);
    }
    setIsOpen(false);
    setQuery('');
  };

  const displayValue = isOpen ? query : (selectedItem?.name || '');
  const inputPlaceholder = disabled
    ? resolvedDisabledPlaceholder
    : selectedItem && !isOpen
      ? selectedItem.name
      : resolvedPlaceholder;

  const dropdown = isOpen && !disabled && (
    <div
      ref={panelRef}
      role="listbox"
      style={{
        position: 'fixed',
        top: coords.top,
        left: coords.left,
        width: coords.width,
        zIndex: 9999,
      }}
      className="bg-white border border-indigo-200 rounded-lg shadow-xl overflow-hidden"
    >
      <button
        type="button"
        onClick={() => handleSelect(null)}
        className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50/60 border-b border-gray-100 ${
          !selectedItem ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'
        }`}
      >
        {resolvedEmptyLabel}
      </button>

      <div className="max-h-60 overflow-y-auto">
        {filteredItems.length === 0 ? (
          <div className="px-3 py-4 text-sm text-gray-500 text-center">
            No tags match &quot;{query.trim()}&quot;
          </div>
        ) : (
          filteredItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item)}
              className={`w-full text-left px-3 py-2 hover:bg-indigo-50/60 border-b border-gray-50 last:border-b-0 ${
                selectedItem?.id === item.id ? 'bg-indigo-50' : ''
              }`}
            >
              <div className="flex items-start gap-2">
                <span className={`inline-flex shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium mt-0.5 ${TYPE_COLORS[item.type]}`}>
                  {TYPE_LABELS[item.type]}
                </span>
                <span className="text-sm text-gray-800 break-words">{item.name}</span>
              </div>
            </button>
          ))
        )}
      </div>

      {query.trim() && filteredItems.length === 50 && (
        <div className="px-3 py-2 text-xs text-gray-400 border-t border-gray-100">
          Showing first 50 matches. Refine your search for more specific results.
        </div>
      )}
    </div>
  );

  return (
    <div ref={containerRef} className="relative w-full min-w-0">
      <div className="relative">
        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${
          isFilter && selectedItem ? 'text-indigo-500' : 'text-gray-400'
        }`} />
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          disabled={disabled}
          placeholder={inputPlaceholder}
          onFocus={() => {
            if (disabled) return;
            setIsOpen(true);
            setQuery(selectedItem?.name || '');
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          className={
            isFilter
              ? `
                w-full h-9 pl-9 pr-16 text-sm rounded-lg border outline-none
                transition-all duration-150
                ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200 text-gray-400' : ''}
                ${!disabled && selectedItem
                  ? 'border-indigo-400 bg-indigo-50 text-indigo-700 font-medium'
                  : !disabled
                    ? 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'
                    : ''
                }
              `
              : 'w-full pl-9 pr-16 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500'
          }
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {selectedItem && !disabled && (
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
              aria-label="Clear tag selection"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform ${
            isFilter && selectedItem ? 'text-indigo-500' : 'text-gray-400'
          } ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {selectedItem && !isOpen && !isFilter && (
        <div className="mt-1 flex items-center gap-2">
          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[selectedItem.type]}`}>
            {TYPE_LABELS[selectedItem.type]}
          </span>
          <span className="text-xs text-gray-500 truncate">{selectedItem.name}</span>
        </div>
      )}

      {dropdown && createPortal(dropdown, document.body)}
    </div>
  );
}
