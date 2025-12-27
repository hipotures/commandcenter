/**
 * React Query hooks for Tauri API calls
 */
import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type {
  DashboardBundle,
  DayDetails,
  ModelDetails,
  SessionDetails,
  Granularity,
} from '../types/api';

// Dashboard bundle query
export function useDashboard(
  from: string,
  to: string,
  refresh: boolean,
  granularity: Granularity
) {
  return useQuery({
    queryKey: ['dashboard', from, to, refresh, granularity],
    queryFn: async () => {
      const result = await invoke<DashboardBundle>('get_dashboard_bundle', {
        params: { from, to, refresh, granularity },
      });
      return result;
    },
    staleTime: 30_000, // 30 seconds
    retry: 2,
  });
}

// Day details query
export function useDayDetails(date: string | null) {
  return useQuery({
    queryKey: ['day', date],
    queryFn: async () => {
      const result = await invoke<DayDetails>('get_day_details', {
        params: { date: date! },
      });
      return result;
    },
    enabled: !!date,
    staleTime: 60_000, // 1 minute
  });
}

// Model details query
export function useModelDetails(
  model: string | null,
  from: string,
  to: string
) {
  return useQuery({
    queryKey: ['model', model, from, to],
    queryFn: async () => {
      const result = await invoke<ModelDetails>('get_model_details', {
        params: { model: model!, from, to },
      });
      return result;
    },
    enabled: !!model,
    staleTime: 60_000, // 1 minute
  });
}

// Session details query
export function useSessionDetails(sessionId: string | null) {
  return useQuery({
    queryKey: ['session', sessionId],
    queryFn: async () => {
      const result = await invoke<SessionDetails>('get_session_details', {
        params: { sessionId: sessionId! },
      });
      return result;
    },
    enabled: !!sessionId,
    staleTime: 300_000, // 5 minutes
  });
}
