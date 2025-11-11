
import { useState, useEffect } from "react";
import { Calendar, Save, RotateCcw, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LeaveTypeManagement } from "./LeaveTypeManagement";

interface LeaveSettingsData {
  id?: string;
  default_leave_days: number;
  carry_over_enabled: boolean;
  manager_approval_required: boolean;
  max_carry_over_days: number;
}

interface FiscalSettings {
  default_leave_days: number;
  fiscal_year_start_month: number;
  fiscal_year_start_day: number;
  enable_auto_reset: boolean;
  last_auto_reset_at?: string | null;
}

export function LeaveSettings() {
  const [settings, setSettings] = useState<LeaveSettingsData>({
    default_leave_days: 28,
    carry_over_enabled: true,
    manager_approval_required: true,
    max_carry_over_days: 5,
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [fySettings, setFySettings] = useState<FiscalSettings>({
    default_leave_days: 28,
    fiscal_year_start_month: 4,
    fiscal_year_start_day: 1,
    enable_auto_reset: true,
    last_auto_reset_at: null,
  });
  const [fySaving, setFySaving] = useState(false);
  const [runningReset, setRunningReset] = useState(false);
  const [runningCheck, setRunningCheck] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchFiscalSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_settings')
        .select('*')
        .maybeSingle();

      if (error) {
        console.error('Error fetching leave settings:', error);
        return;
      }

      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching leave settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFiscalSettings = async () => {
    try {
      const { data, error } = await (supabase as any).rpc('get_leave_settings');
      if (error) {
        console.error('Error fetching fiscal settings:', error);
        return;
      }
      if (data) {
        const d: any = data as any;
        setFySettings({
          default_leave_days: Number(d.default_leave_days) || 28,
          fiscal_year_start_month: Number(d.fiscal_year_start_month) || 4,
          fiscal_year_start_day: Number(d.fiscal_year_start_day) || 1,
          enable_auto_reset: d.enable_auto_reset ?? true,
          last_auto_reset_at: d.last_auto_reset_at ?? null,
        });
      }
    } catch (err) {
      console.error('Error fetching fiscal settings:', err);
    }
  };

  const saveFiscalSettings = async () => {
    try {
      setFySaving(true);
      const { data: existing, error: selError } = await supabase
        .from('system_settings')
        .select('id, setting_value')
        .eq('setting_key', 'leave_settings')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (selError) {
        throw selError;
      }
      const existingValue = (existing as any)?.setting_value || {};
      const settingValue = {
        ...existingValue,
        default_leave_days: fySettings.default_leave_days,
        fiscal_year_start_month: fySettings.fiscal_year_start_month,
        fiscal_year_start_day: fySettings.fiscal_year_start_day,
        enable_auto_reset: fySettings.enable_auto_reset,
        last_auto_reset_at: existingValue.last_auto_reset_at ?? fySettings.last_auto_reset_at ?? null,
      } as any;
      if ((existing as any)?.id) {
        const { error: updError } = await supabase
          .from('system_settings')
          .update({ setting_value: settingValue, updated_at: new Date().toISOString() })
          .eq('id', (existing as any).id);
        if (updError) throw updError;
      } else {
        const { error: insError } = await supabase
          .from('system_settings')
          .insert([{
            setting_key: 'leave_settings',
            setting_value: settingValue,
            description: 'Leave management settings',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }]);
        if (insError) throw insError;
      }
      toast({ title: 'Saved', description: 'Fiscal year & auto-reset settings saved.' });
      await fetchFiscalSettings();
    } catch (error) {
      console.error('Error saving fiscal settings:', error);
      toast({ title: 'Error', description: 'Failed to save fiscal settings', variant: 'destructive' });
    } finally {
      setFySaving(false);
    }
  };

  const handleManualReset = async () => {
    try {
      setRunningReset(true);
      const { data, error } = await (supabase as any).rpc('reset_all_leave_balances');
      if (error) throw error;
      const count = data as number;
      toast({ title: 'Balances reset', description: `${count} employee balances updated.` });
      // Refresh fiscal settings to show updated last reset timestamp
      await fetchFiscalSettings();
    } catch (error) {
      console.error('Manual reset failed:', error);
      toast({ title: 'Error', description: 'Manual reset failed', variant: 'destructive' });
    } finally {
      setRunningReset(false);
    }
  };

  const handleRunAnnualCheck = async () => {
    try {
      setRunningCheck(true);
      const { data, error } = await (supabase as any).rpc('run_leave_annual_reset_if_needed');
      if (error) throw error;
      const result = data as string;
      toast({
        title: 'Annual reset',
        description: result === 'reset_performed' ? 'Annual reset performed.' : 'No reset needed today.',
      });
      await fetchFiscalSettings();
    } catch (error) {
      console.error('Annual reset check failed:', error);
      toast({ title: 'Error', description: 'Annual reset check failed', variant: 'destructive' });
    } finally {
      setRunningCheck(false);
    }
  };

  const handleSave = async () => {
    try {
      if (settings.id) {
        // Update existing record
        const { error } = await supabase
          .from('leave_settings')
          .update({
            default_leave_days: settings.default_leave_days,
            carry_over_enabled: settings.carry_over_enabled,
            manager_approval_required: settings.manager_approval_required,
            max_carry_over_days: settings.max_carry_over_days,
          })
          .eq('id', settings.id);

        if (error) {
          console.error('Error updating leave settings:', error);
          toast({
            title: "Error",
            description: "Failed to update leave settings",
            variant: "destructive",
          });
          return;
        }
      } else {
        // Check if any record exists first
        const { data: existingData, error: fetchError } = await supabase
          .from('leave_settings')
          .select('*')
          .maybeSingle();

        if (fetchError) {
          console.error('Error checking existing leave settings:', fetchError);
          toast({
            title: "Error",
            description: "Failed to check existing leave settings",
            variant: "destructive",
          });
          return;
        }

        if (existingData) {
          // Update the existing record
          const { error } = await supabase
            .from('leave_settings')
            .update({
              default_leave_days: settings.default_leave_days,
              carry_over_enabled: settings.carry_over_enabled,
              manager_approval_required: settings.manager_approval_required,
              max_carry_over_days: settings.max_carry_over_days,
            })
            .eq('id', existingData.id);

          if (error) {
            console.error('Error updating existing leave settings:', error);
            toast({
              title: "Error",
              description: "Failed to update leave settings",
              variant: "destructive",
            });
            return;
          }

          setSettings(prev => ({ ...prev, id: existingData.id }));
        } else {
          // Create new record only if none exists
          const { data, error } = await supabase
            .from('leave_settings')
            .insert([{
              default_leave_days: settings.default_leave_days,
              carry_over_enabled: settings.carry_over_enabled,
              manager_approval_required: settings.manager_approval_required,
              max_carry_over_days: settings.max_carry_over_days,
            }])
            .select()
            .single();

          if (error) {
            console.error('Error creating leave settings:', error);
            toast({
              title: "Error",
              description: "Failed to create leave settings",
              variant: "destructive",
            });
            return;
          }

          setSettings(prev => ({ ...prev, id: data.id }));
        }
      }

      toast({
        title: "Success",
        description: "Leave settings saved successfully",
      });
    } catch (error) {
      console.error('Error saving leave settings:', error);
      toast({
        title: "Error",
        description: "Failed to save leave settings",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div>Loading leave settings...</div>;
  }

  return (
    <div className="space-y-6">
      <Card className="card-premium animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-primary" />
            Leave Management Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="default-leave-days">Default Annual Leave Days</Label>
              <Input
                id="default-leave-days"
                type="number"
                value={settings.default_leave_days}
                onChange={(e) => setSettings(prev => ({ ...prev, default_leave_days: parseInt(e.target.value) }))}
                placeholder="28"
              />
              <p className="text-sm text-muted-foreground">
                Default number of leave days for new employees
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-carry-over">Maximum Carry Over Days</Label>
              <Input
                id="max-carry-over"
                type="number"
                value={settings.max_carry_over_days}
                onChange={(e) => setSettings(prev => ({ ...prev, max_carry_over_days: parseInt(e.target.value) }))}
                placeholder="5"
              />
              <p className="text-sm text-muted-foreground">
                Maximum days that can be carried over to next year
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Carry Over Leave Days</Label>
                <p className="text-sm text-muted-foreground">
                  Allow unused leave to carry over to next year
                </p>
              </div>
              <Switch 
                checked={settings.carry_over_enabled}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, carry_over_enabled: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Manager Approval Required</Label>
                <p className="text-sm text-muted-foreground">
                  Require manager approval for all leave requests
                </p>
              </div>
              <Switch 
                checked={settings.manager_approval_required}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, manager_approval_required: checked }))}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} className="bg-gradient-primary hover:opacity-90">
              <Save className="w-4 h-4 mr-2" />
              Save Leave Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="card-premium animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-primary" />
            Fiscal Year & Auto Reset
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="fy-start-month">Fiscal Year Start Month</Label>
              <Input
                id="fy-start-month"
                type="number"
                min={1}
                max={12}
                value={fySettings.fiscal_year_start_month}
                onChange={(e) => setFySettings((prev) => ({ ...prev, fiscal_year_start_month: parseInt(e.target.value || '0') || 1 }))}
              />
              <p className="text-sm text-muted-foreground">1 = January, 4 = April, etc.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fy-start-day">Fiscal Year Start Day</Label>
              <Input
                id="fy-start-day"
                type="number"
                min={1}
                max={31}
                value={fySettings.fiscal_year_start_day}
                onChange={(e) => setFySettings((prev) => ({ ...prev, fiscal_year_start_day: parseInt(e.target.value || '0') || 1 }))}
              />
              <p className="text-sm text-muted-foreground">Day of month the new leave year starts</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fy-default-days">Default Leave Days (for resets)</Label>
              <Input
                id="fy-default-days"
                type="number"
                min={0}
                value={fySettings.default_leave_days}
                onChange={(e) => setFySettings((prev) => ({ ...prev, default_leave_days: parseInt(e.target.value || '0') || 0 }))}
              />
              <p className="text-sm text-muted-foreground">Used when resetting all balances</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Automatic Annual Reset</Label>
              <p className="text-sm text-muted-foreground">Automatically reset balances on fiscal year start</p>
            </div>
            <Switch
              checked={fySettings.enable_auto_reset}
              onCheckedChange={(checked) => setFySettings((prev) => ({ ...prev, enable_auto_reset: checked }))}
            />
          </div>

          {fySettings.last_auto_reset_at && (
            <p className="text-sm text-muted-foreground">Last auto reset: {new Date(fySettings.last_auto_reset_at).toLocaleString()}</p>
          )}

          <div className="flex flex-wrap gap-3 justify-between">
            <Button onClick={saveFiscalSettings} disabled={fySaving} className="bg-gradient-primary hover:opacity-90">
              <Save className="w-4 h-4 mr-2" />
              {fySaving ? 'Saving...' : 'Save Fiscal Settings'}
            </Button>
            <div className="flex gap-3">
              <Button onClick={handleManualReset} disabled={runningReset} variant="outline">
                <RotateCcw className="w-4 h-4 mr-2" />
                {runningReset ? 'Resetting…' : 'Reset All Leave Balances Now'}
              </Button>
              <Button onClick={handleRunAnnualCheck} disabled={runningCheck} variant="outline">
                <RefreshCcw className="w-4 h-4 mr-2" />
                {runningCheck ? 'Checking…' : 'Run Annual Reset Check Now'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <LeaveTypeManagement />
    </div>
  );
}
