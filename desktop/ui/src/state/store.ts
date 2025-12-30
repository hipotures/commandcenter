/**
 * Global application state using Zustand
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Granularity } from '../types/api';
import type { DateFormatId } from '../lib/date';
import { DEFAULT_DATE_FORMAT } from '../lib/date';

type DrawerType = 'messages' | 'sessions' | 'tokens' | 'cost' | 'streak' | 'cache' | null;

interface AppState {
  // Theme
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  toggleDarkMode: () => void;

  // Date format
  dateFormat: DateFormatId;
  setDateFormat: (format: DateFormatId) => void;

  // Date range
  dateFrom: string;
  dateTo: string;
  setDateFrom: (from: string) => void;
  setDateTo: (to: string) => void;
  setDateRange: (from: string, to: string) => void;

  // Granularity
  granularity: Granularity;
  setGranularity: (g: Granularity) => void;

  // Project filter
  selectedProjectId: string | null;  // null = "All projects"
  setSelectedProjectId: (projectId: string | null) => void;

  // Drill-down state
  selectedDay: string | null;
  selectedModel: string | null;
  selectedSession: string | null;
  setSelectedDay: (day: string | null) => void;
  setSelectedModel: (model: string | null) => void;
  setSelectedSession: (session: string | null) => void;

  // Live mode
  liveMode: boolean;
  liveInterval: number;  // seconds
  toggleLiveMode: () => void;
  setLiveInterval: (seconds: number) => void;

  // Selected items (for filtering)
  selectedHour: number | null;
  setSelectedHour: (hour: number | null) => void;

  // Drawers
  activeDrawer: DrawerType;
  setActiveDrawer: (drawer: DrawerType) => void;

  // Settings
  settingsOpen: boolean;
  toggleSettings: () => void;

  // Privacy settings
  visibleUsageAccounts: string[];
  toggleUsageAccount: (email: string) => void;
  setVisibleUsageAccounts: (emails: string[]) => void;

  // Search filter (for sessions table)
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

// Helper to get current date in YYYY-MM-DD format
const today = () => {
  const now = new Date();
  return now.toISOString().slice(0, 10);
};

// Default date range: current year
const now = new Date();
const defaultFrom = `${now.getFullYear()}-01-01`;
const defaultTo = today();

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Theme
      darkMode: false,
      setDarkMode: (darkMode) => set({ darkMode }),
      toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),

      // Date format
      dateFormat: DEFAULT_DATE_FORMAT,
      setDateFormat: (dateFormat) => set({ dateFormat }),

      // Date range
      dateFrom: defaultFrom,
      dateTo: defaultTo,
      setDateFrom: (dateFrom) => set({ dateFrom }),
      setDateTo: (dateTo) => set({ dateTo }),
      setDateRange: (from, to) => set({ dateFrom: from, dateTo: to }),

      // Granularity
      granularity: 'month',
      setGranularity: (granularity) => set({ granularity }),

      // Project filter
      selectedProjectId: null,
      setSelectedProjectId: (selectedProjectId) => set({ selectedProjectId }),

      // Drill-down state
      selectedDay: null,
      selectedModel: null,
      selectedSession: null,
      setSelectedDay: (selectedDay) => set({ selectedDay }),
      setSelectedModel: (selectedModel) => set({ selectedModel }),
      setSelectedSession: (selectedSession) => set({ selectedSession }),

      // Live mode
      liveMode: false,
      liveInterval: 30,
      toggleLiveMode: () => set((s) => ({ liveMode: !s.liveMode })),
      setLiveInterval: (liveInterval) => set({ liveInterval }),

      // Selected items
      selectedHour: null,
      setSelectedHour: (selectedHour) => set({ selectedHour }),

      // Drawers
      activeDrawer: null,
      setActiveDrawer: (activeDrawer) => set({ activeDrawer }),

      // Settings
      settingsOpen: false,
      toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),

      // Privacy settings
      visibleUsageAccounts: [],
      toggleUsageAccount: (email) =>
        set((s) => {
          const exists = s.visibleUsageAccounts.includes(email);
          return {
            visibleUsageAccounts: exists
              ? s.visibleUsageAccounts.filter((entry) => entry !== email)
              : [...s.visibleUsageAccounts, email],
          };
        }),
      setVisibleUsageAccounts: (visibleUsageAccounts) => set({ visibleUsageAccounts }),

      // Search
      searchQuery: '',
      setSearchQuery: (searchQuery) => set({ searchQuery }),
    }),
    {
      name: 'command-center-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        darkMode: state.darkMode,
        dateFormat: state.dateFormat,
        dateFrom: state.dateFrom,
        dateTo: state.dateTo,
        selectedProjectId: state.selectedProjectId,
        visibleUsageAccounts: state.visibleUsageAccounts,
      }),
    }
  )
);
