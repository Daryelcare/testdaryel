
import { useState, useEffect } from "react";
import { Shield, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ComplianceTypeManagement } from "./ComplianceTypeManagement";


import { DataRetentionManagement } from "./DataRetentionManagement";

interface ComplianceSettingsData {
  id?: string;
  auto_generate_periods: boolean;
  reminder_days_before: number;
  email_notifications: boolean;
  archive_completed_records: boolean;
}

interface AutomationSettingsData {
  id?: string;
  auto_generate_records: boolean;
  grace_period_days: number;
  notification_days_before: number;
  escalation_days: number;
  auto_archive_completed: boolean;
}

export function ComplianceSettings() {
  const [settings, setSettings] = useState<ComplianceSettingsData>({
    auto_generate_periods: true,
    reminder_days_before: 7,
    email_notifications: true,
    archive_completed_records: false,
  });
  const [automationSettings, setAutomationSettings] = useState<AutomationSettingsData>({
    auto_generate_records: true,
    grace_period_days: 7,
    notification_days_before: 14,
    escalation_days: 30,
    auto_archive_completed: false,
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const [settingsResult, automationResult] = await Promise.all([
        supabase.from('compliance_settings').select('*').maybeSingle(),
        supabase.from('compliance_automation_settings').select('*').maybeSingle()
      ]);

      if (settingsResult.error) {
        console.error('Error fetching compliance settings:', settingsResult.error);
      } else if (settingsResult.data) {
        setSettings(settingsResult.data);
      }

      if (automationResult.error) {
        console.error('Error fetching automation settings:', automationResult.error);
      } else if (automationResult.data) {
        setAutomationSettings(automationResult.data);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const promises = [];

      // Save compliance settings
      if (settings.id) {
        promises.push(
          supabase.from('compliance_settings').update(settings).eq('id', settings.id)
        );
      } else {
        promises.push(
          supabase.from('compliance_settings').insert([settings]).select().single()
        );
      }

      // Save automation settings
      if (automationSettings.id) {
        promises.push(
          supabase.from('compliance_automation_settings').update(automationSettings).eq('id', automationSettings.id)
        );
      } else {
        promises.push(
          supabase.from('compliance_automation_settings').insert([automationSettings]).select().single()
        );
      }

      const results = await Promise.all(promises);

      // Check for errors
      const hasError = results.some(result => result.error);
      if (hasError) {
        results.forEach((result, index) => {
          if (result.error) {
            console.error(`Error saving ${index === 0 ? 'compliance' : 'automation'} settings:`, result.error);
          }
        });
        toast({
          title: "Error",
          description: "Failed to save some settings",
          variant: "destructive",
        });
        return;
      }

      // Update state with new data if needed
      if (!settings.id && results[0].data) {
        setSettings(results[0].data);
      }
      if (!automationSettings.id && results[1].data) {
        setAutomationSettings(results[1].data);
      }

      toast({
        title: "Success",
        description: "All compliance settings saved successfully",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div>Loading compliance settings...</div>;
  }

  return (
    <Card className="card-premium animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-primary" />
          Compliance Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reminder-days">Reminder Days Before Due</Label>
              <Input
                id="reminder-days"
                type="number"
                value={settings.reminder_days_before}
                onChange={(e) => setSettings(prev => ({ ...prev, reminder_days_before: parseInt(e.target.value) }))}
                placeholder="7"
              />
              <p className="text-sm text-muted-foreground">
                Send reminders this many days before compliance is due
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-generate Periods</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically create compliance periods
                </p>
              </div>
              <Switch 
                checked={settings.auto_generate_periods}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, auto_generate_periods: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Send email reminders for compliance tasks
                </p>
              </div>
              <Switch 
                checked={settings.email_notifications}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, email_notifications: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Archive Completed Records</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically archive completed compliance records
                </p>
              </div>
              <Switch 
                checked={settings.archive_completed_records}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, archive_completed_records: checked }))}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-lg">Automation Settings</h4>

            <div className="space-y-2">
              <Label htmlFor="notification-days">Notification Days Before</Label>
              <Input
                id="notification-days"
                type="number"
                value={automationSettings.notification_days_before}
                onChange={(e) => setAutomationSettings(prev => ({ ...prev, notification_days_before: parseInt(e.target.value) }))}
                placeholder="14"
              />
              <p className="text-sm text-muted-foreground">
                Days before due date to send notifications
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="escalation-days">Escalation Days</Label>
              <Input
                id="escalation-days"
                type="number"
                value={automationSettings.escalation_days}
                onChange={(e) => setAutomationSettings(prev => ({ ...prev, escalation_days: parseInt(e.target.value) }))}
                placeholder="30"
              />
              <p className="text-sm text-muted-foreground">
                Days overdue before escalating to management
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-generate Records</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically create compliance records for new periods
                </p>
              </div>
              <Switch 
                checked={automationSettings.auto_generate_records}
                onCheckedChange={(checked) => setAutomationSettings(prev => ({ ...prev, auto_generate_records: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-archive Completed</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically archive completed compliance records
                </p>
              </div>
              <Switch 
                checked={automationSettings.auto_archive_completed}
                onCheckedChange={(checked) => setAutomationSettings(prev => ({ ...prev, auto_archive_completed: checked }))}
              />
            </div>
          </div>
        </div>

        <ComplianceTypeManagement />
        <DataRetentionManagement />

        <div className="flex justify-end">
          <Button onClick={handleSave} className="bg-gradient-primary hover:opacity-90">
            <Save className="w-4 h-4 mr-2" />
            Save Compliance Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
