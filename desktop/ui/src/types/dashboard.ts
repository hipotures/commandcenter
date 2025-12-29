import type { LucideIcon } from 'lucide-react';
import type { Granularity, LimitEvent } from './api';

export interface DashboardTotals {
  messages: number;
  sessions: number;
  tokens: number;
  cost: number;
  cacheRead: number;
  cacheWrite: number;
  maxStreak: number;
  currentStreak: number;
}

export interface DashboardTrends {
  messages: number;
  sessions: number;
  tokens: number;
  cost: number;
}

export interface DashboardTimelinePoint {
  period: string;
  messages: number;
  tokens: number;
  cost: number;
}

export interface DashboardHourlyPoint {
  hour: string;
  activity: number;
}

export interface DashboardDailyPoint {
  day: string;
  activity: number;
}

export interface DashboardModelPoint {
  model: string;
  displayName: string;
  tokens: number;
  messages: number;
  cost: number;
}

export interface DashboardSession {
  id: string;
  model: string;
  messages: number;
  tokens: number;
  cost: number;
  date: string;
  duration: string;
}

export interface DashboardDataRange {
  start: string | null;
  end: string | null;
}

export interface DashboardViewModel {
  dailyActivity: Record<string, number>;
  timelineData: DashboardTimelinePoint[];
  hourlyData: DashboardHourlyPoint[];
  dailyData: DashboardDailyPoint[];
  modelData: DashboardModelPoint[];
  sessions: DashboardSession[];
  totals: DashboardTotals;
  trends: DashboardTrends;
  meta: {
    dataRange?: DashboardDataRange;
    appVersion?: string;
    firstSessionDate?: string | null;
  };
}

export interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  icon: LucideIcon;
  accentColor?: string;
}

export interface EmptyStateProps {
  message: string;
}

export interface ActivityHeatmapProps {
  data: Record<string, number>;
  dateFrom: string;
  dateTo: string;
}

export interface ActivityTimelineProps {
  data: DashboardTimelinePoint[];
  granularity: Granularity;
  limitResets: LimitEvent[];
  isExporting?: boolean;
}

export interface ModelDistributionProps {
  data: DashboardModelPoint[];
  isExporting?: boolean;
}

export interface HourlyPatternsProps {
  data: DashboardHourlyPoint[];
  isExporting?: boolean;
}

export interface DailyPatternsProps {
  data: DashboardDailyPoint[];
  isExporting?: boolean;
}

export interface CacheEfficiencyProps {
  cacheRead: number;
  cacheWrite: number;
}

export interface SessionsTableProps {
  sessions: DashboardSession[];
  isExporting?: boolean;
}
