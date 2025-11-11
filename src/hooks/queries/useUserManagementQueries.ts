import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { cacheConfig } from '@/lib/query-client';

export interface UserWithRole {
  id: string;
  email: string;
  created_at: string;
  role: string;
}

// Query Keys
export const userManagementQueryKeys = {
  all: ['user-management'] as const,
  users: () => [...userManagementQueryKeys.all, 'users'] as const,
} as const;

// Data fetching functions
export const fetchUsers = async (currentUser?: any) => {
  // Get all user roles with emails
  const { data: userRoles, error: rolesError } = await supabase
    .from('user_roles')
    .select('*')
    .order('created_at', { ascending: false });

  if (rolesError) throw rolesError;

  // Combine role data with email data
  const usersWithRoles: UserWithRole[] = (userRoles || []).map((userRole: any) => ({
    id: userRole.user_id,
    email: userRole.email || 
           (userRole.user_id === currentUser?.id ? currentUser.email || 'current@user.com' : 'user@example.com'),
    created_at: userRole.created_at,
    role: userRole.role
  }));

  return usersWithRoles;
};

// Query Hooks
export function useUsers() {
  const { user: currentUser } = useAuth();
  
  return useQuery({
    queryKey: userManagementQueryKeys.users(),
    queryFn: () => fetchUsers(currentUser),
    ...cacheConfig.dynamic,
  });
}

// Mutation Hooks
export function useUserManagementActions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createUser = useMutation({
    mutationFn: async ({ email, password, role }: { email: string; password: string; role: string }) => {
      const { data, error } = await supabase.functions.invoke('create-admin-user', {
        body: {
          email,
          password,
          role
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to create user');
      }

      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: userManagementQueryKeys.users() });
      toast({
        title: "User created successfully",
        description: `${variables.email} has been added with ${variables.role} role`,
      });
    },
    onError: (error: any) => {
      console.error('Error creating user:', error);
      toast({
        title: "Error creating user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateUserRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole })
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userManagementQueryKeys.users() });
      toast({
        title: "Role updated",
        description: "User role has been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating role",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-delete-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete user');
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userManagementQueryKeys.users() });
      toast({
        title: "User deleted",
        description: "User and their authentication account have been removed successfully",
      });
    },
    onError: (error: any) => {
      console.error('Error deleting user:', error);
      toast({
        title: "Error deleting user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetUserPassword = useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reset-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          password
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to reset password');
      }

      return result;
    },
    onSuccess: () => {
      toast({
        title: "Password reset successful",
        description: "User password has been updated successfully",
      });
    },
    onError: (error: any) => {
      console.error('Error resetting password:', error);
      toast({
        title: "Error resetting password",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    createUser,
    updateUserRole,
    deleteUser,
    resetUserPassword,
  };
}