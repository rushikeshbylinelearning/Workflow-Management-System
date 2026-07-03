import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  subtitle?: React.ReactNode;
  headerActions?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  bodyClassName?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  subtitle,
  headerActions,
  size = 'md',
  bodyClassName = 'px-5 py-4',
}: ModalProps) {
  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-6xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <div
        className="fixed inset-0 bg-gray-900/55 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        className={`relative flex w-full flex-col ${sizes[size]} max-h-[92vh] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5`}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-100 bg-gray-50/60 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-semibold text-gray-900">{title}</h3>
            {subtitle && <div className="mt-2 flex flex-wrap items-center gap-2">{subtitle}</div>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerActions}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-200/80 hover:text-gray-700"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${bodyClassName}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
