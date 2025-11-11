import { useClients, useClientBranches } from '@/hooks/queries/useClientQueries';

export function useClientData() {
  const clientsQuery = useClients();
  const branchesQuery = useClientBranches();

  // Aggregate loading state from all queries
  const loading = clientsQuery.isLoading || branchesQuery.isLoading;

  // Refetch function to refresh all data
  const refetchData = async () => {
    await Promise.all([
      clientsQuery.refetch(),
      branchesQuery.refetch(),
    ]);
  };

  return {
    clients: clientsQuery.data || [],
    branches: branchesQuery.data || [],
    loading,
    error: clientsQuery.error || branchesQuery.error,
    refetchData
  };
}