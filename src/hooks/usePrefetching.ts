import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { employeeQueryKeys } from './queries/useEmployeeQueries';
import { leaveQueryKeys } from './queries/useLeaveQueries';
import { complianceQueryKeys } from './queries/useComplianceQueries';
import { clientQueryKeys } from './queries/useClientQueries';
import { supabase } from '@/integrations/supabase/client';
import { cacheConfig } from '@/lib/query-client';

/**
 * Hook for intelligent prefetching strategies
 * Prefetches related data based on user interactions
 */
export function usePrefetching() {
  const queryClient = useQueryClient();

  // Prefetch employee leaves when hovering over employee
  const prefetchEmployeeLeaves = useCallback(async (employeeId: string) => {
    await queryClient.prefetchQuery({
      queryKey: [...leaveQueryKeys.lists(), 'employee', employeeId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('leave_requests')
          .select(`
            *,
            employees!leave_requests_employee_id_fkey(id, name, email, employee_code),
            leave_types!leave_requests_leave_type_id_fkey(id, name, reduces_balance)
          `)
          .eq('employee_id', employeeId)
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) throw error;
        return data || [];
      },
      ...cacheConfig.realtime,
    });
  }, [queryClient]);

  // Prefetch employee compliance records when viewing employee
  const prefetchEmployeeCompliance = useCallback(async (employeeId: string) => {
    await queryClient.prefetchQuery({
      queryKey: [...complianceQueryKeys.records(), 'employee', employeeId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('compliance_records')
          .select('*')
          .eq('employee_id', employeeId)
          .order('completion_date', { ascending: false })
          .limit(20);

        if (error) throw error;
        return data || [];
      },
      ...cacheConfig.realtime,
    });
  }, [queryClient]);

  // Prefetch compliance period data when selecting compliance type
  const prefetchCompliancePeriod = useCallback(async (typeId: string, year?: number) => {
    const currentYear = year || new Date().getFullYear();
    await queryClient.prefetchQuery({
      queryKey: complianceQueryKeys.periods(typeId, currentYear),
      queryFn: async () => {
        const startDate = `${currentYear}-01-01`;
        const endDate = `${currentYear}-12-31`;

        const { data, error } = await supabase
          .from('compliance_records')
          .select(`
            *,
            employees!compliance_records_employee_id_fkey(id, name, employee_code, branch)
          `)
          .eq('compliance_task_id', typeId)
          .gte('completion_date', startDate)
          .lte('completion_date', endDate)
          .order('completion_date', { ascending: false });

        if (error) throw error;
        return data || [];
      },
      ...cacheConfig.realtime,
    });
  }, [queryClient]);

  // Prefetch client compliance when viewing client  
  const prefetchClientCompliance = useCallback(async (clientId: string) => {
    // Note: Skipping client compliance as table structure needs verification
    // This can be implemented once the correct table structure is confirmed
    console.log('Client compliance prefetch not implemented yet for client:', clientId);
  }, [queryClient]);

  // Prefetch branches when creating new records
  const prefetchBranches = useCallback(async () => {
    await queryClient.prefetchQuery({
      queryKey: ['branches'],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('branches')
          .select('id, name')
          .order('name');

        if (error) throw error;
        return data || [];
      },
      ...cacheConfig.static,
    });
  }, [queryClient]);

  // Prefetch leave types when creating leave request
  const prefetchLeaveTypes = useCallback(async () => {
    await queryClient.prefetchQuery({
      queryKey: leaveQueryKeys.leaveTypes,
      queryFn: async () => {
        const { data, error } = await supabase
          .from('leave_types')
          .select('*')
          .order('name');

        if (error) throw error;
        return data || [];
      },
      ...cacheConfig.static,
    });
  }, [queryClient]);

  // Smart prefetching based on current route and user behavior
  const smartPrefetch = useCallback((currentRoute: string, context?: any) => {
    switch (currentRoute) {
      case '/employees':
        // Prefetch branches for employee creation
        prefetchBranches();
        break;
      
      case '/leaves':
        // Prefetch employees and leave types
        prefetchLeaveTypes();
        break;
      
      case '/compliance':
        // Prefetch compliance types and employees
        prefetchBranches();
        break;
      
      case '/clients':
        // Prefetch branches for client creation
        prefetchBranches();
        break;
      
      default:
        break;
    }
  }, [prefetchBranches, prefetchLeaveTypes]);

  return {
    prefetchEmployeeLeaves,
    prefetchEmployeeCompliance,
    prefetchCompliancePeriod,
    prefetchClientCompliance,
    prefetchBranches,
    prefetchLeaveTypes,
    smartPrefetch,
  };
}

/**
 * Hook for background data warming
 * Keeps frequently accessed data fresh in the background
 */
export function useBackgroundSync() {
  const queryClient = useQueryClient();

  // Warm up critical data in the background
  const warmupCriticalData = useCallback(() => {
    // Prefetch employees (commonly accessed)
    queryClient.prefetchQuery({
      queryKey: employeeQueryKeys.lists(),
      staleTime: 30 * 1000, // 30 seconds for background warming
    });

    // Prefetch pending leaves (high priority)
    queryClient.prefetchQuery({
      queryKey: [...leaveQueryKeys.lists(), { status: 'pending' }],
      staleTime: 30 * 1000,
    });

    // Prefetch branches (static data)
    queryClient.prefetchQuery({
      queryKey: ['branches'],
      staleTime: 5 * 60 * 1000, // 5 minutes for static data
    });
  }, [queryClient]);

  // Sync data when user becomes active
  const syncOnActivity = useCallback(() => {
    // Invalidate real-time data to ensure freshness
    queryClient.invalidateQueries({ 
      queryKey: leaveQueryKeys.lists(),
      refetchType: 'active' // Only refetch if component is mounted
    });
    
    queryClient.invalidateQueries({ 
      queryKey: complianceQueryKeys.records(),
      refetchType: 'active'
    });
  }, [queryClient]);

  return {
    warmupCriticalData,
    syncOnActivity,
  };
}