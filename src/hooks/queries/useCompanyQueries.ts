import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cacheConfig } from '@/lib/query-client';

interface CompanySettings {
  id: string;
  name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  logo: string;
  created_at: string;
  updated_at: string;
}

// Query keys
export const companyQueryKeys = {
  all: ['company'] as const,
  settings: () => [...companyQueryKeys.all, 'settings'] as const,
};

// Fetch company settings
async function fetchCompanySettings(): Promise<CompanySettings | null> {
  const { data, error } = await supabase
    .from('company_settings')
    .select('*')
    .limit(1);

  if (error) throw error;
  return data?.[0] || null;
}

// React Query hooks
export function useCompanySettings() {
  return useQuery({
    queryKey: companyQueryKeys.settings(),
    queryFn: fetchCompanySettings,
    ...cacheConfig.settings, // Settings data gets medium-long cache
  });
}

// Mutation hook for updating company settings
export function useUpdateCompanySettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Partial<CompanySettings> & { name?: string }) => {
      // Check if record exists first
      const { data: existingData } = await supabase
        .from('company_settings')
        .select('id')
        .maybeSingle();

      if (existingData?.id && settings.id) {
        // Update existing record
        const { data, error } = await supabase
          .from('company_settings')
          .update(settings)
          .eq('id', settings.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else if (existingData?.id) {
        // Update existing record without explicit ID
        const { data, error } = await supabase
          .from('company_settings')
          .update(settings)
          .eq('id', existingData.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new record - ensure required fields are present
        const insertData = {
          name: settings.name || 'Company Name',
          tagline: settings.tagline || '',
          address: settings.address || '',
          phone: settings.phone || '',
          email: settings.email || '',
          logo: settings.logo || '',
        };
        
        const { data, error } = await supabase
          .from('company_settings')
          .insert(insertData)
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: (data) => {
      // Update the cache with new data
      queryClient.setQueryData(companyQueryKeys.settings(), data);
    },
  });
}