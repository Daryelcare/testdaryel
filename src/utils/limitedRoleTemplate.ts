import { supabase } from "@/integrations/supabase/client";

// Pages that are restricted for limited role users
export const RESTRICTED_PAGES = [
  '/documents',
  '/document-signing',
  '/reports',
  '/settings',
  '/user-management'
];

// Specific actions that are restricted even on accessible pages
export const RESTRICTED_ACTIONS: Record<string, string[]> = {
  'employees': ['delete'],
  'job-applications': ['delete', 'edit', 'reference-manual-pdf']
};

// All available page modules with their paths and actions
export const ALL_PAGE_MODULES = [
  {
    name: 'Dashboard',
    key: 'dashboard',
    path: '/',
    actions: ['view']
  },
  {
    name: 'Employees',
    key: 'employees', 
    path: '/employees',
    actions: ['view', 'create', 'edit', 'delete']
  },
  {
    name: 'Clients',
    key: 'clients',
    path: '/clients',
    actions: ['view', 'create', 'edit', 'delete', 'import', 'bulk-delete']
  },
  {
    name: 'Leaves',
    key: 'leaves',
    path: '/leaves', 
    actions: ['view', 'create', 'edit', 'delete', 'approve']
  },
  {
    name: 'Documents',
    key: 'documents',
    path: '/documents',
    actions: ['view', 'create', 'edit', 'delete', 'upload']
  },
  {
    name: 'Document Signing',
    key: 'document-signing',
    path: '/document-signing',
    actions: ['view', 'create', 'edit', 'delete', 'sign']
  },
  {
    name: 'Compliance',
    key: 'compliance',
    path: '/compliance',
    actions: ['view', 'create', 'edit', 'delete']
  },
  {
    name: 'Compliance Types',
    key: 'compliance-types',
    path: '/compliance/types',
    actions: ['view']
  },
  {
    name: 'Care Worker Statements',
    key: 'care-worker-statements', 
    path: '/compliance/statements',
    actions: ['view']
  },
  {
    name: 'Reports',
    key: 'reports',
    path: '/reports',
    actions: ['view', 'generate', 'export']
  },
  {
    name: 'Job Applications',
    key: 'job-applications',
    path: '/job-applications',
    actions: ['view', 'delete', 'edit', 'download-pdf', 'reference-send-request', 'reference-download-pdf', 'reference-manual-pdf']
  },
  {
    name: 'Settings',
    key: 'settings',
    path: '/settings',
    actions: ['view', 'edit']
  },
  {
    name: 'User Management',
    key: 'user-management',
    path: '/user-management',
    actions: ['view', 'create', 'edit', 'delete']
  }
];

/**
 * Generates permission objects for limited role template
 */
export const generateLimitedPermissions = () => {
  const permissions: Array<{
    permission_type: string;
    permission_key: string;
    granted: boolean;
  }> = [];

  ALL_PAGE_MODULES.forEach(module => {
    // Page access permission
    const isRestricted = RESTRICTED_PAGES.includes(module.path);
    permissions.push({
      permission_type: 'page_access',
      permission_key: module.path,
      granted: !isRestricted
    });

    // Page action permissions
    module.actions.forEach(action => {
      // Check if this specific action is restricted for this module
      const isActionRestricted = RESTRICTED_ACTIONS[module.key]?.includes(action);
      
      permissions.push({
        permission_type: 'page_action',
        permission_key: `${module.key}:${action}`,
        granted: !isRestricted && !isActionRestricted
      });
    });
  });

  return permissions;
};

/**
 * Generates permission objects for full access template
 */
export const generateFullPermissions = () => {
  const permissions: Array<{
    permission_type: string;
    permission_key: string;
    granted: boolean;
  }> = [];

  ALL_PAGE_MODULES.forEach(module => {
    // Page access permission
    permissions.push({
      permission_type: 'page_access',
      permission_key: module.path,
      granted: true
    });

    // Page action permissions
    module.actions.forEach(action => {
      permissions.push({
        permission_type: 'page_action',
        permission_key: `${module.key}:${action}`,
        granted: true
      });
    });
  });

  return permissions;
};

/**
 * Applies limited role permissions to a user
 */
export const applyLimitedRolePermissions = async (userId: string) => {
  try {
    const permissions = generateLimitedPermissions();
    
    const permissionsToUpsert = permissions.map(p => ({
      user_id: userId,
      permission_type: p.permission_type,
      permission_key: p.permission_key,
      granted: p.granted,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('user_permissions')
      .upsert(permissionsToUpsert, {
        onConflict: 'user_id,permission_type,permission_key'
      });

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('Error applying limited role permissions:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Applies full access permissions to a user
 */
export const applyFullAccessPermissions = async (userId: string) => {
  try {
    const permissions = generateFullPermissions();
    
    const permissionsToUpsert = permissions.map(p => ({
      user_id: userId,
      permission_type: p.permission_type,
      permission_key: p.permission_key,
      granted: p.granted,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('user_permissions')
      .upsert(permissionsToUpsert, {
        onConflict: 'user_id,permission_type,permission_key'
      });

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('Error applying full access permissions:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Checks if a user has limited permissions
 */
export const hasLimitedPermissions = async (userId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('user_permissions')
      .select('permission_key, granted')
      .eq('user_id', userId)
      .eq('permission_type', 'page_access')
      .in('permission_key', RESTRICTED_PAGES);

    if (error) throw error;

    // If any restricted page has granted=false, user has limited permissions
    return (data || []).some(p => !p.granted);
  } catch (error) {
    console.error('Error checking limited permissions:', error);
    return false;
  }
};
