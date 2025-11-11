import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface StatusSetting {
  id: string;
  setting_key: string;
  setting_value: {
    status_name: string;
    status_label: string;
    status_color: string;
    is_default: boolean;
    display_order: number;
    is_active: boolean;
  };
  display_order: number;
  is_active: boolean;
}

interface StatusSettingDB {
  id: string;
  category: string;
  setting_key: string;
  setting_type: string;
  setting_value: any;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function ApplicationStatusSettings() {
  const [statuses, setStatuses] = useState<StatusSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    status_name: '',
    status_label: '',
    status_color: '#64748b',
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchStatuses();
  }, []);

  const fetchStatuses = async () => {
    try {
      const { data, error } = await supabase
        .from('job_application_settings')
        .select('*')
        .eq('category', 'status')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      
      // Transform the data to match our interface
      const transformedData: StatusSetting[] = (data || []).map((item: StatusSettingDB) => ({
        id: item.id,
        setting_key: item.setting_key,
        setting_value: item.setting_value as StatusSetting['setting_value'],
        display_order: item.display_order,
        is_active: item.is_active
      }));
      
      setStatuses(transformedData);
    } catch (error) {
      console.error('Error fetching status settings:', error);
      toast({
        title: "Error",
        description: "Failed to load status settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addStatus = async () => {
    if (!formData.status_name.trim() || !formData.status_label.trim()) return;

    try {
      const maxOrder = Math.max(...statuses.map(s => s.display_order), 0);

      const settingData = {
        category: 'status',
        setting_type: 'status',
        setting_key: formData.status_name.trim(),
        setting_value: {
          status_name: formData.status_name.trim(),
          status_label: formData.status_label.trim(),
          status_color: formData.status_color,
          is_default: false,
          display_order: maxOrder + 1,
          is_active: true
        },
        display_order: maxOrder + 1,
        is_active: true
      };

      const { error } = await supabase
        .from('job_application_settings')
        .insert(settingData);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Status added successfully",
      });

      setFormData({ status_name: '', status_label: '', status_color: '#64748b' });
      setShowAddForm(false);
      fetchStatuses();
    } catch (error) {
      console.error('Error adding status:', error);
      toast({
        title: "Error",
        description: "Failed to add status",
        variant: "destructive",
      });
    }
  };

  const updateStatus = async (id: string, updates: { is_active?: boolean; is_default?: boolean; display_order?: number }) => {
    try {
      const currentStatus = statuses.find(s => s.id === id);
      if (!currentStatus) return;

      // If setting as default, first remove default from all others
      if (updates.is_default === true) {
        const otherStatuses = statuses.filter(s => s.id !== id);
        for (const status of otherStatuses) {
          await supabase
            .from('job_application_settings')
            .update({ 
              setting_value: { ...status.setting_value, is_default: false },
              is_active: status.is_active,
              display_order: status.display_order
            })
            .eq('id', status.id);
        }
      }

      const updatedSettingValue = {
        ...currentStatus.setting_value,
        ...(updates.is_active !== undefined && { is_active: updates.is_active }),
        ...(updates.is_default !== undefined && { is_default: updates.is_default }),
        ...(updates.display_order !== undefined && { display_order: updates.display_order })
      };

      const { error } = await supabase
        .from('job_application_settings')
        .update({
          setting_value: updatedSettingValue,
          is_active: updates.is_active !== undefined ? updates.is_active : currentStatus.is_active,
          display_order: updates.display_order !== undefined ? updates.display_order : currentStatus.display_order
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Status updated successfully",
      });

      fetchStatuses();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const deleteStatus = async (id: string) => {
    const status = statuses.find(s => s.id === id);
    if (status?.setting_value.is_default) {
      toast({
        title: "Error",
        description: "Cannot delete the default status",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('job_application_settings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Status deleted successfully",
      });

      fetchStatuses();
    } catch (error) {
      console.error('Error deleting status:', error);
      toast({
        title: "Error",
        description: "Failed to delete status",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div>Loading status settings...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Application Status Settings
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            className="ml-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Status
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {showAddForm && (
          <Card className="p-4 bg-muted/50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="statusName">Status Name</Label>
                <Input
                  id="statusName"
                  placeholder="e.g., pending_review"
                  value={formData.status_name}
                  onChange={(e) => setFormData({ ...formData, status_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="statusLabel">Status Label</Label>
                <Input
                  id="statusLabel"
                  placeholder="e.g., Pending Review"
                  value={formData.status_label}
                  onChange={(e) => setFormData({ ...formData, status_label: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="statusColor">Color</Label>
                <Input
                  id="statusColor"
                  type="color"
                  value={formData.status_color}
                  onChange={(e) => setFormData({ ...formData, status_color: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-4 mt-4">
              <Button onClick={addStatus} disabled={!formData.status_name.trim() || !formData.status_label.trim()}>
                <Save className="w-4 h-4 mr-2" />
                Add Status
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddForm(false);
                  setFormData({ status_name: '', status_label: '', status_color: '#64748b' });
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
              <TableHead>Status Name</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Color</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Default</TableHead>
              <TableHead>Display Order</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {statuses.map((status) => (
              <TableRow key={status.id}>
                <TableCell className="font-mono text-sm">{status.setting_value.status_name}</TableCell>
                <TableCell>{status.setting_value.status_label}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded border"
                      style={{ backgroundColor: status.setting_value.status_color }}
                    />
                    <span className="text-sm font-mono">{status.setting_value.status_color}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={status.setting_value.is_active}
                    onCheckedChange={(checked) =>
                      updateStatus(status.id, { is_active: checked })
                    }
                  />
                </TableCell>
                <TableCell>
                  <Switch
                    checked={status.setting_value.is_default}
                    onCheckedChange={(checked) =>
                      updateStatus(status.id, { is_default: checked })
                    }
                  />
                  {status.setting_value.is_default && (
                    <Badge variant="secondary" className="ml-2">Default</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={status.setting_value.display_order}
                    onChange={(e) =>
                      updateStatus(status.id, { display_order: parseInt(e.target.value) })
                    }
                    className="w-20"
                  />
                </TableCell>
                <TableCell className="space-x-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteStatus(status.id)}
                    disabled={status.setting_value.is_default}
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