import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cacheConfig } from '@/lib/query-client';

interface ComplianceType {
  id: string;
  name: string;
  description?: string;
  frequency: string;
  target_table: string;
  has_questionnaire?: boolean;
  questionnaire_id?: string;
  created_at: string;
  updated_at: string;
}

interface ComplianceRecord {
  id: string;
  employee_id: string;
  compliance_task_id: string;
  completion_date: string;
  next_due_date: string;
  completed_by?: string;
  notes?: string;
  created_at: string;
}

// Query keys for consistent cache management
export const complianceQueryKeys = {
  all: ['compliance'] as const,
  types: () => [...complianceQueryKeys.all, 'types'] as const,
  type: (id: string) => [...complianceQueryKeys.types(), id] as const,
  records: () => [...complianceQueryKeys.all, 'records'] as const,
  record: (id: string) => [...complianceQueryKeys.records(), id] as const,
  periods: (typeId: string, year: number) => [...complianceQueryKeys.all, 'periods', typeId, year] as const,
};

// Fetch compliance types
async function fetchComplianceTypes(): Promise<ComplianceType[]> {
  const { data, error } = await supabase
    .from('compliance_types')
    .select('*')
    .order('name');

  if (error) throw error;
  return data || [];
}

// Fetch compliance periods - updated to match actual table structure
async function fetchCompliancePeriods(typeId: string, year: number) {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

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
}

// React Query hooks
export function useComplianceTypes() {
  return useQuery({
    queryKey: complianceQueryKeys.types(),
    queryFn: fetchComplianceTypes,
    ...cacheConfig.static, // Static reference data gets long cache
  });
}

export function useCompliancePeriods(typeId: string, year: number) {
  return useQuery({
    queryKey: complianceQueryKeys.periods(typeId, year),
    queryFn: () => fetchCompliancePeriods(typeId, year),
    ...cacheConfig.realtime, // Real-time data gets short cache
    enabled: !!typeId && !!year,
  });
}

// Mutation hooks for compliance actions
export function useComplianceActions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createComplianceRecord = useMutation({
    mutationFn: async (recordData: Omit<ComplianceRecord, 'id' | 'created_at'>) => {
      // Get current user ID for audit trail
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      const { data, error } = await supabase
        .from('compliance_records')
        .insert([{
          ...recordData,
          created_by: userId,
          updated_by: userId
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    // Optimistic update for immediate UI feedback
    onMutate: async (newRecord) => {
      await queryClient.cancelQueries({ queryKey: complianceQueryKeys.records() });
      await queryClient.cancelQueries({ 
        queryKey: complianceQueryKeys.periods(newRecord.compliance_task_id, new Date().getFullYear()) 
      });
      
      const previousRecords = queryClient.getQueryData(complianceQueryKeys.records());
      
      // Create optimistic record with temporary ID
      const optimisticRecord = {
        ...newRecord,
        id: `temp-${Date.now()}`,
        created_at: new Date().toISOString(),
      };
      
      // Update records cache
      queryClient.setQueryData<ComplianceRecord[]>(complianceQueryKeys.records(), (old) => {
        if (!old) return [optimisticRecord];
        return [optimisticRecord, ...old];
      });
      
      return { previousRecords };
    },
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: complianceQueryKeys.records() });
      queryClient.invalidateQueries({ 
        queryKey: complianceQueryKeys.periods(data.compliance_task_id, new Date().getFullYear()) 
      });
      toast({
        title: "Success",
        description: "Compliance record created successfully.",
      });
    },
    onError: (error: any, variables, context) => {
      if (context?.previousRecords) {
        queryClient.setQueryData(complianceQueryKeys.records(), context.previousRecords);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to create compliance record.",
        variant: "destructive",
      });
    },
  });

  const updateComplianceRecord = useMutation({
    mutationFn: async ({ id, ...updateData }: Partial<ComplianceRecord> & { id: string }) => {
      // Get current user ID for audit trail
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      const { data, error } = await supabase
        .from('compliance_records')
        .update({
          ...updateData,
          updated_by: userId
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: complianceQueryKeys.records() });
      queryClient.invalidateQueries({ 
        queryKey: complianceQueryKeys.periods(data.compliance_task_id, new Date().getFullYear()) 
      });
      toast({
        title: "Success",
        description: "Compliance record updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update compliance record.",
        variant: "destructive",
      });
    },
  });

  const deleteComplianceRecord = useMutation({
    mutationFn: async (recordId: string) => {
      const { error } = await supabase
        .from('compliance_records')
        .delete()
        .eq('id', recordId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: complianceQueryKeys.records() });
      queryClient.invalidateQueries({ queryKey: complianceQueryKeys.all });
      toast({
        title: "Success",
        description: "Compliance record deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete compliance record.",
        variant: "destructive",
      });
    },
  });

  const createComplianceType = useMutation({
    mutationFn: async (typeData: Omit<ComplianceType, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('compliance_types')
        .insert([typeData])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: complianceQueryKeys.types() });
      toast({
        title: "Success",
        description: "Compliance type created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create compliance type.",
        variant: "destructive",
      });
    },
  });

  return {
    createComplianceRecord,
    updateComplianceRecord,
    deleteComplianceRecord,
    createComplianceType,
  };
}