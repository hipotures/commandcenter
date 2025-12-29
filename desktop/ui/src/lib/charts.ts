import type { Granularity } from '../types/api';
import { DAY_MS, HOUR_MS } from './time';

export const chooseTickStep = (rangeMs: number): number => {
  if (rangeMs <= 0) {
    return DAY_MS;
  }
  if (rangeMs <= 2 * DAY_MS) {
    return 4 * HOUR_MS;
  }
  if (rangeMs <= 14 * DAY_MS) {
    return DAY_MS;
  }
  if (rangeMs <= 90 * DAY_MS) {
    return 7 * DAY_MS;
  }
  return 30 * DAY_MS;
};

export const buildTicks = (min: number, max: number, step: number): number[] => {
  if (step <= 0 || min === max) {
    return [min];
  }

  const first = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let t = first; t <= max; t += step) {
    ticks.push(t);
  }

  if (ticks.length === 0) {
    return [min, max].filter((value, index, arr) => arr.indexOf(value) === index);
  }

  return ticks;
};

const parseWeekStart = (year: number, week: number): number => {
  const jan1 = new Date(year, 0, 1);
  const jan1Day = jan1.getDay();
  const firstMondayOffset = (8 - jan1Day) % 7;
  const firstMonday = new Date(year, 0, 1 + firstMondayOffset);

  if (week <= 0) {
    return jan1.getTime();
  }

  const target = new Date(firstMonday);
  target.setDate(firstMonday.getDate() + (week - 1) * 7);
  return target.getTime();
};

export const parsePeriodToTimestamp = (
  period: string,
  granularity: Granularity
): number | null => {
  if (!period) {
    return null;
  }

  if (granularity === 'hour') {
    const [datePart, hourPart] = period.split(' ');
    if (!datePart || hourPart === undefined) {
      return null;
    }
    return new Date(`${datePart}T${hourPart.padStart(2, '0')}:00:00`).getTime();
  }

  if (granularity === 'day') {
    return new Date(`${period}T00:00:00`).getTime();
  }

  if (granularity === 'week') {
    const [yearStr, weekStr] = period.split('-W');
    const year = Number(yearStr);
    const week = Number(weekStr);
    if (Number.isNaN(year) || Number.isNaN(week)) {
      return null;
    }
    return parseWeekStart(year, week);
  }

  const [yearStr, monthStr] = period.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (Number.isNaN(year) || Number.isNaN(month)) {
    return null;
  }
  return new Date(year, month - 1, 1).getTime();
};

const startOfWeek = (date: Date): Date => {
  const result = new Date(date);
  const day = result.getDay();
  const diff = (day + 6) % 7;
  result.setDate(result.getDate() - diff);
  result.setHours(0, 0, 0, 0);
  return result;
};

export const toGranularityTimestamp = (date: Date, granularity: Granularity): number => {
  const result = new Date(date);

  if (granularity === 'hour') {
    result.setMinutes(0, 0, 0);
    return result.getTime();
  }
  if (granularity === 'day') {
    result.setHours(0, 0, 0, 0);
    return result.getTime();
  }
  if (granularity === 'week') {
    return startOfWeek(result).getTime();
  }

  result.setDate(1);
  result.setHours(0, 0, 0, 0);
  return result.getTime();
};
