import { useComplianceTypes } from '@/hooks/queries/useComplianceQueries';

export function useComplianceData() {
  const complianceTypesQuery = useComplianceTypes();

  // Refetch function to refresh all data
  const refetchData = async () => {
    await complianceTypesQuery.refetch();
  };

  return {
    complianceTypes: complianceTypesQuery.data || [],
    loading: complianceTypesQuery.isLoading,
    error: complianceTypesQuery.error,
    refetchData
  };
}