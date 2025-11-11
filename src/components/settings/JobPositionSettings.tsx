import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Briefcase } from 'lucide-react';

interface JobPosition {
  id: string;
  title: string;
  description: string | null;
  department: string | null;
  location: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface PositionSettingValue {
  title?: string;
  description?: string;
  department?: string;
  location?: string;
  is_active?: boolean;
  display_order?: number;
}

interface JobPositionForm {
  title: string;
  description: string;
  department: string;
  location: string;
  is_active: boolean;
}

const initialFormData: JobPositionForm = {
  title: '',
  description: '',
  department: '',
  location: '',
  is_active: true,
};

export function JobPositionSettings() {
  const [positions, setPositions] = useState<JobPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<JobPositionForm>(initialFormData);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPositions();
  }, []);

  const fetchPositions = async () => {
    try {
      const { data, error } = await supabase
        .from('job_application_settings')
        .select('*')
        .eq('category', 'position')
        .order('display_order', { ascending: true });

      if (error) throw error;
      
      // Transform unified settings to position format
      const transformedPositions = (data || []).map(setting => {
        const value = setting.setting_value as PositionSettingValue;
        return {
          id: setting.id,
          title: value?.title || setting.setting_key,
          description: value?.description || null,
          department: value?.department || null,
          location: value?.location || null,
          is_active: setting.is_active,
          created_at: setting.created_at,
          updated_at: setting.updated_at
        };
      });
      
      setPositions(transformedPositions);
    } catch (error) {
      console.error('Error fetching positions:', error);
      toast({
        title: "Error",
        description: "Failed to load job positions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast({
        title: "Error",
        description: "Position title is required",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      // Get the current max display_order for new positions
      let displayOrder = 0;
      if (!editingId) {
        const { data: existingPositions } = await supabase
          .from('job_application_settings')
          .select('display_order')
          .eq('category', 'position')
          .order('display_order', { ascending: false })
          .limit(1);
        
        displayOrder = (existingPositions?.[0]?.display_order || 0) + 1;
      }

      const settingValue = {
        title: formData.title,
        description: formData.description || null,
        department: formData.department || null,
        location: formData.location || null,
        is_active: formData.is_active,
        display_order: displayOrder
      };

      if (editingId) {
        const { error } = await supabase
          .from('job_application_settings')
          .update({
            setting_key: `position_${formData.title}`,
            setting_value: settingValue,
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Job position updated successfully",
        });
      } else {
        const { error } = await supabase
          .from('job_application_settings')
          .insert([{
            category: 'position',
            setting_type: 'position',
            setting_key: `position_${formData.title}`,
            setting_value: settingValue,
            display_order: displayOrder,
            is_active: formData.is_active,
          }]);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Job position created successfully",
        });
      }

      setFormData(initialFormData);
      setEditingId(null);
      setIsDialogOpen(false);
      fetchPositions();
    } catch (error) {
      console.error('Error saving position:', error);
      toast({
        title: "Error",
        description: "Failed to save job position",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (position: JobPosition) => {
    setFormData({
      title: position.title,
      description: position.description || '',
      department: position.department || '',
      location: position.location || '',
      is_active: position.is_active,
    });
    setEditingId(position.id);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('job_application_settings')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Job position deleted successfully",
      });
      fetchPositions();
    } catch (error) {
      console.error('Error deleting position:', error);
      toast({
        title: "Error",
        description: "Failed to delete job position",
        variant: "destructive",
      });
    }
  };

  const openCreateDialog = () => {
    setFormData(initialFormData);
    setEditingId(null);
    setIsDialogOpen(true);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5" />
            Job Positions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="h-10 bg-muted rounded"></div>
            <div className="h-10 bg-muted rounded"></div>
            <div className="h-10 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="w-5 h-5" />
          Job Positions
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Manage job positions available for applications
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold">Available Positions</h3>
            <p className="text-sm text-muted-foreground">
              {positions.length} position{positions.length !== 1 ? 's' : ''} configured
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Add Position
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>
                  {editingId ? 'Edit Job Position' : 'Create Job Position'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="title">Position Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Care Assistant"
                  />
                </div>
                <div>
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={formData.department}
                    onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                    placeholder="e.g., Care Team"
                  />
                </div>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="e.g., London"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of the role..."
                    rows={3}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                  />
                  <Label htmlFor="is_active">Active (visible to applicants)</Label>
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {positions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No job positions</h3>
            <p className="mb-4">Create your first job position to get started.</p>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Position
            </Button>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Position</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map((position) => (
                  <TableRow key={position.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{position.title}</div>
                        {position.description && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {position.description.length > 50 
                              ? `${position.description.substring(0, 50)}...`
                              : position.description
                            }
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{position.department || '-'}</TableCell>
                    <TableCell>{position.location || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={position.is_active ? 'default' : 'secondary'}>
                        {position.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(position)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Job Position</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{position.title}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(position.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}