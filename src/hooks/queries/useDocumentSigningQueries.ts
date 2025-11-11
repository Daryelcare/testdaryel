import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cacheConfig } from '@/lib/query-client';

// Types
export interface DocumentTemplate {
  id: string;
  name: string;
  description?: string;
  file_path: string;
  file_type: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface SigningRequest {
  id: string;
  template_id: string;
  title: string;
  message?: string;
  status: string;
  signing_token?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface SignedDocument {
  id: string;
  signing_request_id: string;
  completed_at: string;
  final_document_path: string;
  completion_data: any;
  created_at: string;
}

// Query Keys
export const documentSigningQueryKeys = {
  all: ['document-signing'] as const,
  templates: () => [...documentSigningQueryKeys.all, 'templates'] as const,
  requests: () => [...documentSigningQueryKeys.all, 'requests'] as const,
  completed: () => [...documentSigningQueryKeys.all, 'completed'] as const,
  stats: () => [...documentSigningQueryKeys.all, 'stats'] as const,
} as const;

// Data fetching functions
export const fetchTemplates = async (): Promise<DocumentTemplate[]> => {
  const { data, error } = await supabase
    .from('document_templates')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const fetchSigningRequests = async (): Promise<SigningRequest[]> => {
  const { data, error } = await supabase
    .from('signing_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const fetchCompletedDocuments = async (): Promise<SignedDocument[]> => {
  const { data, error } = await supabase
    .from('signed_documents')
    .select('*')
    .order('completed_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const fetchDashboardStats = async () => {
  const [templatesRes, requestsRes, completedRes] = await Promise.all([
    supabase.from("document_templates").select("id", { count: 'exact' }),
    supabase.from("signing_requests").select("id, status", { count: 'exact' }),
    supabase.from("signed_documents").select("id", { count: 'exact' })
  ]);

  const pendingRequests = requestsRes.data?.filter(r => r.status === 'sent').length || 0;
  const completionRate = requestsRes.count ? Math.round((completedRes.count || 0) / requestsRes.count * 100) : 0;

  return {
    templates: templatesRes.count || 0,
    totalRequests: requestsRes.count || 0,
    pendingRequests,
    completedDocuments: completedRes.count || 0,
    completionRate
  };
};

// Query Hooks
export function useDocumentTemplates() {
  return useQuery({
    queryKey: documentSigningQueryKeys.templates(),
    queryFn: fetchTemplates,
    ...cacheConfig.dynamic, // Dynamic user data gets medium cache
  });
}

export function useSigningRequests() {
  return useQuery({
    queryKey: documentSigningQueryKeys.requests(),
    queryFn: fetchSigningRequests,
    ...cacheConfig.realtime, // Real-time data gets short cache
  });
}

export function useCompletedDocuments() {
  return useQuery({
    queryKey: documentSigningQueryKeys.completed(),
    queryFn: fetchCompletedDocuments,
    ...cacheConfig.dynamic, // Dynamic user data gets medium cache
  });
}

export function useDocumentSigningStats() {
  return useQuery({
    queryKey: documentSigningQueryKeys.stats(),
    queryFn: fetchDashboardStats,
    ...cacheConfig.realtime, // Real-time data for dashboard
  });
}

// Mutation Hooks
export function useDocumentSigningActions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createTemplate = useMutation({
    mutationFn: async (templateData: Omit<DocumentTemplate, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('document_templates')
        .insert(templateData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    // Optimistic update for immediate UI feedback
    onMutate: async (newTemplate) => {
      await queryClient.cancelQueries({ queryKey: documentSigningQueryKeys.templates() });
      
      const previousTemplates = queryClient.getQueryData<DocumentTemplate[]>(documentSigningQueryKeys.templates());
      
      // Create optimistic template with temporary ID
      const optimisticTemplate = {
        ...newTemplate,
        id: `temp-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      queryClient.setQueryData<DocumentTemplate[]>(documentSigningQueryKeys.templates(), (old) => {
        if (!old) return [optimisticTemplate];
        return [optimisticTemplate, ...old];
      });
      
      return { previousTemplates };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentSigningQueryKeys.templates() });
      queryClient.invalidateQueries({ queryKey: documentSigningQueryKeys.stats() });
      toast({
        title: "Success",
        description: "Template created successfully.",
      });
    },
    onError: (error: any, variables, context) => {
      if (context?.previousTemplates) {
        queryClient.setQueryData(documentSigningQueryKeys.templates(), context.previousTemplates);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to create template.",
        variant: "destructive",
      });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from('document_templates')
        .delete()
        .eq('id', templateId);
      
      if (error) throw error;
    },
    // Optimistic update for immediate UI feedback
    onMutate: async (templateId) => {
      await queryClient.cancelQueries({ queryKey: documentSigningQueryKeys.templates() });
      
      const previousTemplates = queryClient.getQueryData<DocumentTemplate[]>(documentSigningQueryKeys.templates());
      
      queryClient.setQueryData<DocumentTemplate[]>(documentSigningQueryKeys.templates(), (old) => {
        if (!old) return [];
        return old.filter(template => template.id !== templateId);
      });
      
      return { previousTemplates };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentSigningQueryKeys.templates() });
      queryClient.invalidateQueries({ queryKey: documentSigningQueryKeys.stats() });
      toast({
        title: "Success",
        description: "Template deleted successfully.",
      });
    },
    onError: (error: any, variables, context) => {
      if (context?.previousTemplates) {
        queryClient.setQueryData(documentSigningQueryKeys.templates(), context.previousTemplates);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to delete template.",
        variant: "destructive",
      });
    },
  });

  const sendSigningRequest = useMutation({
    mutationFn: async (requestData: Omit<SigningRequest, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('signing_requests')
        .insert(requestData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentSigningQueryKeys.requests() });
      queryClient.invalidateQueries({ queryKey: documentSigningQueryKeys.stats() });
      toast({
        title: "Success",
        description: "Signing request sent successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send signing request.",
        variant: "destructive",
      });
    },
  });

  return {
    createTemplate,
    deleteTemplate,
    sendSigningRequest,
  };
}