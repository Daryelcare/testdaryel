import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit2, Save, X, GripVertical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface StepSetting {
  id: string;
  step_name: string;
  display_name: string;
  description: string | null;
  is_enabled: boolean;
  is_required: boolean;
  display_order: number;
  step_config: any;
}

export function ApplicationStepSettings() {
  const [steps, setSteps] = useState<StepSetting[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<StepSetting>>({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchSteps = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('application_step_settings')
        .select('*')
        .order('display_order');

      if (error) throw error;
      setSteps(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch step settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSteps();
  }, []);

  const handleEdit = (step: StepSetting) => {
    setEditingId(step.id);
    setEditForm(step);
  };

  const handleSave = async () => {
    if (!editingId || !editForm) return;

    try {
      const { error } = await (supabase as any)
        .from('application_step_settings')
        .update({
          display_name: editForm.display_name,
          description: editForm.description,
          is_enabled: editForm.is_enabled,
          is_required: editForm.is_required,
          display_order: editForm.display_order,
        })
        .eq('id', editingId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Step settings updated successfully",
      });

      setEditingId(null);
      setEditForm({});
      fetchSteps();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update step settings",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  if (loading) {
    return <div className="text-center py-8">Loading step settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Application Step Settings</h3>
        <p className="text-muted-foreground">
          Configure which steps are enabled in the job application process and their display settings.
        </p>
      </div>

      <div className="space-y-4">
        {steps.map((step) => (
          <Card key={step.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-sm font-medium">
                      {editingId === step.id ? (
                        <Input
                          value={editForm.display_name || ''}
                          onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                          className="h-7 text-sm font-medium"
                        />
                      ) : (
                        step.display_name
                      )}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Step: {step.step_name} | Order: {step.display_order}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={step.is_enabled ? "default" : "secondary"}>
                    {step.is_enabled ? "Enabled" : "Disabled"}
                  </Badge>
                  {step.is_required && (
                    <Badge variant="outline">Required</Badge>
                  )}
                  {editingId === step.id ? (
                    <div className="flex space-x-1">
                      <Button size="sm" onClick={handleSave}>
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleCancel}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => handleEdit(step)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {editingId === step.id ? (
                <div className="space-y-4">
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={editForm.description || ''}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Display Order</Label>
                      <Input
                        type="number"
                        value={editForm.display_order || 0}
                        onChange={(e) => setEditForm({ ...editForm, display_order: parseInt(e.target.value) })}
                        min="0"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={editForm.is_enabled || false}
                        onCheckedChange={(checked) => setEditForm({ ...editForm, is_enabled: checked })}
                      />
                      <Label>Enabled</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={editForm.is_required || false}
                        onCheckedChange={(checked) => setEditForm({ ...editForm, is_required: checked })}
                      />
                      <Label>Required</Label>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground">
                    {step.description || 'No description provided'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}