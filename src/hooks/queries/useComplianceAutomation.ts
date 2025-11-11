import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CronJobStatus {
  job_name: string;
  schedule: string;
  active: boolean;
}

interface AutomationSettings {
  id: string;
  auto_generate_records: boolean;
  grace_period_days: number;
  notification_days_before: number;
  escalation_days: number;
  auto_archive_completed: boolean;
  created_at: string;
  updated_at: string;
}

// Fetch automation settings
export function useAutomationSettings() {
  return useQuery({
    queryKey: ['compliance-automation-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compliance_automation_settings')
        .select('*')
        .single();
      
      if (error) throw error;
      return data as AutomationSettings;
    },
  });
}

// Fetch cron job statuses
export function useAutomationCronJobs() {
  return useQuery({
    queryKey: ['compliance-automation-cron-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_all_compliance_automation_status');
      
      if (error) throw error;
      return data as CronJobStatus[];
    },
  });
}

// Update automation settings
export function useUpdateAutomationSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (settings: Partial<AutomationSettings>) => {
      const { data, error } = await supabase
        .from('compliance_automation_settings')
        .update(settings)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-automation-settings'] });
      toast({
        title: "Success",
        description: "Automation settings updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update automation settings.",
        variant: "destructive",
      });
    },
  });
}

// Manually trigger compliance automation
export function useTriggerAutomation() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('compliance-automation', {
        body: { manual_trigger: true }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Automation Triggered",
        description: `Generated ${data.recordsGenerated} records, updated ${data.statusesUpdated} statuses.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to trigger automation.",
        variant: "destructive",
      });
    },
  });
}

// Manually trigger archival
export function useTriggerArchival() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params?: { complianceTypeId?: string; year?: number; forceArchival?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('compliance-data-archival', {
        body: params || {}
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Archival Completed",
        description: `Archived ${data.recordsArchived} records across ${data.entriesProcessed} entries.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to trigger archival.",
        variant: "destructive",
      });
    },
  });
}

// Manually trigger notifications
export function useTriggerNotifications() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('compliance-notifications', {
        body: { manual_trigger: true }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Notifications Sent",
        description: `Sent ${data.totalNotificationsSent} compliance notifications.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to trigger notifications.",
        variant: "destructive",
      });
    },
  });
}
