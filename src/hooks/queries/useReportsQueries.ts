import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cacheConfig } from '@/lib/query-client';

export interface Branch {
  id: string;
  name: string;
}

export interface LeaveType {
  id: string;
  name: string;
}

export interface DocumentType {
  id: string;
  name: string;
}

export interface ComplianceType {
  id: string;
  name: string;
  frequency: string;
}

// Query Keys
export const reportsQueryKeys = {
  all: ['reports'] as const,
  branches: () => [...reportsQueryKeys.all, 'branches'] as const,
  leaveTypes: () => [...reportsQueryKeys.all, 'leave-types'] as const,
  documentTypes: () => [...reportsQueryKeys.all, 'document-types'] as const,
  complianceTypes: () => [...reportsQueryKeys.all, 'compliance-types'] as const,
} as const;

// Data fetching functions
export const fetchReportsBranches = async () => {
  const { data, error } = await supabase
    .from('branches')
    .select('id, name')
    .order('name');

  if (error) throw error;
  return data || [];
};

export const fetchReportsLeaveTypes = async () => {
  const { data, error } = await supabase
    .from('leave_types')
    .select('id, name')
    .order('name');

  if (error) throw error;
  return data || [];
};

export const fetchReportsDocumentTypes = async () => {
  const { data, error } = await supabase
    .from('document_types')
    .select('id, name')
    .order('name');

  if (error) throw error;
  return data || [];
};

export const fetchReportsComplianceTypes = async () => {
  const { data, error } = await supabase
    .from('compliance_types')
    .select('id, name, frequency')
    .order('name');

  if (error) throw error;
  return data || [];
};

// Query Hooks
export function useReportsBranches() {
  return useQuery({
    queryKey: reportsQueryKeys.branches(),
    queryFn: fetchReportsBranches,
    ...cacheConfig.static,
  });
}

export function useReportsLeaveTypes() {
  return useQuery({
    queryKey: reportsQueryKeys.leaveTypes(),
    queryFn: fetchReportsLeaveTypes,
    ...cacheConfig.static,
  });
}

export function useReportsDocumentTypes() {
  return useQuery({
    queryKey: reportsQueryKeys.documentTypes(),
    queryFn: fetchReportsDocumentTypes,
    ...cacheConfig.static,
  });
}

export function useReportsComplianceTypes() {
  return useQuery({
    queryKey: reportsQueryKeys.complianceTypes(),
    queryFn: fetchReportsComplianceTypes,
    ...cacheConfig.static,
  });
}