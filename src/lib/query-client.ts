import { QueryClient } from '@tanstack/react-query';

// Create a properly configured QueryClient with advanced caching strategies
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Static reference data (branches, leave types, compliance types)
      staleTime: 30 * 60 * 1000, // 30 minutes
      gcTime: 60 * 60 * 1000, // 1 hour (formerly cacheTime)
      retry: 2,
      refetchOnWindowFocus: true, // Enable background refetching on window focus
      refetchOnMount: true,
      refetchOnReconnect: true, // Refetch when network reconnects
      retryOnMount: true,
      notifyOnChangeProps: 'all', // Optimize re-renders
    },
    mutations: {
      retry: 1,
      // Global mutation settings for optimistic updates
      onMutate: () => {
        // This can be overridden per mutation
      },
    },
  },
});

// Cache time configurations for different data types with background sync
export const cacheConfig = {
  // Static reference data - long cache times, background refetch
  static: {
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: true,
    refetchInterval: false, // No automatic interval for static data
  },
  // Dynamic user data - medium cache times with background sync
  dynamic: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    refetchOnWindowFocus: true,
    refetchInterval: 10 * 60 * 1000, // Background sync every 10 minutes
  },
  // Real-time data - short cache times with frequent background sync
  realtime: {
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    refetchInterval: 2 * 60 * 1000, // Background sync every 2 minutes
  },
  // Settings data - medium-long cache times
  settings: {
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: true,
    refetchInterval: false, // Settings don't need frequent updates
  },
} as const;

// Prefetching utilities for related data
export const prefetchConfig = {
  // Prefetch employee details when viewing employee list
  employeeDetails: (employeeId: string) => ({
    queryKey: ['employees', 'detail', employeeId],
    staleTime: 5 * 60 * 1000, // 5 minutes
  }),
  // Prefetch leave history when viewing employee
  employeeLeaves: (employeeId: string) => ({
    queryKey: ['leaves', 'employee', employeeId],
    staleTime: 2 * 60 * 1000, // 2 minutes
  }),
  // Prefetch compliance records when viewing compliance types
  complianceRecords: (typeId: string, year: number) => ({
    queryKey: ['compliance', 'periods', typeId, year],
    staleTime: 2 * 60 * 1000, // 2 minutes
  }),
} as const;