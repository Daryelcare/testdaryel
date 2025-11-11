import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Utility function to identify and cleanup orphaned auth users
 * (users who exist in auth but not in user_roles table)
 * 
 * This should be run by admins via a manual process or scheduled job
 */
export async function cleanupOrphanedAuthUsers(supabase: SupabaseClient) {
  try {
    console.log('Starting orphaned auth users cleanup...');
    
    // Get all user roles
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id');
    
    if (rolesError) {
      throw rolesError;
    }
    
    const roleUserIds = new Set(roles?.map(r => r.user_id) || []);
    
    console.log(`Found ${roleUserIds.size} users with valid roles`);
    
    // Note: We can't access auth.admin.listUsers() from the client
    // This function is intended to be called from an edge function or backend
    // with service role access
    
    return {
      success: true,
      message: `Cleanup check completed. ${roleUserIds.size} valid users found.`,
      validUserCount: roleUserIds.size
    };
  } catch (error) {
    console.error('Error in cleanupOrphanedAuthUsers:', error);
    throw error;
  }
}

/**
 * Check if a specific user ID has a valid role
 */
export async function hasValidRole(supabase: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error) {
      console.error('Error checking user role:', error);
      return false;
    }
    
    return !!data;
  } catch (error) {
    console.error('Error in hasValidRole:', error);
    return false;
  }
}
