import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cacheConfig } from '@/lib/query-client';

interface Client {
  id: string;
  name: string;
  branch_id: string;
  branch?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Branch {
  id: string;
  name: string;
}

// Query keys for consistent cache management
export const clientQueryKeys = {
  all: ['clients'] as const,
  lists: () => [...clientQueryKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...clientQueryKeys.lists(), { filters }] as const,
  details: () => [...clientQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...clientQueryKeys.details(), id] as const,
  branches: ['client-branches'] as const,
};

// Fetch clients
async function fetchClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select(`
      *,
      branches!clients_branch_id_fkey(id, name)
    `)
    .order('name');

  if (error) throw error;
  
  // Transform data to include branch name
  return data?.map(client => ({
    ...client,
    branch: client.branches?.name || '',
  })) || [];
}

// Fetch branches
async function fetchClientBranches(): Promise<Branch[]> {
  const { data, error } = await supabase
    .from('branches')
    .select('id, name')
    .order('name');

  if (error) throw error;
  return data || [];
}

// React Query hooks
export function useClients() {
  return useQuery({
    queryKey: clientQueryKeys.lists(),
    queryFn: fetchClients,
    ...cacheConfig.realtime, // Real-time updates for clients
  });
}

export function useClientBranches() {
  return useQuery({
    queryKey: clientQueryKeys.branches,
    queryFn: fetchClientBranches,
    ...cacheConfig.static, // Static reference data gets long cache
  });
}

// Mutation hooks for client actions
export function useClientActions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createClient = useMutation({
    mutationFn: async (clientData: Omit<Client, 'id' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('clients')
        .insert([clientData])
        .select(`
          *,
          branches!clients_branch_id_fkey(id, name)
        `)
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientQueryKeys.lists() });
      toast({
        title: "Success",
        description: "Client created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create client.",
        variant: "destructive",
      });
    },
  });

  const updateClient = useMutation({
    mutationFn: async ({ id, ...updateData }: Partial<Client> & { id: string }) => {
      const { data, error } = await supabase
        .from('clients')
        .update(updateData)
        .eq('id', id)
        .select(`
          *,
          branches!clients_branch_id_fkey(id, name)
        `)
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientQueryKeys.lists() });
      toast({
        title: "Success",
        description: "Client updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update client.",
        variant: "destructive",
      });
    },
  });

  const deleteClient = useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientQueryKeys.lists() });
      toast({
        title: "Success",
        description: "Client deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete client.",
        variant: "destructive",
      });
    },
  });

  return {
    createClient,
    updateClient,
    deleteClient,
  };
}