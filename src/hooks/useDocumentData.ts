import { useDocuments, useDocumentEmployees, useDocumentTypes, useDocumentBranches } from '@/hooks/queries/useDocumentQueries';

export function useDocumentData() {
  const documentsQuery = useDocuments();
  const employeesQuery = useDocumentEmployees();
  const documentTypesQuery = useDocumentTypes();
  const branchesQuery = useDocumentBranches();

  // Aggregate loading state from all queries
  const loading = documentsQuery.isLoading || employeesQuery.isLoading || 
                 documentTypesQuery.isLoading || branchesQuery.isLoading;

  // Refetch function to refresh all data
  const refetchData = async () => {
    await Promise.all([
      documentsQuery.refetch(),
      employeesQuery.refetch(),
      documentTypesQuery.refetch(),
      branchesQuery.refetch(),
    ]);
  };

  return {
    documents: documentsQuery.data || [],
    employees: employeesQuery.data || [],
    documentTypes: documentTypesQuery.data || [],
    branches: branchesQuery.data || [],
    loading,
    error: documentsQuery.error || employeesQuery.error || documentTypesQuery.error || branchesQuery.error,
    refetchData
  };
}