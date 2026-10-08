import { useCallback, useEffect, useState } from 'react';
import { remarkOptionsService, type RemarkOption } from '../services/apiService';
import { SYSTEM_REMARK_OPTIONS } from '../utils/bulkRemark';

function toSelectOptions(options: RemarkOption[]) {
  return options.map((option) => ({
    value: option.slug,
    label: option.label,
    statusEffect: option.status_effect,
    isSystem: option.is_system,
    id: option.id,
  }));
}

export function useRemarkOptions() {
  const [options, setOptions] = useState(SYSTEM_REMARK_OPTIONS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await remarkOptionsService.listMine();
      if (Array.isArray(data) && data.length > 0) {
        setOptions(toSelectOptions(data));
        return;
      }
      setOptions(SYSTEM_REMARK_OPTIONS);
    } catch {
      setOptions(SYSTEM_REMARK_OPTIONS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { options, loading, reload: load };
}
