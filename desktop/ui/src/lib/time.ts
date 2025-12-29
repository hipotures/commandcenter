import type { Granularity } from '../types/api';

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

export const formatDurationRange = (start?: string | null, end?: string | null): string => {
  if (!start || !end) return '—';
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return '—';

  const totalMinutes = Math.floor((endMs - startMs) / 60000);
  if (totalMinutes < 1) return '<1m';

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
};

export const calculateGranularity = (from: string, to: string): Granularity => {
  const startDate = new Date(from);
  const endDate = new Date(to);
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff <= 2) return 'hour';
  if (daysDiff <= 14) return 'day';
  if (daysDiff <= 60) return 'day';
  if (daysDiff <= 180) return 'week';
  return 'month';
};
