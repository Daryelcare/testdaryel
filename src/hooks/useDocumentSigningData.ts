import { 
  useDocumentTemplates, 
  useSigningRequests, 
  useCompletedDocuments, 
  useDocumentSigningStats 
} from '@/hooks/queries/useDocumentSigningQueries';

export function useDocumentSigningData() {
  const templatesQuery = useDocumentTemplates();
  const requestsQuery = useSigningRequests();
  const completedQuery = useCompletedDocuments();
  const statsQuery = useDocumentSigningStats();

  // Aggregate loading state from all queries
  const loading = templatesQuery.isLoading || requestsQuery.isLoading || 
                 completedQuery.isLoading || statsQuery.isLoading;

  // Refetch function to refresh all data
  const refetchData = async () => {
    await Promise.all([
      templatesQuery.refetch(),
      requestsQuery.refetch(),
      completedQuery.refetch(),
      statsQuery.refetch(),
    ]);
  };

  return {
    templates: templatesQuery.data || [],
    requests: requestsQuery.data || [],
    completedDocuments: completedQuery.data || [],
    stats: statsQuery.data || null,
    loading,
    error: templatesQuery.error || requestsQuery.error || completedQuery.error || statsQuery.error,
    refetchData
  };
}