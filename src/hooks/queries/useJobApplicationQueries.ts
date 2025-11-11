import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cacheConfig } from '@/lib/query-client';

export interface JobApplication {
  id: string;
  personal_info: any;
  availability: any;
  emergency_contact: any;
  employment_history: any;
  reference_info: any;
  skills_experience: any;
  declarations: any;
  consent: any;
  status: string;
  created_at: string;
  updated_at: string;
}

// Query Keys
export const jobApplicationQueryKeys = {
  all: ['job-applications'] as const,
  list: (filters?: any) => [...jobApplicationQueryKeys.all, 'list', filters] as const,
  statusSettings: () => [...jobApplicationQueryKeys.all, 'status-settings'] as const,
} as const;

// Data fetching functions
export const fetchJobApplications = async (filters?: {
  statusFilter?: string;
  sortField?: string;
  sortDirection?: string;
  dateRange?: { from?: Date; to?: Date };
  page?: number;
  pageSize?: number;
}) => {
  let query = supabase
    .from('job_applications')
    .select('*', { count: 'exact' });

  if (filters?.statusFilter && filters.statusFilter !== 'all') {
    query = query.eq('status', filters.statusFilter);
  }

  if (filters?.dateRange?.from) {
    query = query.gte('created_at', filters.dateRange.from.toISOString());
  }
  if (filters?.dateRange?.to) {
    const toDate = new Date(filters.dateRange.to);
    toDate.setDate(toDate.getDate() + 1);
    query = query.lt('created_at', toDate.toISOString());
  }

  if (filters?.sortField === 'created_at') {
    query = query.order('created_at', { ascending: filters.sortDirection === 'asc' });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  if (filters?.page && filters?.pageSize) {
    const from = (filters.page - 1) * filters.pageSize;
    const toIdx = from + filters.pageSize - 1;
    query = query.range(from, toIdx);
  }

  const { data, error, count } = await query;

  if (error) throw error;
  
  return {
    applications: data || [],
    totalCount: count || 0,
  };
};

export const fetchStatusOptions = async () => {
  const { data, error } = await supabase
    .from('job_application_settings')
    .select('*')
    .eq('category', 'status')
    .eq('is_active', true)
    .order('display_order', { ascending: true });
    
  if (error) throw error;
  
  const statusOptions = data?.map(d => 
    typeof d.setting_value === 'object' && d.setting_value && 'status_name' in d.setting_value
      ? (d.setting_value as any).status_name
      : d.setting_key
  ).filter(Boolean) || [];
  return statusOptions.length > 0 ? statusOptions : ['new', 'reviewing', 'interviewed', 'accepted', 'rejected'];
};

// Query Hooks
export function useJobApplications(filters?: {
  statusFilter?: string;
  sortField?: string;
  sortDirection?: string;
  dateRange?: { from?: Date; to?: Date };
  page?: number;
  pageSize?: number;
}) {
  return useQuery({
    queryKey: jobApplicationQueryKeys.list(filters),
    queryFn: () => fetchJobApplications(filters),
    ...cacheConfig.realtime, // Real-time updates for job applications
  });
}

export function useJobApplicationStatusOptions() {
  return useQuery({
    queryKey: jobApplicationQueryKeys.statusSettings(),
    queryFn: fetchStatusOptions,
    ...cacheConfig.static,
  });
}

// Mutation Hooks
export function useJobApplicationActions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteApplication = useMutation({
    mutationFn: async (applicationId: string) => {
      const { error } = await supabase
        .from('job_applications')
        .delete()
        .eq('id', applicationId);

      if (error) throw error;
    },
    // Optimistic update for immediate UI feedback
    onMutate: async (applicationId) => {
      await queryClient.cancelQueries({ queryKey: jobApplicationQueryKeys.all });
      
      const previousApplications = queryClient.getQueryData(jobApplicationQueryKeys.all);
      
      // Update all list queries to remove the application
      queryClient.setQueriesData(
        { queryKey: jobApplicationQueryKeys.all },
        (old: any) => {
          if (old?.applications) {
            return {
              ...old,
              applications: old.applications.filter((app: any) => app.id !== applicationId),
              totalCount: Math.max(0, old.totalCount - 1)
            };
          }
          return old;
        }
      );
      
      return { previousApplications };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobApplicationQueryKeys.all });
      toast({
        title: "Application Deleted",
        description: "The job application has been deleted successfully.",
      });
    },
    onError: (error: any, variables, context) => {
      if (context?.previousApplications) {
        queryClient.setQueryData(jobApplicationQueryKeys.all, context.previousApplications);
      }
      console.error('Error deleting application:', error);
      toast({
        title: "Error",
        description: "Failed to delete application",
        variant: "destructive",
      });
    },
  });

  const updateApplicationStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await supabase
        .from('job_applications')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    // Optimistic update for immediate UI feedback
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: jobApplicationQueryKeys.all });
      
      const previousApplications = queryClient.getQueryData(jobApplicationQueryKeys.all);
      
      // Update all list queries with new status
      queryClient.setQueriesData(
        { queryKey: jobApplicationQueryKeys.all },
        (old: any) => {
          if (old?.applications) {
            return {
              ...old,
              applications: old.applications.map((app: any) => 
                app.id === id 
                  ? { ...app, status, updated_at: new Date().toISOString() }
                  : app
              )
            };
          }
          return old;
        }
      );
      
      return { previousApplications };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobApplicationQueryKeys.all });
      toast({
        title: "Status Updated",
        description: "Application status has been updated successfully.",
      });
    },
    onError: (error: any, variables, context) => {
      if (context?.previousApplications) {
        queryClient.setQueryData(jobApplicationQueryKeys.all, context.previousApplications);
      }
      console.error('Error updating application status:', error);
      toast({
        title: "Error",
        description: "Failed to update application status",
        variant: "destructive",
      });
    },
  });

  return {
    deleteApplication,
    updateApplicationStatus,
  };
}