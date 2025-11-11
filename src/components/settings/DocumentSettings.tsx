
import { useState, useEffect } from "react";
import { FileText, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DocumentTypeManagement } from "./DocumentTypeManagement";

interface DocumentSettingsData {
  id?: string;
  expiry_threshold_days: number;
  email_notifications: boolean;
  auto_reminders: boolean;
  reminder_frequency: string;
}

export function DocumentSettings() {
  const [settings, setSettings] = useState<DocumentSettingsData>({
    expiry_threshold_days: 30,
    email_notifications: true,
    auto_reminders: true,
    reminder_frequency: 'weekly',
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('document_settings')
        .select('*')
        .maybeSingle();

      if (error) {
        console.error('Error fetching document settings:', error);
        return;
      }

      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching document settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (settings.id) {
        // Update existing record
        const { error } = await supabase
          .from('document_settings')
          .update(settings)
          .eq('id', settings.id);

        if (error) {
          console.error('Error updating document settings:', error);
          toast({
            title: "Error",
            description: "Failed to update document settings",
            variant: "destructive",
          });
          return;
        }
      } else {
        // Create new record
        const { data, error } = await supabase
          .from('document_settings')
          .insert([settings])
          .select()
          .single();

        if (error) {
          console.error('Error creating document settings:', error);
          toast({
            title: "Error",
            description: "Failed to create document settings",
            variant: "destructive",
          });
          return;
        }

        setSettings(data);
      }

      toast({
        title: "Success",
        description: "Document settings saved successfully",
      });
    } catch (error) {
      console.error('Error saving document settings:', error);
      toast({
        title: "Error",
        description: "Failed to save document settings",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div>Loading document settings...</div>;
  }

  return (
    <Card className="card-premium animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-primary" />
          Document Management Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="expiry-threshold">Expiry Warning Threshold (Days)</Label>
            <Input
              id="expiry-threshold"
              type="number"
              value={settings.expiry_threshold_days}
              onChange={(e) => setSettings(prev => ({ ...prev, expiry_threshold_days: parseInt(e.target.value) }))}
              placeholder="30"
            />
            <p className="text-sm text-muted-foreground">
              Alert when documents expire within this many days
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Send email alerts for expiring documents
                </p>
              </div>
              <Switch 
                checked={settings.email_notifications}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, email_notifications: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Automatic Reminders</Label>
                <p className="text-sm text-muted-foreground">
                  Send weekly reminders for expiring documents
                </p>
              </div>
              <Switch 
                checked={settings.auto_reminders}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, auto_reminders: checked }))}
              />
            </div>
          </div>
        </div>

        <DocumentTypeManagement />

        <div className="flex justify-end">
          <Button onClick={handleSave} className="bg-gradient-primary hover:opacity-90">
            <Save className="w-4 h-4 mr-2" />
            Save Document Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
