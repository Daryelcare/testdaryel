import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cacheConfig } from '@/lib/query-client';
import { ALL_LANGUAGES } from '@/constants/languages';

export function useLanguageOptions() {
  return useQuery({
    queryKey: ['language-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_application_settings')
        .select('setting_value')
        .eq('setting_type', 'language')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      
      // Extract language names from setting_value
      const dbLanguages = data?.map(item => {
        const settingValue = item.setting_value as { label?: string; value?: string } | null;
        return settingValue?.label || settingValue?.value;
      }).filter(Boolean) as string[] || [];
      
      // Return DB languages if available, otherwise fallback to ALL_LANGUAGES
      return dbLanguages.length > 0 ? dbLanguages : ALL_LANGUAGES;
    },
    ...cacheConfig.static, // Cache for 1 hour (static reference data)
  });
}
