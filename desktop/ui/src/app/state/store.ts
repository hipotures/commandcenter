/**
 * Global application state using Zustand
 */
import { create } from 'zustand';
import type { Granularity } from '../types/api';

type DrawerType = 'messages' | 'sessions' | 'tokens' | 'cost' | 'streak' | 'cache' | null;

interface AppState {
  // Theme
  darkMode: boolean;
  toggleDarkMode: () => void;

  // Date range
  dateFrom: string;
  dateTo: string;
  setDateRange: (from: string, to: string) => void;

  // Granularity
  granularity: Granularity;
  setGranularity: (g: Granularity) => void;

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

export const useAppStore = create<AppState>((set) => ({
  // Theme
  darkMode: false,
  toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),

  // Date range
  dateFrom: defaultFrom,
  dateTo: defaultTo,
  setDateRange: (from, to) => set({ dateFrom: from, dateTo: to }),

  // Granularity
  granularity: 'month',
  setGranularity: (granularity) => set({ granularity }),

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

  // Search
  searchQuery: '',
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
