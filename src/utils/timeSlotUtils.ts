import { supabase } from "@/integrations/supabase/client";

// Cache for time slot mappings
let timeSlotCache: Record<string, string> | null = null;

export async function getTimeSlotMappings(): Promise<Record<string, string>> {
  if (timeSlotCache) {
    return timeSlotCache;
  }

  try {
    const { data, error } = await supabase
      .from('job_application_settings')
      .select('id, setting_value, is_active')
      .eq('category', 'shift')
      .order('display_order', { ascending: true });

    if (error) throw error;

    timeSlotCache = {};
    data?.forEach(slot => {
      if (timeSlotCache) {
        let label;
        try {
          const shiftValue = typeof slot.setting_value === 'string' 
            ? JSON.parse(slot.setting_value) 
            : slot.setting_value;
          label = (shiftValue as any)?.label || (shiftValue as any)?.name || slot.id;
        } catch {
          label = (slot.setting_value as any)?.label || (slot.setting_value as any)?.name || slot.id;
        }
        // Add "(Archived)" suffix for inactive shifts
        timeSlotCache[slot.id] = slot.is_active ? label : `${label} (Archived)`;
      }
    });

    return timeSlotCache || {};
  } catch (error) {
    console.error('Error fetching time slot mappings:', error);
    return {};
  }
}

export function mapTimeSlotIds(timeSlots: Record<string, any>, mappings: Record<string, string>): Record<string, any> {
  const mapped: Record<string, any> = {};
  
  Object.entries(timeSlots).forEach(([slotId, days]) => {
    const label = mappings[slotId] || '[Unknown Shift]';
    mapped[label] = days;
  });
  
  return mapped;
}