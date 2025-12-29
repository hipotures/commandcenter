import { useMemo } from 'react';
import type { DashboardBundle } from '../../types/api';
import type { DashboardViewModel } from '../../types/dashboard';
import { mapApiToViewModel } from './mapApiToViewModel';

export const useDashboardViewModel = (apiData?: DashboardBundle | null): DashboardViewModel | null => {
  return useMemo(() => {
    if (!apiData) {
      return null;
    }
    return mapApiToViewModel(apiData);
  }, [apiData]);
};
