/**
 * React Query hooks for Tauri API calls
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type {
  DashboardBundle,
  DayDetails,
  ModelDetails,
  SessionDetails,
  Granularity,
  LimitEvent,
  ProjectsResponse,
  UpdateProjectParams,
  UpdateProjectResponse,
} from '../types/api';

// Check if running in Tauri
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// Map Tauri command names to browser API paths
const ENDPOINT_MAP: Record<string, string> = {
  get_dashboard_bundle: 'dashboard',
  get_day_details: 'day',
  get_model_details: 'model',
  get_session_details: 'session',
  get_limit_resets: 'limits',
  get_projects: 'projects',
  update_project: 'update-project',
};

// API adapter - uses Tauri invoke in desktop, fetch in browser
async function apiCall<T>(endpoint: string, params: Record<string, any>): Promise<T> {
  // Filter out null/undefined values
  const filteredParams = Object.fromEntries(
    Object.entries(params).filter(([_, v]) => v !== null && v !== undefined)
  );

  if (isTauri) {
    return invoke<T>(endpoint, filteredParams);
  } else {
    // Browser mode - use Vite dev server API
    const apiPath = ENDPOINT_MAP[endpoint] || endpoint;

    // Detect if this is a mutation (POST) or query (GET)
    const isMutation = endpoint.startsWith('update_') || endpoint.startsWith('delete_') || endpoint.startsWith('create_');

    if (isMutation) {
      // POST request with JSON body
      const response = await fetch(`/api/${apiPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(filteredParams),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.statusText} - ${errorText}`);
      }
      return response.json();
    } else {
      // GET request with query params
      const queryParams = new URLSearchParams(
        Object.entries(filteredParams).map(([k, v]) => [k, String(v)])
      ).toString();
      const response = await fetch(`/api/${apiPath}?${queryParams}`);
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      return response.json();
    }
  }
}

// Dashboard bundle query
export function useDashboard(
  from: string,
  to: string,
  refresh: boolean,
  granularity: Granularity,
  projectId: string | null = null
) {
  return useQuery({
    queryKey: ['dashboard', from, to, refresh, granularity, projectId],
    queryFn: async () => {
      const params = { from, to, refresh, granularity, projectId: projectId };
      console.log('[Dashboard] Calling API with params:', JSON.stringify(params));
      const result = await apiCall<DashboardBundle>('get_dashboard_bundle', params);
      console.log('[Dashboard] Got result, totals.messages:', result.totals.messages);
      return result;
    },
    staleTime: 30_000, // 30 seconds
    retry: 2,
  });
}

// Day details query
export function useDayDetails(date: string | null, projectId: string | null = null) {
  return useQuery({
    queryKey: ['day', date, projectId],
    queryFn: () => apiCall<DayDetails>('get_day_details', { date: date!, projectId: projectId }),
    enabled: !!date,
    staleTime: 60_000, // 1 minute
  });
}

// Model details query
export function useModelDetails(
  model: string | null,
  from: string,
  to: string,
  projectId: string | null = null
) {
  return useQuery({
    queryKey: ['model', model, from, to, projectId],
    queryFn: () =>
      apiCall<ModelDetails>('get_model_details', {
        model: model!,
        from,
        to,
        projectId: projectId,
      }),
    enabled: !!model,
    staleTime: 60_000, // 1 minute
  });
}

// Session details query
export function useSessionDetails(sessionId: string | null, projectId: string | null = null) {
  return useQuery({
    queryKey: ['session', sessionId, projectId],
    queryFn: () =>
      apiCall<SessionDetails>('get_session_details', {
        sessionId: sessionId!,
        projectId: projectId,
      }),
    enabled: !!sessionId,
    staleTime: 300_000, // 5 minutes
  });
}

// Limit resets query
export function useLimitResets(from: string, to: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['limits', from, to],
    queryFn: () =>
      apiCall<LimitEvent[]>('get_limit_resets', {
        from,
        to,
      }),
    enabled,
    staleTime: 60_000, // 1 minute
  });
}

// Projects query
export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => apiCall<ProjectsResponse>('get_projects', {}),
    staleTime: 300_000, // 5 minutes - data rarely changes
  });
}

// Update project mutation
export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: UpdateProjectParams) => {
      return apiCall<UpdateProjectResponse>('update_project', {
        projectId: params.projectId,
        name: params.name,
        description: params.description,
        visible: params.visible,
      });
    },
    onSuccess: () => {
      // Invalidate projects query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
