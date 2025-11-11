
import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface PermissionsContextType {
  hasPageAccess: (pagePath: string) => boolean;
  hasFeatureAccess: (feature: string) => boolean;
  hasPageAction: (moduleKey: string, action: string) => boolean;
  getAccessibleBranches: () => string[];
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { userRole } = useAuth();
  const { hasPageAccess, hasFeatureAccess, hasPageAction, getAccessibleBranches, loading, error } = useUserPermissions();
  const [allBranches, setAllBranches] = useState<string[]>([]);
  
  const isAdmin = userRole === 'admin';

  // Fetch all branches for admin users
  useEffect(() => {
    if (isAdmin) {
      const fetchAllBranches = async () => {
        const { data: branches } = await supabase
          .from('branches')
          .select('id');
        
        if (branches) {
          setAllBranches(branches.map(b => b.id));
        }
      };
      
      fetchAllBranches();
    }
  }, [isAdmin]);

  const value = {
    hasPageAccess: (pagePath: string) => isAdmin || hasPageAccess(pagePath),
    hasFeatureAccess: (feature: string) => isAdmin || hasFeatureAccess(feature),
    hasPageAction: (moduleKey: string, action: string) => isAdmin || hasPageAction(moduleKey, action),
    getAccessibleBranches: () => {
      if (isAdmin) {
        return allBranches; // Return all branches for admin
      }
      const userBranches = getAccessibleBranches();
      // If user has no explicit branch restrictions, they can see all branches
      return userBranches.length > 0 ? userBranches : allBranches;
    },
    isAdmin,
    loading,
    error
  };

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}
