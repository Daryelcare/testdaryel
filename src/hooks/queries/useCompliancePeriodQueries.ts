import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cacheConfig } from '@/lib/query-client';

// Query Keys
export const compliancePeriodQueryKeys = {
  all: ['compliance-periods'] as const,
  periods: (typeId: string, year: number) => [...compliancePeriodQueryKeys.all, 'periods', typeId, year] as const,
  employees: (typeId: string, periodId: string) => [...compliancePeriodQueryKeys.all, 'employees', typeId, periodId] as const,
  clientPeriods: (typeId: string, year: number) => [...compliancePeriodQueryKeys.all, 'client-periods', typeId, year] as const,
  statements: () => [...compliancePeriodQueryKeys.all, 'statements'] as const,
} as const;

// Data fetching functions
export const fetchCompliancePeriodData = async (complianceTypeId: string, frequency: string, selectedYear: number) => {
  // Fetch employees with created_at date
  const { data: employeesData, error: employeesError } = await supabase
    .from('employees')
    .select(`
      id, name, branch_id, created_at,
      branches!employees_branch_id_fkey (id, name)
    `)
    .order('name');

  if (employeesError) throw employeesError;

  // Fetch compliance records for this type
  const { data: recordsData, error: recordsError } = await supabase
    .from('compliance_period_records')
    .select('*')
    .eq('compliance_type_id', complianceTypeId)
    .order('completion_date', { ascending: false });

  if (recordsError) throw recordsError;

  return {
    employees: employeesData || [],
    records: recordsData || [],
  };
};

export const fetchCompliancePeriodEmployeeData = async (complianceTypeId: string, periodIdentifier: string) => {
  // Fetch all employees with created_at date
  const { data: employeesData, error: employeesError } = await supabase
    .from('employees')
    .select(`
      id, name, branch_id, created_at,
      branches!employees_branch_id_fkey (id, name)
    `)
    .order('name');

  if (employeesError) throw employeesError;

  // Fetch compliance records for this type and period
  const { data: recordsData, error: recordsError } = await supabase
    .from('compliance_period_records')
    .select('*')
    .eq('compliance_type_id', complianceTypeId)
    .eq('period_identifier', periodIdentifier)
    .order('completion_date', { ascending: false });

  if (recordsError) throw recordsError;

  return {
    employees: employeesData || [],
    records: recordsData || [],
  };
};

export const fetchClientCompliancePeriodData = async (complianceTypeId: string, frequency: string, selectedYear: number, accessibleBranches?: string[], isAdmin?: boolean) => {
  // Build the query with branch filtering for non-admin users
  let clientsQuery = supabase
    .from('clients')
    .select(`
      *,
      branches (
        name
      )
    `);

  // Apply branch filtering for non-admin users
  if (!isAdmin && accessibleBranches && accessibleBranches.length > 0) {
    clientsQuery = clientsQuery.in('branch_id', accessibleBranches);
  }

  const { data: clientsData, error: clientsError } = await clientsQuery
    .eq('is_active', true)
    .order('name');

  if (clientsError) throw clientsError;

  // Fetch client compliance records
  const { data: recordsData, error: recordsError } = await supabase
    .from('client_compliance_period_records')
    .select('*')
    .eq('client_compliance_type_id', complianceTypeId)
    .order('completion_date', { ascending: false });

  if (recordsError) throw recordsError;

  return {
    clients: clientsData || [],
    records: recordsData || [],
  };
};

