import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface FieldSetting {
  id: string;
  step_name: string;
  field_name: string;
  field_label: string;
  is_required: boolean;
  is_visible: boolean;
  validation_rules: any;
  help_text: string | null;
  display_order: number;
}

const STEP_OPTIONS = [
  { value: 'personal_info', label: 'Personal Information' },
  { value: 'availability', label: 'Availability' },
  { value: 'employment_history', label: 'Employment History' },
  { value: 'references', label: 'References' },
  { value: 'skills_experience', label: 'Skills & Experience' },
  { value: 'declaration', label: 'Declaration' },
  { value: 'terms_policy', label: 'Terms & Policy' },
];

export function ApplicationFieldSettings() {
  const [fields, setFields] = useState<FieldSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStep, setSelectedStep] = useState('personal_info');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    field_name: '',
    field_label: '',
    help_text: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchFields();
  }, []);

  const fetchFields = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('application_field_settings')
        .select('*')
        .order('step_name', { ascending: true })
        .order('display_order', { ascending: true });

      if (error) throw error;
      setFields(data || []);
    } catch (error) {
      console.error('Error fetching field settings:', error);
      toast({
        title: "Error",
        description: "Failed to load field settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addField = async () => {
    if (!formData.field_name.trim() || !formData.field_label.trim()) return;

    try {
      const maxOrder = Math.max(
        ...fields
          .filter(f => f.step_name === selectedStep)
          .map(f => f.display_order),
        0
      );

      const { error } = await (supabase as any)
        .from('application_field_settings')
        .insert({
          step_name: selectedStep,
          field_name: formData.field_name.trim(),
          field_label: formData.field_label.trim(),
          help_text: formData.help_text.trim() || null,
          display_order: maxOrder + 1,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Field added successfully",
      });

      setFormData({ field_name: '', field_label: '', help_text: '' });
      setShowAddForm(false);
      fetchFields();
    } catch (error) {
      console.error('Error adding field:', error);
      toast({
        title: "Error",
        description: "Failed to add field",
        variant: "destructive",
      });
    }
  };

  const updateField = async (id: string, updates: Partial<FieldSetting>) => {
    try {
      const { error } = await (supabase as any)
        .from('application_field_settings')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Field updated successfully",
      });

      fetchFields();
    } catch (error) {
      console.error('Error updating field:', error);
      toast({
        title: "Error",
        description: "Failed to update field",
        variant: "destructive",
      });
    }
  };

  const deleteField = async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from('application_field_settings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Field deleted successfully",
      });

      fetchFields();
    } catch (error) {
      console.error('Error deleting field:', error);
      toast({
        title: "Error",
        description: "Failed to delete field",
        variant: "destructive",
      });
    }
  };

  const getFilteredFields = () => {
    return fields.filter(f => f.step_name === selectedStep);
  };

  if (loading) {
    return <div>Loading field settings...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Application Field Settings
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            className="ml-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Field
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <Label htmlFor="stepName">Application Step:</Label>
          <Select value={selectedStep} onValueChange={setSelectedStep}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STEP_OPTIONS.map(step => (
                <SelectItem key={step.value} value={step.value}>
                  {step.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {showAddForm && (
          <Card className="p-4 bg-muted/50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fieldName">Field Name</Label>
                <Input
                  id="fieldName"
                  placeholder="e.g., fullName"
                  value={formData.field_name}
                  onChange={(e) => setFormData({ ...formData, field_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="fieldLabel">Field Label</Label>
                <Input
                  id="fieldLabel"
                  placeholder="e.g., Full Name"
                  value={formData.field_label}
                  onChange={(e) => setFormData({ ...formData, field_label: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="helpText">Help Text (Optional)</Label>
                <Textarea
                  id="helpText"
                  placeholder="Additional help text for this field"
                  value={formData.help_text}
                  onChange={(e) => setFormData({ ...formData, help_text: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-4 mt-4">
              <Button onClick={addField} disabled={!formData.field_name.trim() || !formData.field_label.trim()}>
                <Save className="w-4 h-4 mr-2" />
                Add Field
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddForm(false);
                  setFormData({ field_name: '', field_label: '', help_text: '' });
                }}
              >
                <X className="w-4 h-4" />
                Cancel
              </Button>
            </div>
          </Card>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Field Name</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Required</TableHead>
              <TableHead>Visible</TableHead>
              <TableHead>Display Order</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {getFilteredFields().map((field) => (
              <TableRow key={field.id}>
                <TableCell className="font-mono text-sm">{field.field_name}</TableCell>
                <TableCell>{field.field_label}</TableCell>
                <TableCell>
                  <Switch
                    checked={field.is_required}
                    onCheckedChange={(checked) =>
                      updateField(field.id, { is_required: checked })
                    }
                  />
                  <Badge variant={field.is_required ? 'default' : 'secondary'} className="ml-2">
                    {field.is_required ? 'Required' : 'Optional'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={field.is_visible}
                    onCheckedChange={(checked) =>
                      updateField(field.id, { is_visible: checked })
                    }
                  />
                  <Badge variant={field.is_visible ? 'default' : 'secondary'} className="ml-2">
                    {field.is_visible ? 'Visible' : 'Hidden'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={field.display_order}
                    onChange={(e) =>
                      updateField(field.id, { display_order: parseInt(e.target.value) })
                    }
                    className="w-20"
                  />
                </TableCell>
                <TableCell className="space-x-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteField(field.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}