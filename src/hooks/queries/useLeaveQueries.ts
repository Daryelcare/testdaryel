import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cacheConfig } from '@/lib/query-client';
import { Leave, Employee, LeaveType } from '@/components/leaves/types';

interface Branch {
  id: string;
  name: string;
}

// Query keys for consistent cache management
export const leaveQueryKeys = {
  all: ['leaves'] as const,
  lists: () => [...leaveQueryKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...leaveQueryKeys.lists(), { filters }] as const,
  details: () => [...leaveQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...leaveQueryKeys.details(), id] as const,
  employees: ['employees'] as const,
  leaveTypes: ['leave-types'] as const,
  branches: ['branches'] as const,
};

// Fetch leaves with employee and leave type data
async function fetchLeaves(): Promise<Leave[]> {
  const { data: leavesData, error: leavesError } = await supabase
    .from('leave_requests')
    .select(`
      *,
      employees!leave_requests_employee_id_fkey(
        id, name, email, employee_code, remaining_leave_days, leave_taken, branch_id,
        branches!employees_branch_id_fkey (id, name)
      ),
      leave_types!leave_requests_leave_type_id_fkey(id, name, reduces_balance)
    `)
    .order('created_at', { ascending: false });

  if (leavesError) throw leavesError;

  // Get user details for approved_by and rejected_by
  const approvedByIds = leavesData
    ?.map(leave => leave.approved_by)
    .filter(id => id) as string[];
  
  const rejectedByIds = leavesData
    ?.map(leave => leave.rejected_by)
    .filter(id => id) as string[];
  
  const allUserIds = [...new Set([...approvedByIds, ...rejectedByIds])];
  
  let userRoles: any[] = [];
  if (allUserIds.length > 0) {
    const { data: userRolesData } = await supabase
      .from('user_roles')
      .select('user_id, email')
      .in('user_id', allUserIds);
    userRoles = userRolesData || [];
  }

  // Transform the data to match our interface
  return leavesData?.map(leave => {
    const startDate = new Date(leave.start_date);
    const endDate = new Date(leave.end_date);
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    const approvedByUser = userRoles.find(ur => ur.user_id === leave.approved_by);
    const rejectedByUser = userRoles.find(ur => ur.user_id === leave.rejected_by);
    
    return {
      ...leave,
      days,
      days_requested: leave.days_requested || days,
      status: leave.status as 'pending' | 'approved' | 'rejected',
      employee: leave.employees,
      leave_type: leave.leave_types,
      employee_name: leave.employees?.name || '',
      leave_type_name: leave.leave_types?.name || '',
      employee_branch_id: leave.employees?.branch_id || '',
      approved_by_user: approvedByUser || null,
      rejected_by_user: rejectedByUser || null
    };
  }) || [];
}

// Fetch employees
async function fetchEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase
    .from('employees')
    .select(`
      id, name, email, employee_code, remaining_leave_days, leave_taken, branch_id,
      branches!employees_branch_id_fkey (id, name)
    `)
    .order('name');

  if (error) throw error;
  return data || [];
}

// Fetch leave types
async function fetchLeaveTypes(): Promise<LeaveType[]> {
  const { data, error } = await supabase
    .from('leave_types')
    .select('*')
    .order('name');

  if (error) throw error;
  return data || [];
}

// Fetch branches
async function fetchBranches(): Promise<Branch[]> {
  const { data, error } = await supabase
    .from('branches')
    .select('id, name')
    .order('name');

  if (error) throw error;
  return data || [];
}

// React Query hooks
export function useLeaves() {
  return useQuery({
    queryKey: leaveQueryKeys.lists(),
    queryFn: fetchLeaves,
    ...cacheConfig.realtime, // Real-time data gets short cache
  });
}

export function useEmployees() {
  return useQuery({
    queryKey: leaveQueryKeys.employees,
    queryFn: fetchEmployees,
    ...cacheConfig.dynamic, // Dynamic user data gets medium cache
  });
}

export function useLeaveTypes() {
  return useQuery({
    queryKey: leaveQueryKeys.leaveTypes,
    queryFn: fetchLeaveTypes,
    ...cacheConfig.static, // Static reference data gets long cache
  });
}

export function useBranches() {
  return useQuery({
    queryKey: leaveQueryKeys.branches,
    queryFn: fetchBranches,
    ...cacheConfig.static, // Static reference data gets long cache
  });
}

// Mutation hooks for leave actions
export function useLeaveActions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const approveLeave = useMutation({
    mutationFn: async ({ leaveId, userId }: { leaveId: string; userId: string }) => {
      const { error } = await supabase
        .from('leave_requests')
        .update({ 
          status: 'approved', 
          approved_by: userId,
          approved_at: new Date().toISOString()
        })
        .eq('id', leaveId);
      
      if (error) throw error;
      return { leaveId, status: 'approved', approved_by: userId, approved_at: new Date().toISOString() };
    },
    // Optimistic update for immediate UI feedback
    onMutate: async ({ leaveId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: leaveQueryKeys.lists() });
      
      // Snapshot previous value
      const previousLeaves = queryClient.getQueryData<Leave[]>(leaveQueryKeys.lists());
      
      // Optimistically update cache
      queryClient.setQueryData<Leave[]>(leaveQueryKeys.lists(), (old) => {
        if (!old) return [];
        return old.map(leave => 
          leave.id === leaveId 
            ? { ...leave, status: 'approved' as const }
            : leave
        );
      });
      
      return { previousLeaves };
    },
    onSuccess: () => {
      // Invalidate and refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: leaveQueryKeys.lists() });
      toast({
        title: "Leave Approved",
        description: "Leave request has been approved successfully.",
      });
    },
    onError: (error: any, variables, context) => {
      // Rollback optimistic update on error
      if (context?.previousLeaves) {
        queryClient.setQueryData(leaveQueryKeys.lists(), context.previousLeaves);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to approve leave request.",
        variant: "destructive",
      });
    },
  });

  const rejectLeave = useMutation({
    mutationFn: async ({ leaveId, userId, reason }: { leaveId: string; userId: string; reason?: string }) => {
      const { error } = await supabase
        .from('leave_requests')
        .update({ 
          status: 'rejected', 
          rejected_by: userId,
          rejected_at: new Date().toISOString(),
          rejection_reason: reason
        })
        .eq('id', leaveId);
      
      if (error) throw error;
      return { leaveId, status: 'rejected', rejected_by: userId, rejection_reason: reason };
    },
    // Optimistic update for immediate UI feedback
    onMutate: async ({ leaveId, reason }) => {
      await queryClient.cancelQueries({ queryKey: leaveQueryKeys.lists() });
      
      const previousLeaves = queryClient.getQueryData<Leave[]>(leaveQueryKeys.lists());
      
      queryClient.setQueryData<Leave[]>(leaveQueryKeys.lists(), (old) => {
        if (!old) return [];
        return old.map(leave => 
          leave.id === leaveId 
            ? { ...leave, status: 'rejected' as const, rejection_reason: reason }
            : leave
        );
      });
      
      return { previousLeaves };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaveQueryKeys.lists() });
      toast({
        title: "Leave Rejected",
        description: "Leave request has been rejected.",
      });
    },
    onError: (error: any, variables, context) => {
      if (context?.previousLeaves) {
        queryClient.setQueryData(leaveQueryKeys.lists(), context.previousLeaves);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to reject leave request.",
        variant: "destructive",
      });
    },
  });

  return {
    approveLeave,
    rejectLeave,
  };
}