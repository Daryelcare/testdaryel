import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit2, Trash2 } from 'lucide-react';

interface ShiftSetting {
  id: string;
  setting_key: string;
  setting_value: {
    name: string;
    label: string;
    start_time: string;
    end_time: string;
    display_order: number;
    is_active: boolean;
  };
  display_order: number;
  is_active: boolean;
}

interface ShiftSettingDB {
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

export function ApplicationShiftSettings() {
  const [shifts, setShifts] = useState<ShiftSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingShift, setEditingShift] = useState<ShiftSetting | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    label: '',
    start_time: '',
    end_time: '',
    is_active: true,
    display_order: 0
  });

  useEffect(() => {
    fetchShifts();
  }, []);

  const fetchShifts = async () => {
    try {
      const { data, error } = await supabase
        .from('job_application_settings')
        .select('*')
        .eq('category', 'shift')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      
      // Transform the data to match our interface
      const transformedData: ShiftSetting[] = (data || []).map((item: ShiftSettingDB) => ({
        id: item.id,
        setting_key: item.setting_key,
        setting_value: item.setting_value as ShiftSetting['setting_value'],
        display_order: item.display_order,
        is_active: item.is_active
      }));
      
      setShifts(transformedData);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch shift settings",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const settingData = {
        category: 'shift',
        setting_type: 'shift',
        setting_key: formData.name,
        setting_value: {
          name: formData.name,
          label: formData.label,
          start_time: formData.start_time,
          end_time: formData.end_time,
          display_order: formData.display_order,
          is_active: formData.is_active
        },
        display_order: formData.display_order,
        is_active: formData.is_active
      };

      if (editingShift) {
        const { error } = await supabase
          .from('job_application_settings')
          .update(settingData)
          .eq('id', editingShift.id);

        if (error) throw error;
        toast({ title: "Success", description: "Shift updated successfully" });
      } else {
        const { error } = await supabase
          .from('job_application_settings')
          .insert([settingData]);

        if (error) throw error;
        toast({ title: "Success", description: "Shift created successfully" });
      }

      setShowDialog(false);
      setEditingShift(null);
      resetForm();
      fetchShifts();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save shift",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (shift: ShiftSetting) => {
    setEditingShift(shift);
    setFormData({
      name: shift.setting_value.name,
      label: shift.setting_value.label,
      start_time: shift.setting_value.start_time,
      end_time: shift.setting_value.end_time,
      is_active: shift.setting_value.is_active,
      display_order: shift.setting_value.display_order
    });
    setShowDialog(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('job_application_settings')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Success", description: "Shift deleted successfully" });
      fetchShifts();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete shift",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      label: '',
      start_time: '',
      end_time: '',
      is_active: true,
      display_order: shifts.length
    });
  };

  const openCreateDialog = () => {
    setEditingShift(null);
    resetForm();
    setShowDialog(true);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Shift Pattern Settings</CardTitle>
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Shift
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingShift ? 'Edit Shift' : 'Create New Shift'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="label">Display Label</Label>
                  <Input
                    id="label"
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start_time">Start Time</Label>
                    <Input
                      id="start_time"
                      type="time"
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="end_time">End Time</Label>
                    <Input
                      id="end_time"
                      type="time"
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="display_order">Display Order</Label>
                  <Input
                    id="display_order"
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
                    required
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>
                <Button type="submit">
                  {editingShift ? 'Update' : 'Create'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shifts.map((shift) => (
              <TableRow key={shift.id}>
                <TableCell className="font-medium">{shift.setting_value.name}</TableCell>
                <TableCell>{shift.setting_value.label}</TableCell>
                <TableCell>{shift.setting_value.start_time} - {shift.setting_value.end_time}</TableCell>
                <TableCell>{shift.setting_value.display_order}</TableCell>
                <TableCell>
                  <Switch checked={shift.setting_value.is_active} disabled />
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(shift)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(shift.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}