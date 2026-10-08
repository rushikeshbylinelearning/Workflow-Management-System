import { useCallback, useEffect, useState } from 'react';
import { remarkFieldsService, type RemarkInputField } from '../services/apiService';

export function useRemarkFields() {
  const [fields, setFields] = useState<RemarkInputField[]>([]);
  const [enforceRequired, setEnforceRequired] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await remarkFieldsService.listMine();
      setFields(Array.isArray(result.data) ? result.data : []);
      setEnforceRequired(!!result.enforceRequired);
    } catch {
      setFields([]);
      setEnforceRequired(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { fields, enforceRequired, loading, reload: load };
}

export function missingRequiredRemarkFields(
  fields: RemarkInputField[],
  values: Record<string, string>,
  enforceRequired: boolean
): RemarkInputField[] {
  if (!enforceRequired) return [];
  return fields.filter((field) => field.is_required && !String(values[field.slug] || '').trim());
}
