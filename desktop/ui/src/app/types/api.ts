/**
 * TypeScript types for Command Center API
 *
 * These types match the JSON contract from Python tauri_api module.
 */

export type Granularity = 'month' | 'week' | 'day';

export interface DateRange {
  from: string;  // YYYY-MM-DD
  to: string;    // YYYY-MM-DD
}

export interface Totals {
  messages: number;
  sessions: number;
  tokens: number;
  input_tokens: number;
  output_tokens: number;
  cost: number;
  cache_read: number;
  cache_write: number;
  current_streak: number;
  max_streak: number;
  first_session_date: string | null;
}

export interface TimelineDataPoint {
  period: string;
  messages: number;
  tokens: number;
  input_tokens: number;
  output_tokens: number;
  cost: number;
}

export interface Timeline {
  granularity: Granularity;
  data: TimelineDataPoint[];
}

export interface ModelDistributionItem {
  model: string;
  display_name: string;
  tokens: number;
  input_tokens: number;
  output_tokens: number;
  messages: number;
  cost: number;
  percent: number;
}

export interface HourlyDataPoint {
  hour: number;
  messages: number;
  tokens: number;
  input_tokens: number;
  output_tokens: number;
}

export interface SessionSummary {
  session_id: string;
  model: string;
  display_name: string;
  messages: number;
  tokens: number;
  input_tokens: number;
  output_tokens: number;
  cost: number;
  first_time: string;
  last_time: string;
}

export interface DashboardBundle {
  range: DateRange;
  totals: Totals;
  daily_activity: Record<string, number>;
  timeline: Timeline;
  model_distribution: ModelDistributionItem[];
  hourly_profile: HourlyDataPoint[];
  recent_sessions: SessionSummary[];
  meta?: {
    updated_files: number;
    generated_at: string;
  };
}

// Drill-down types

export interface DayDetails {
  date: string;
  totals: {
    messages: number;
    sessions: number;
    tokens: number;
    input_tokens: number;
    output_tokens: number;
    cost: number;
  };
  hourly: Array<{
    hour: number;
    messages: number;
    tokens: number;
    cost: number;
  }>;
  models: Array<{
    model: string;
    display_name: string;
    messages: number;
    tokens: number;
    input_tokens: number;
    output_tokens: number;
    cost: number;
  }>;
  sessions: SessionSummary[];
}

export interface ModelDetails {
  model: string;
  display_name: string;
  range: DateRange;
  totals: {
    messages: number;
    sessions: number;
    tokens: number;
    input_tokens: number;
    output_tokens: number;
    cache_read: number;
    cache_write: number;
    cost: number;
  };
  daily_activity: Record<string, {
    messages: number;
    tokens: number;
  }>;
  sessions: Array<{
    session_id: string;
    messages: number;
    tokens: number;
    cost: number;
    first_time: string;
    last_time: string;
  }>;
}

export interface SessionDetails {
  session_id: string;
  model: string;
  display_name: string;
  date: string;
  first_time: string;
  last_time: string;
  totals: {
    messages: number;
    tokens: number;
    input_tokens: number;
    output_tokens: number;
    cache_read: number;
    cache_write: number;
    cost: number;
  };
  messages: Array<{
    timestamp: string;
    model: string;
    display_name: string;
    input_tokens: number;
    output_tokens: number;
    cache_read: number;
    cache_write: number;
    cost: number;
  }>;
}

// Error response
export interface ApiError {
  error: string;
  type?: string;
}
