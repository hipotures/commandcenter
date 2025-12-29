import { useState } from 'react';
import { formatDate, normalizeDateString } from '../../lib/date';
import { useAppStore } from '../../state/store';
import type { DashboardDataRange } from '../../types/dashboard';

interface UseDateRangeOptions {
  defaultFrom: string;
  dataRange?: DashboardDataRange;
  firstSessionDate?: string | null;
}

export function useDateRange({ defaultFrom, dataRange, firstSessionDate }: UseDateRangeOptions) {
  const { dateFrom, dateTo, setDateRange } = useAppStore();
  const [tempFrom, setTempFrom] = useState(dateFrom);
  const [tempTo, setTempTo] = useState(dateTo);
  const [isOpen, setIsOpen] = useState(false);

  const togglePicker = () => {
    setTempFrom(dateFrom);
    setTempTo(dateTo);
    setIsOpen((prev) => !prev);
  };

  const closePicker = () => setIsOpen(false);

  const applyRange = () => {
    setDateRange(tempFrom, tempTo);
    setIsOpen(false);
  };

  const setRange = (from: string, to: string) => {
    setDateRange(from, to);
    setIsOpen(false);
  };

  const setRangeLastDays = (days: number) => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - (days - 1));
    setRange(formatDate(start), formatDate(end));
  };

  const setRangeLast24Hours = () => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - 1);
    setRange(formatDate(start), formatDate(end));
  };

  const setRangeAll = () => {
    const fallbackStart = firstSessionDate
      ? normalizeDateString(firstSessionDate)
      : defaultFrom;
    const fallbackEnd = formatDate(new Date());
    setRange(dataRange?.start || fallbackStart, dataRange?.end || fallbackEnd);
  };

  return {
    dateRange: { from: dateFrom, to: dateTo },
    tempFrom,
    tempTo,
    setTempFrom,
    setTempTo,
    isOpen,
    togglePicker,
    closePicker,
    applyRange,
    setRangeLast24Hours,
    setRangeLastDays,
    setRangeAll,
  };
}
