import { 
  useEmployees, 
  useEmployeeBranches 
} from "@/hooks/queries/useEmployeeQueries";

export function useEmployeeData() {
  const employeesQuery = useEmployees();
  const branchesQuery = useEmployeeBranches();

  // Aggregate loading state from all queries
  const loading = employeesQuery.isLoading || branchesQuery.isLoading;

  // Refetch function to refresh all data
  const refetchData = async () => {
    await Promise.all([
      employeesQuery.refetch(),
      branchesQuery.refetch(),
    ]);
  };

  return {
    employees: employeesQuery.data || [],
    branches: branchesQuery.data || [],
    loading,
    refetchData,
    error: employeesQuery.error || branchesQuery.error
  };
}