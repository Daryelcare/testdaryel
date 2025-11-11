import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UnifiedJobApplicationSetting {
  id: string;
  category: string;
  setting_type?: string;
  setting_key: string;
  setting_value: any;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const fetchUnifiedJobApplicationSettings = async (category?: string) => {
  let query = supabase
    .from('job_application_settings')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
};

export function useUnifiedJobApplicationSettings(category?: string) {
  return useQuery({
    queryKey: ['unified-job-application-settings', category],
    queryFn: () => fetchUnifiedJobApplicationSettings(category),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Helper functions to transform data for specific use cases
export const transformPersonalSettings = (settings: UnifiedJobApplicationSetting[]) => {
  const personalSettings = settings.filter(s => s.category === 'personal');
  const grouped: Record<string, string[]> = {};
  
  personalSettings.forEach(setting => {
    const type = setting.setting_type || 'default';
    if (!grouped[type]) {
      grouped[type] = [];
    }
    grouped[type].push(setting.setting_value.value || setting.setting_key);
  });
  
  return grouped;
};

export const transformEmergencySettings = (settings: UnifiedJobApplicationSetting[]) => {
  const emergencySettings = settings.filter(s => s.category === 'emergency');
  const grouped: Record<string, string[]> = {};
  
  emergencySettings.forEach(setting => {
    const type = setting.setting_type || 'default';
    if (!grouped[type]) {
      grouped[type] = [];
    }
    grouped[type].push(setting.setting_value.value || setting.setting_key);
  });
  
  return grouped;
};

export const transformShiftSettings = (settings: UnifiedJobApplicationSetting[]) => {
  return settings
    .filter(s => s.category === 'shift')
    .map(setting => ({
      id: setting.id,
      name: setting.setting_value.name,
      label: setting.setting_value.label,
      start_time: setting.setting_value.start_time,
      end_time: setting.setting_value.end_time,
      is_active: setting.is_active,
      display_order: setting.display_order
    }));
};

export const transformSkillsSettings = (settings: UnifiedJobApplicationSetting[]) => {
  const skillsSettings = settings.filter(s => s.category === 'skills');
  const categories = skillsSettings.filter(s => s.setting_type === 'category' && s.setting_value?.id);
  const skills = skillsSettings.filter(s => s.setting_type === 'skill');
  
  const skillsByCategory: Record<string, any[]> = {};
  
  categories.forEach(category => {
    const categoryName = category.setting_value.name;
    const categoryId = category.setting_value.id;
    skillsByCategory[categoryName] = skills
      .filter(skill => skill.setting_value.category_id === categoryId)
      .map(skill => ({
        id: skill.id,
        name: skill.setting_value.name,
        display_order: skill.display_order
      }));
  });
  
  return skillsByCategory;
};

export const transformStatusSettings = (settings: UnifiedJobApplicationSetting[]) => {
  return settings
    .filter(s => s.category === 'status')
    .map(setting => setting.setting_value.status_name)
    .filter(Boolean);
};

export const transformPositionSettings = (settings: UnifiedJobApplicationSetting[]) => {
  return settings
    .filter(s => s.category === 'position')
    .map(setting => ({
      id: setting.id,
      title: setting.setting_value.title,
      description: setting.setting_value.description || null,
      department: setting.setting_value.department || null,
      location: setting.setting_value.location || null,
      is_active: setting.is_active,
      display_order: setting.display_order
    }))
    .sort((a, b) => a.display_order - b.display_order);
};