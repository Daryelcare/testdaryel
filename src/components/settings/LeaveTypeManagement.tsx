
import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface LeaveType {
  id: string;
  name: string;
  reduces_balance: boolean;
  reduces_allowance: boolean;
}

interface LeaveTypeFormData {
  name: string;
  reduces_balance: boolean;
  reduces_allowance: boolean;
}

export function LeaveTypeManagement() {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingType, setEditingType] = useState<LeaveType | null>(null);
  const [deletingType, setDeletingType] = useState<LeaveType | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formData, setFormData] = useState<LeaveTypeFormData>({
    name: "",
    reduces_balance: true,
    reduces_allowance: true,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

  const fetchLeaveTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_types')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching leave types:', error);
        return;
      }

      setLeaveTypes(data || []);
    } catch (error) {
      console.error('Error fetching leave types:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    try {
      const { error } = await supabase
        .from('leave_types')
        .insert([formData]);

      if (error) {
        console.error('Error creating leave type:', error);
        toast({
          title: "Error",
          description: "Failed to create leave type",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Leave type created successfully",
      });

      setShowAddDialog(false);
      setFormData({ name: "", reduces_balance: true, reduces_allowance: true });
      fetchLeaveTypes();
    } catch (error) {
      console.error('Error creating leave type:', error);
      toast({
        title: "Error",
        description: "Failed to create leave type",
        variant: "destructive",
      });
    }
  };

  const handleEdit = async () => {
    if (!editingType) return;

    try {
      const { error } = await supabase
        .from('leave_types')
        .update({
          name: formData.name,
          reduces_balance: formData.reduces_balance,
          reduces_allowance: formData.reduces_allowance,
        })
        .eq('id', editingType.id);

      if (error) {
        console.error('Error updating leave type:', error);
        toast({
          title: "Error",
          description: "Failed to update leave type",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Leave type updated successfully",
      });

      setEditingType(null);
      setFormData({ name: "", reduces_balance: true, reduces_allowance: true });
      fetchLeaveTypes();
    } catch (error) {
      console.error('Error updating leave type:', error);
      toast({
        title: "Error",
        description: "Failed to update leave type",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deletingType) return;

    try {
      const { error } = await supabase
        .from('leave_types')
        .delete()
        .eq('id', deletingType.id);

      if (error) {
        console.error('Error deleting leave type:', error);
        toast({
          title: "Error",
          description: "Failed to delete leave type",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Leave type deleted successfully",
      });

      setDeletingType(null);
      fetchLeaveTypes();
    } catch (error) {
      console.error('Error deleting leave type:', error);
      toast({
        title: "Error",
        description: "Failed to delete leave type",
        variant: "destructive",
      });
    }
  };

  const startEdit = (leaveType: LeaveType) => {
    setEditingType(leaveType);
    setFormData({
      name: leaveType.name,
      reduces_balance: leaveType.reduces_balance,
      reduces_allowance: leaveType.reduces_allowance,
    });
  };

  const cancelEdit = () => {
    setEditingType(null);
    setFormData({ name: "", reduces_balance: true, reduces_allowance: true });
  };

  const startAdd = () => {
    setShowAddDialog(true);
    setFormData({ name: "", reduces_balance: true, reduces_allowance: true });
  };

  if (loading) {
    return <div>Loading leave types...</div>;
  }

  return (
    <Card className="card-premium animate-fade-in">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Leave Types Management</CardTitle>
          <Button onClick={startAdd} className="bg-gradient-primary hover:opacity-90">
            <Plus className="w-4 h-4 mr-2" />
            Add Leave Type
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {leaveTypes.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No leave types configured</p>
          </div>
        ) : (
          <div className="space-y-3">
            {leaveTypes.map((leaveType) => (
              <div key={leaveType.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-primary"></div>
                    <span className="font-medium">{leaveType.name}</span>
                  </div>
                  <div className="flex gap-2">
                    {leaveType.reduces_balance && (
                      <Badge variant="outline" className="text-xs">
                        Reduces Balance
                      </Badge>
                    )}
                    {leaveType.reduces_allowance && (
                      <Badge variant="outline" className="text-xs">
                        Reduces Allowance
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => startEdit(leaveType)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => setDeletingType(leaveType)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Leave Type</DialogTitle>
              <DialogDescription>
                Create a new leave type with custom settings
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Leave Type Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Annual Leave, Sick Leave"
                />
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Reduces Leave Balance</Label>
                    <p className="text-sm text-muted-foreground">
                      Deduct days from employee's remaining leave balance
                    </p>
                  </div>
                  <Switch 
                    checked={formData.reduces_balance}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, reduces_balance: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Reduces Leave Allowance</Label>
                    <p className="text-sm text-muted-foreground">
                      Count towards annual leave allowance
                    </p>
                  </div>
                  <Switch 
                    checked={formData.reduces_allowance}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, reduces_allowance: checked }))}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={!formData.name.trim()}>
                Create Leave Type
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={!!editingType} onOpenChange={() => cancelEdit()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Leave Type</DialogTitle>
              <DialogDescription>
                Update leave type settings
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Leave Type Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Annual Leave, Sick Leave"
                />
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Reduces Leave Balance</Label>
                    <p className="text-sm text-muted-foreground">
                      Deduct days from employee's remaining leave balance
                    </p>
                  </div>
                  <Switch 
                    checked={formData.reduces_balance}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, reduces_balance: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Reduces Leave Allowance</Label>
                    <p className="text-sm text-muted-foreground">
                      Count towards annual leave allowance
                    </p>
                  </div>
                  <Switch 
                    checked={formData.reduces_allowance}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, reduces_allowance: checked }))}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={cancelEdit}>
                Cancel
              </Button>
              <Button onClick={handleEdit} disabled={!formData.name.trim()}>
                Update Leave Type
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deletingType} onOpenChange={() => setDeletingType(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Leave Type</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{deletingType?.name}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeletingType(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
