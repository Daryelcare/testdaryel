
import { 
  useLeaves, 
  useEmployees, 
  useLeaveTypes, 
  useBranches 
} from "@/hooks/queries/useLeaveQueries";

export function useLeaveData() {
  const leavesQuery = useLeaves();
  const employeesQuery = useEmployees();
  const leaveTypesQuery = useLeaveTypes();
  const branchesQuery = useBranches();

  // Aggregate loading state from all queries
  const loading = leavesQuery.isLoading || 
                 employeesQuery.isLoading || 
                 leaveTypesQuery.isLoading || 
                 branchesQuery.isLoading;

  // Refetch function to refresh all data
  const refetchData = async () => {
    await Promise.all([
      leavesQuery.refetch(),
      employeesQuery.refetch(),
      leaveTypesQuery.refetch(),
      branchesQuery.refetch(),
    ]);
  };

  return {
    leaves: leavesQuery.data || [],
    employees: employeesQuery.data || [],
    leaveTypes: leaveTypesQuery.data || [],
    branches: branchesQuery.data || [],
    loading,
    refetchData
  };
}
