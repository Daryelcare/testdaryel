import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface EmailSettings {
  sender_email: string;
  sender_name: string;
  admin_email: string;
}

export function EmailSettings() {
  const [emailSettings, setEmailSettings] = useState<EmailSettings>({
    sender_email: "noreply@yourcompany.com",
    sender_name: "Your Company",
    admin_email: "admin@yourcompany.com"
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadEmailSettings();
  }, []);

  const loadEmailSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_email_settings');
      
      if (error) {
        console.error('Error loading email settings:', error);
        return;
      }

      if (data) {
        const settings = data as any;
        setEmailSettings({
          sender_email: settings.sender_email || "noreply@yourcompany.com",
          sender_name: settings.sender_name || "Your Company", 
          admin_email: settings.admin_email || "admin@yourcompany.com"
        });
      }
    } catch (error) {
      console.error('Error loading email settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveEmailSettings = async () => {
    try {
      setSaving(true);
      
      // Check if settings exist
      const { data: existing } = await supabase
        .from('system_settings')
        .select('id')
        .eq('setting_key', 'email_settings')
        .single();

      const settingsData = {
        setting_key: 'email_settings',
        setting_value: emailSettings,
        description: 'Email configuration settings for system emails',
        updated_at: new Date().toISOString()
      };

      if (existing?.id) {
        // Update existing
        const { error } = await supabase
          .from('system_settings')
          .update({
            setting_value: emailSettings as any,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('system_settings')
          .insert({
            setting_key: 'email_settings',
            setting_value: emailSettings as any,
            description: 'Email configuration settings for system emails',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Email settings saved successfully",
      });
    } catch (error) {
      console.error('Error saving email settings:', error);
      toast({
        title: "Error",
        description: "Failed to save email settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof EmailSettings, value: string) => {
    setEmailSettings(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email Settings</CardTitle>
          <CardDescription>Loading email configuration...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Settings</CardTitle>
        <CardDescription>
          Configure email addresses used by the system for notifications and administration.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="sender_email">Sender Email</Label>
          <Input
            id="sender_email"
            type="email"
            value={emailSettings.sender_email}
            onChange={(e) => updateField("sender_email", e.target.value)}
            placeholder="noreply@yourcompany.com"
          />
          <p className="text-sm text-muted-foreground">
            Email address used for outgoing system emails (document signing, references, etc.)
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="sender_name">Sender Name</Label>
          <Input
            id="sender_name"
            value={emailSettings.sender_name}
            onChange={(e) => updateField("sender_name", e.target.value)}
            placeholder="Your Company"
          />
          <p className="text-sm text-muted-foreground">
            Display name for outgoing system emails
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="admin_email">Admin Email</Label>
          <Input
            id="admin_email"
            type="email"
            value={emailSettings.admin_email}
            onChange={(e) => updateField("admin_email", e.target.value)}
            placeholder="admin@yourcompany.com"
          />
          <p className="text-sm text-muted-foreground">
            Email address for the system administrator account
          </p>
        </div>

        <div className="flex gap-2 pt-4">
          <Button 
            onClick={saveEmailSettings}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Settings"}
          </Button>
          <Button 
            variant="outline"
            onClick={loadEmailSettings}
            disabled={loading}
          >
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}