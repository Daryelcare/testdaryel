
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UserPermission {
  permission_type: string;
  permission_key: string;
  granted: boolean;
}

interface UserBranchAccess {
  branch_id: string;
}

export function useUserPermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [branchAccess, setBranchAccess] = useState<UserBranchAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchUserPermissions();
    } else {
      setLoading(false);
      setPermissions([]);
      setBranchAccess([]);
    }
  }, [user]);

  const fetchUserPermissions = async (retryCount = 0) => {
    setError(null);
    try {
      const maxRetries = 3;
      
      // Fetch user permissions
      const { data: permData, error: permError } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', user?.id);

      if (permError) throw permError;

      // Fetch user branch access
      const { data: branchData, error: branchError } = await supabase
        .from('user_branch_access')
        .select('branch_id')
        .eq('user_id', user?.id);

      if (branchError) throw branchError;

      setPermissions(permData || []);
      setBranchAccess(branchData || []);
      setError(null);
    } catch (error: any) {
      console.error('Error fetching user permissions:', error);
      setError(error.message);
      
      // Retry logic for transient errors
      if (retryCount < 3) {
        setTimeout(() => {
          fetchUserPermissions(retryCount + 1);
        }, 1000 * (retryCount + 1)); // Exponential backoff
        return;
      }
      
      // Set empty arrays if there's an error and no more retries
      setPermissions([]);
      setBranchAccess([]);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (permissionType: string, permissionKey: string): boolean => {
    const permission = permissions.find(
      p => p.permission_type === permissionType && p.permission_key === permissionKey
    );
    // Only return granted value if permission is explicitly set, otherwise return false
    return permission ? permission.granted : false;
  };

  const hasPageAccess = (pagePath: string): boolean => {
    // Check for explicit page_access permission first
    const pageAccessPermission = permissions.find(
      p => p.permission_type === 'page_access' && p.permission_key === pagePath
    );
    
    if (pageAccessPermission) {
      return pageAccessPermission.granted;
    }
    
    // Fallback to page_action view permission
    const moduleKey = getModuleKeyFromPath(pagePath);
    return hasPageAction(moduleKey, 'view');
  };

  const hasFeatureAccess = (feature: string): boolean => {
    return hasPermission('feature_access', feature);
  };

  const hasPageAction = (moduleKey: string, action: string): boolean => {
    return hasPermission('page_action', `${moduleKey}:${action}`);
  };

  const getModuleKeyFromPath = (path: string): string => {
    const pathModuleMap: Record<string, string> = {
      '/': 'dashboard',
      '/employees': 'employees',
      '/clients': 'clients',
      '/leaves': 'leaves',
      '/documents': 'documents',
      '/document-signing': 'document-signing',
      '/compliance': 'compliance',
      '/reports': 'reports',
      '/job-applications': 'job-applications',
      '/settings': 'settings',
      '/user-management': 'user-management'
    };
    return pathModuleMap[path] || 'dashboard';
  };

  const getAccessibleBranches = (): string[] => {
    return branchAccess.map(ba => ba.branch_id);
  };

  return {
    permissions,
    branchAccess,
    loading,
    error,
    hasPermission,
    hasPageAccess,
    hasFeatureAccess,
    hasPageAction,
    getAccessibleBranches,
    refetch: fetchUserPermissions
  };
}
