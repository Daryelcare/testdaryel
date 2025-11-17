import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cleanupAuthState, forceSignOut } from '@/utils/authCleanup';

interface Employee {
  id: string;
  name: string;
  email: string;
  branch_id: string;
  employee_code: string;
  job_title: string;
  employee_type: string;
  leave_allowance: number;
  remaining_leave_days: number;
  leave_taken: number;
  languages?: string[];
  branches?: {
    id: string;
    name: string;
  };
}

interface EmployeeAuthContextType {
  employee: Employee | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshEmployeeData: () => Promise<void>;
}

const EmployeeAuthContext = createContext<EmployeeAuthContextType | undefined>(undefined);

export function EmployeeAuthProvider({ children }: { children: ReactNode }) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialCheckComplete, setInitialCheckComplete] = useState(false);

  const fetchEmployeeData = async (user: any): Promise<boolean> => {
    try {
      const employeeId = user.user_metadata?.employee_id;
      if (!employeeId) {
        console.error('No employee_id found in user metadata');
        return false;
      }

      // Fetch employee data using employee_id from user metadata
      const { data: employeeData, error: empError } = await supabase
        .from('employees')
        .select(`
          *,
          branches!employees_branch_id_fkey (
            id,
            name
          )
        `)
        .eq('id', employeeId)
        .single();

      if (empError) {
        console.error('Error fetching employee data:', empError);
        // If employee record doesn't exist, they were likely deleted
        // Force sign out to prevent orphaned auth accounts
        return false;
      }

      if (!employeeData) {
        console.error('Employee record not found for ID:', employeeId);
        return false;
      }

      // Transform languages from Json to string[]
      const transformedEmployee = {
        ...employeeData,
        languages: Array.isArray(employeeData.languages) ? employeeData.languages : []
      } as Employee;

      setEmployee(transformedEmployee);
      return true;
    } catch (error) {
      console.error('Error in fetchEmployeeData:', error);
      return false;
    }
  };

  const refreshEmployeeData = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      
      if (user && user.user_metadata?.role === 'employee') {
        await fetchEmployeeData(user);
      }
    } catch (error) {
      console.error('Error refreshing employee data:', error);
    }
  };

  const signOut = async () => {
    try {
      await forceSignOut(supabase);
      setEmployee(null);
      setLoading(false);
      
      // Force page reload for clean state
      window.location.href = '/employee-login';
    } catch (error) {
      console.error('Employee sign out error:', error);
      // Force page reload anyway
      window.location.href = '/employee-login';
    }
  };

  useEffect(() => {
    let isMounted = true;
    let initialized = false;

    const initializeAuth = async () => {
      if (initialized) return;
      initialized = true;
      
      try {
        // Get current session from Supabase
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Employee session error:', error);
          cleanupAuthState();
          if (isMounted) {
            setLoading(false);
            setInitialCheckComplete(true);
          }
          return;
        }
        
        if (session?.user?.user_metadata?.role === 'employee') {
          const success = await fetchEmployeeData(session.user);
          if (!success && isMounted) {
            // Failed to fetch employee data, sign out
            await signOut();
            return;
          }
        } else if (session?.user) {
          // Not an employee user, clean up and redirect
          cleanupAuthState();
        }
        
        if (isMounted) {
          setLoading(false);
          setInitialCheckComplete(true);
        }
      } catch (error) {
        console.error('Error initializing employee auth:', error);
        if (isMounted) {
          setLoading(false);
          setInitialCheckComplete(true);
        }
      }
    };

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        
        console.log('Employee auth state change:', event, session ? 'session exists' : 'no session');
        
        // Handle different events appropriately
        if (event === 'SIGNED_OUT') {
          cleanupAuthState();
          setEmployee(null);
          setLoading(false);
          setInitialCheckComplete(true);
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // Only process if this is an employee session
          if (session?.user?.user_metadata?.role === 'employee') {
            // Defer async operations to prevent deadlocks
            setTimeout(async () => {
              const success = await fetchEmployeeData(session.user);
              if (!success && isMounted) {
                setEmployee(null);
                setLoading(false);
                setInitialCheckComplete(true);
              }
            }, 0);
          } else {
            setEmployee(null);
            setLoading(false);
            setInitialCheckComplete(true);
          }
        } else if (event === 'INITIAL_SESSION') {
          // Handle initial session load
          if (!initialized) {
            initializeAuth();
          }
        } else {
          // For other events, just update loading state
          setLoading(false);
          setInitialCheckComplete(true);
        }
      }
    );

    // Only initialize if we haven't already
    if (!initialized) {
      initializeAuth();
    }

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    employee,
    loading: loading && !initialCheckComplete,
    signOut,
    refreshEmployeeData
  };

  return (
    <EmployeeAuthContext.Provider value={value}>
      {children}
    </EmployeeAuthContext.Provider>
  );
}

export function useEmployeeAuth() {
  const context = useContext(EmployeeAuthContext);
  if (context === undefined) {
    throw new Error('useEmployeeAuth must be used within an EmployeeAuthProvider');
  }
  return context;
}