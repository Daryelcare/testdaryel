import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cacheConfig } from '@/lib/query-client';

// Individual document within JSONB array
export interface DocumentRecord {
  id: string;
  document_type_id: string;
  document_number?: string;
  issue_date?: string;
  expiry_date: string;
  status: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

// Employee document tracker with JSONB documents
export interface EmployeeDocumentTracker {
  id: string;
  employee_id: string;
  country?: string;
  nationality_status?: string;
  branch_id: string;
  documents: DocumentRecord[];
  created_at: string;
  updated_at: string;
}

// Flattened document (for UI compatibility)
export interface Document {
  id: string;
  employee_id: string;
  document_type_id: string;
  branch_id: string;
  document_number?: string;
  issue_date?: string;
  expiry_date: string;
  status: string;
  notes?: string;
  country?: string;
  nationality_status?: string;
  employees?: {
    name: string;
    email: string;
    branches?: {
      id: string;
      name: string;
    };
  };
  document_types?: {
    name: string;
  };
}

export interface DocumentType {
  id: string;
  name: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  branch_id: string;
  employee_code: string;
  sponsored?: boolean;
  twenty_hours?: boolean;
  branches?: {
    id: string;
    name: string;
  };
}

export interface Branch {
  id: string;
  name: string;
}

// Query Keys
export const documentQueryKeys = {
  all: ['documents'] as const,
  list: () => [...documentQueryKeys.all, 'list'] as const,
  employees: () => [...documentQueryKeys.all, 'employees'] as const,
  documentTypes: () => [...documentQueryKeys.all, 'document-types'] as const,
  branches: () => [...documentQueryKeys.all, 'branches'] as const,
} as const;

// Data fetching functions
export const fetchDocuments = async () => {
  // Fetch document tracker data
  const { data, error } = await supabase
    .from('document_tracker')
    .select(`
      *,
      employees (
        name, 
        email,
        branches!employees_branch_id_fkey (id, name)
      )
    `)
    .order('created_at', { ascending: true });

  if (error) throw error;
  
  // Fetch all document types to map names
  const { data: docTypes, error: docTypesError } = await supabase
    .from('document_types')
    .select('id, name');
  
  if (docTypesError) throw docTypesError;
  
  // Create a map of document_type_id -> name for quick lookup
  const docTypeMap = new Map(docTypes?.map(dt => [dt.id, dt.name]) || []);
  
  // Flatten JSONB documents array to Document[] for UI compatibility
  const flattened: Document[] = [];
  
  if (data) {
    for (const tracker of data) {
      const documents = (tracker.documents as any[]) || [];
      
      for (const doc of documents) {
        flattened.push({
          id: doc.id,
          employee_id: tracker.employee_id,
          document_type_id: doc.document_type_id,
          branch_id: tracker.branch_id,
          document_number: doc.document_number,
          issue_date: doc.issue_date,
          expiry_date: doc.expiry_date,
          status: doc.status,
          notes: doc.notes,
          country: tracker.country,
          nationality_status: tracker.nationality_status,
          employees: tracker.employees,
          document_types: {
            name: docTypeMap.get(doc.document_type_id) || 'Unknown'
          }
        });
      }
    }
  }
  
  // Sort by expiry date
  flattened.sort((a, b) => {
    if (!a.expiry_date) return 1;
    if (!b.expiry_date) return -1;
    return a.expiry_date.localeCompare(b.expiry_date);
  });
  
  return flattened;
};

export const fetchDocumentEmployees = async () => {
  const { data, error } = await supabase
    .from('employees')
    .select(`
      id, name, email, branch_id, employee_code, sponsored, twenty_hours,
      branches!employees_branch_id_fkey (id, name)
    `)
    .order('name');

  if (error) throw error;
  return data || [];
};

export const fetchDocumentTypes = async () => {
  const { data, error } = await supabase
    .from('document_types')
    .select('id, name')
    .order('name');

  if (error) throw error;
  return data || [];
};

export const fetchDocumentBranches = async () => {
  const { data, error } = await supabase
    .from('branches')
    .select('id, name')
    .order('name');

  if (error) throw error;
  return data || [];
};

// Query Hooks
export function useDocuments() {
  return useQuery({
    queryKey: documentQueryKeys.list(),
    queryFn: fetchDocuments,
    ...cacheConfig.realtime, // Real-time updates for documents
  });
}

export function useDocumentEmployees() {
  return useQuery({
    queryKey: documentQueryKeys.employees(),
    queryFn: fetchDocumentEmployees,
    ...cacheConfig.static,
  });
}

export function useDocumentTypes() {
  return useQuery({
    queryKey: documentQueryKeys.documentTypes(),
    queryFn: fetchDocumentTypes,
    ...cacheConfig.static,
  });
}

export function useDocumentBranches() {
  return useQuery({
    queryKey: documentQueryKeys.branches(),
    queryFn: fetchDocumentBranches,
    ...cacheConfig.static,
  });
}

// Mutation Hooks
export function useDocumentActions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createDocument = useMutation({
    mutationFn: async (documentData: any) => {
      // Extract employee-level data and document data
      const { employee_id, country, nationality_status, branch_id, ...docFields } = documentData;
      
      // Fetch document type name for the flattened response
      const { data: docTypeData } = await supabase
        .from('document_types')
        .select('name')
        .eq('id', docFields.document_type_id)
        .single();
      
      // Call upsert function
      const { data, error } = await supabase.rpc('upsert_employee_document', {
        p_employee_id: employee_id,
        p_document: docFields,
        p_country: country,
        p_nationality_status: nationality_status,
        p_branch_id: branch_id
      });

      if (error) throw error;
      
      // Return flattened format for optimistic update
      const responseData = data as any;
      return [{
        id: responseData.document.id,
        employee_id,
        branch_id,
        country,
        nationality_status,
        ...docFields,
        document_types: docTypeData ? { name: docTypeData.name } : undefined
      }];
    },
    // Optimistic update for immediate UI feedback
    onMutate: async (newDocument) => {
      await queryClient.cancelQueries({ queryKey: documentQueryKeys.list() });
      
      const previousDocuments = queryClient.getQueryData<Document[]>(documentQueryKeys.list());
      
      // Create optimistic document with temporary ID
      const optimisticDocument = {
        ...newDocument,
        id: `temp-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      queryClient.setQueryData<Document[]>(documentQueryKeys.list(), (old) => {
        if (!old) return [optimisticDocument];
        return [optimisticDocument, ...old];
      });
      
      return { previousDocuments };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentQueryKeys.list() });
      toast({
        title: "Document added",
        description: "The document has been added successfully.",
      });
    },
    onError: (error: any, variables, context) => {
      if (context?.previousDocuments) {
        queryClient.setQueryData(documentQueryKeys.list(), context.previousDocuments);
      }
      console.error('Error adding document:', error);
      toast({
        title: "Error adding document",
        description: "Could not add document. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateDocument = useMutation({
    mutationFn: async ({ id, ...updateData }: { id: string; [key: string]: any }) => {
      // Extract employee-level and document-level data
      const { employee_id, country, nationality_status, branch_id, ...docFields } = updateData;
      
      // Include the document ID in the document object
      const documentWithId = { id, ...docFields };
      
      // Call upsert function (which handles updates)
      const { data, error } = await supabase.rpc('upsert_employee_document', {
        p_employee_id: employee_id,
        p_document: documentWithId,
        p_country: country,
        p_nationality_status: nationality_status,
        p_branch_id: branch_id
      });

      if (error) throw error;
      
      return [{
        id,
        employee_id,
        branch_id,
        country,
        nationality_status,
        ...docFields
      }];
    },
    // Optimistic update for immediate UI feedback
    onMutate: async ({ id, ...updateData }) => {
      await queryClient.cancelQueries({ queryKey: documentQueryKeys.list() });
      
      const previousDocuments = queryClient.getQueryData<Document[]>(documentQueryKeys.list());
      
      queryClient.setQueryData<Document[]>(documentQueryKeys.list(), (old) => {
        if (!old) return [];
        return old.map(doc => 
          doc.id === id 
            ? { ...doc, ...updateData }
            : doc
        );
      });
      
      return { previousDocuments };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentQueryKeys.list() });
      toast({
        title: "Document updated",
        description: "The document has been updated successfully.",
      });
    },
    onError: (error: any, variables, context) => {
      if (context?.previousDocuments) {
        queryClient.setQueryData(documentQueryKeys.list(), context.previousDocuments);
      }
      console.error('Error updating document:', error);
      toast({
        title: "Error updating document",
        description: "Could not update document. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteDocuments = useMutation({
    mutationFn: async (documentIds: string[]) => {
      // Get all documents to find their employee_ids
      const { data: allDocs } = await supabase
        .from('document_tracker')
        .select('employee_id, documents');
      
      if (!allDocs) return;
      
      // Delete each document using the helper function
      for (const docId of documentIds) {
        // Find which employee this document belongs to
        let employeeId: string | null = null;
        
        for (const tracker of allDocs) {
          const docs = (tracker.documents as any[]) || [];
          if (docs.some((d: any) => d.id === docId)) {
            employeeId = tracker.employee_id;
            break;
          }
        }
        
        if (employeeId) {
          const { error } = await supabase.rpc('delete_employee_document', {
            p_employee_id: employeeId,
            p_document_id: docId
          });
          
          if (error) throw error;
        }
      }
    },
    // Optimistic update for immediate UI feedback
    onMutate: async (documentIds) => {
      await queryClient.cancelQueries({ queryKey: documentQueryKeys.list() });
      
      const previousDocuments = queryClient.getQueryData<Document[]>(documentQueryKeys.list());
      
      queryClient.setQueryData<Document[]>(documentQueryKeys.list(), (old) => {
        if (!old) return [];
        return old.filter(doc => !documentIds.includes(doc.id));
      });
      
      return { previousDocuments };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentQueryKeys.list() });
      toast({
        title: "Documents deleted",
        description: "The selected documents have been deleted successfully.",
      });
    },
    onError: (error: any, variables, context) => {
      if (context?.previousDocuments) {
        queryClient.setQueryData(documentQueryKeys.list(), context.previousDocuments);
      }
      console.error('Error deleting documents:', error);
      toast({
        title: "Error deleting documents",
        description: "Could not delete documents. Please try again.",
        variant: "destructive",
      });
    },
  });

  return {
    createDocument,
    updateDocument,
    deleteDocuments,
  };
}