export const fetchCareWorkerStatements = async () => {
  const { data, error } = await supabase
    .from('care_worker_statements')
    .select(`
      *,
      employees:assigned_employee_id (name),
      branches:branch_id (name)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const fetchClientsForStatements = async (accessibleBranches?: string[], isAdmin?: boolean) => {
  // Build the query with branch filtering for non-admin users
  let clientsQuery = supabase
    .from('clients')
    .select(`
      id,
      name,
      branch_id,
      branches (
        name
      )
    `)
    .eq('is_active', true);

  // Apply branch filtering for non-admin users
  if (!isAdmin && accessibleBranches && accessibleBranches.length > 0) {
    clientsQuery = clientsQuery.in('branch_id', accessibleBranches);
  }

  const { data, error } = await clientsQuery.order('name');

  if (error) throw error;
  return data || [];
};

export const fetchStatementBranches = async () => {
  const { data, error } = await supabase
    .from('branches')
    .select('id, name')
    .order('name');

  if (error) throw error;
  return data || [];
};

// Query Hooks
export function useCompliancePeriodData(complianceTypeId: string, frequency: string, selectedYear: number) {
  return useQuery({
    queryKey: compliancePeriodQueryKeys.periods(complianceTypeId, selectedYear),
    queryFn: () => fetchCompliancePeriodData(complianceTypeId, frequency, selectedYear),
    enabled: !!complianceTypeId,
    ...cacheConfig.dynamic,
  });
}

export function useCompliancePeriodEmployeeData(complianceTypeId: string, periodIdentifier: string) {
  return useQuery({
    queryKey: compliancePeriodQueryKeys.employees(complianceTypeId, periodIdentifier),
    queryFn: () => fetchCompliancePeriodEmployeeData(complianceTypeId, periodIdentifier),
    enabled: !!complianceTypeId && !!periodIdentifier,
    ...cacheConfig.dynamic,
  });
}

export function useClientCompliancePeriodData(complianceTypeId: string, frequency: string, selectedYear: number, accessibleBranches?: string[], isAdmin?: boolean) {
  return useQuery({
    queryKey: compliancePeriodQueryKeys.clientPeriods(complianceTypeId, selectedYear),
    queryFn: () => fetchClientCompliancePeriodData(complianceTypeId, frequency, selectedYear, accessibleBranches, isAdmin),
    enabled: !!complianceTypeId,
    ...cacheConfig.dynamic,
  });
}

export function useCareWorkerStatements() {
  return useQuery({
    queryKey: compliancePeriodQueryKeys.statements(),
    queryFn: fetchCareWorkerStatements,
    ...cacheConfig.realtime, // Real-time updates for statements
  });
}

export function useStatementBranches() {
  return useQuery({
    queryKey: [...compliancePeriodQueryKeys.all, 'branches'],
    queryFn: fetchStatementBranches,
    ...cacheConfig.static,
  });
}

export function useClientsForStatements(accessibleBranches?: string[], isAdmin?: boolean) {
  return useQuery({
    queryKey: [...compliancePeriodQueryKeys.all, 'clients', accessibleBranches, isAdmin],
    queryFn: () => fetchClientsForStatements(accessibleBranches, isAdmin),
    ...cacheConfig.dynamic,
  });
}

// Mutation Hooks
export function useCompliancePeriodActions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateStatementStatus = useMutation({
    mutationFn: async ({ statementId, status, rejectionReason }: { 
      statementId: string; 
      status: string; 
      rejectionReason?: string;
    }) => {
      const updateData: any = {
        status,
        approved_at: new Date().toISOString(),
      };

      if (rejectionReason) {
        updateData.rejection_reason = rejectionReason;
      }

      const { error } = await supabase
        .from('care_worker_statements')
        .update(updateData)
        .eq('id', statementId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: compliancePeriodQueryKeys.statements() });
      toast({
        title: "Success",
        description: "Statement status updated successfully",
      });
    },
    onError: (error) => {
      console.error('Error updating statement:', error);
      toast({
        title: "Error",
        description: "Failed to update statement status",
        variant: "destructive",
      });
    },
  });

  const createStatement = useMutation({
    mutationFn: async (statementData: any) => {
      const { error } = await supabase
        .from('care_worker_statements')
        .insert(statementData);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: compliancePeriodQueryKeys.statements() });
      toast({
        title: "Success",
        description: "Statement created successfully",
      });
    },
    onError: (error) => {
      console.error('Error creating statement:', error);
      toast({
        title: "Error",
        description: "Failed to create statement",
        variant: "destructive",
      });
    },
  });

  const updateStatement = useMutation({
    mutationFn: async ({ statementId, statementData }: { statementId: string; statementData: any }) => {
      const { error } = await supabase
        .from('care_worker_statements')
        .update(statementData)
        .eq('id', statementId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: compliancePeriodQueryKeys.statements() });
      toast({
        title: "Success",
        description: "Statement updated successfully",
      });
    },
    onError: (error) => {
      console.error('Error updating statement:', error);
      toast({
        title: "Error",
        description: "Failed to update statement",
        variant: "destructive",
      });
    },
  });

  return {
    updateStatementStatus,
    createStatement,
    updateStatement,
  };
}