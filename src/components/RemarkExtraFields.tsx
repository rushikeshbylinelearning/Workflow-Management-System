import React from 'react';
import type { RemarkInputField } from '../services/apiService';

export interface RemarkExtraFieldValue {
  slug: string;
  label: string;
  value: string;
}

export function parseRemarkExtraFields(raw: unknown): RemarkExtraFieldValue[] {
  if (!raw) return [];
  let data: unknown = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (Array.isArray(data)) {
    return data
      .map((item) => ({
        slug: String(item?.slug || item?.label || ''),
        label: String(item?.label || item?.slug || ''),
        value: String(item?.value ?? '').trim(),
      }))
      .filter((item) => item.value);
  }
  if (!data || typeof data !== 'object') return [];
  return Object.entries(data as Record<string, unknown>)
    .map(([slug, value]) => {
      if (value && typeof value === 'object') {
        const record = value as { label?: string; value?: string };
        return {
          slug,
          label: String(record.label || slug),
          value: String(record.value ?? '').trim(),
        };
      }
      return { slug, label: slug, value: String(value ?? '').trim() };
    })
    .filter((item) => item.value);
}

interface RemarkExtraFieldsInputsProps {
  fields: RemarkInputField[];
  values: Record<string, string>;
  onChange: (slug: string, value: string) => void;
  enforceRequired?: boolean;
  className?: string;
  inputClassName?: string;
}

export function RemarkExtraFieldsInputs({
  fields,
  values,
  onChange,
  enforceRequired = false,
  className = 'space-y-4',
  inputClassName = 'w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200',
}: RemarkExtraFieldsInputsProps) {
  if (!fields.length) return null;

  return (
    <div className={className}>
      {fields.map((field) => {
        const required = enforceRequired && field.is_required;
        return (
          <div key={field.slug}>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {field.label}
              {required ? <span className="text-red-500"> *</span> : null}
            </label>
            <input
              type="text"
              value={values[field.slug] || ''}
              onChange={(e) => onChange(field.slug, e.target.value)}
              placeholder={`Enter ${field.label.toLowerCase()}`}
              className={inputClassName}
              required={required}
            />
          </div>
        );
      })}
    </div>
  );
}

export function RemarkExtraFieldsDisplay({ extraFields }: { extraFields?: unknown }) {
  const items = parseRemarkExtraFields(extraFields);
  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3 p-3 bg-purple-50 rounded-lg border border-purple-200 overflow-hidden">
      {items.map((item) => (
        <div key={item.slug} className="min-w-0">
          <p className="text-xs text-purple-600 uppercase tracking-wide font-medium">{item.label}</p>
          <p className="text-sm font-medium text-gray-900 truncate mt-0.5" title={item.value}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
