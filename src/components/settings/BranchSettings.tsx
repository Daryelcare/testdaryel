
import { useState, useEffect } from "react";
import { Building2, Save, Plus, Edit, Trash2, Users, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Branch {
  id: string;
  name: string;
  created_at: string;
  employee_count?: number;
  document_count?: number;
}

export function BranchSettings() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [newBranchName, setNewBranchName] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      setLoading(true);
      console.log('Fetching branches...');
      
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching branches:', error);
        toast({
          title: "Error",
          description: "Failed to fetch branches: " + error.message,
          variant: "destructive",
        });
        return;
      }

      console.log('Fetched branches:', data);
      
      // Fetch employee and document counts for each branch
      const branchesWithCounts = await Promise.all(
        (data || []).map(async (branch) => {
          const [employeeResult, documentResult] = await Promise.all([
            supabase
              .from('employees')
              .select('*', { count: 'exact', head: true })
              .eq('branch_id', branch.id),
            supabase
              .from('document_tracker')
              .select('*', { count: 'exact', head: true })
              .eq('branch_id', branch.id)
          ]);
          
          return {
            ...branch,
            employee_count: employeeResult.count || 0,
            document_count: documentResult.count || 0
          };
        })
      );
      
      setBranches(branchesWithCounts);
    } catch (error) {
      console.error('Unexpected error fetching branches:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while fetching branches",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddBranch = async () => {
    if (!newBranchName.trim()) {
      toast({
        title: "Validation Error",
        description: "Branch name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      console.log('Adding new branch:', newBranchName);

      const { data, error } = await supabase
        .from('branches')
        .insert([{ name: newBranchName.trim() }])
        .select()
        .single();

      if (error) {
        console.error('Error adding branch:', error);
        toast({
          title: "Error",
          description: "Failed to add branch: " + error.message,
          variant: "destructive",
        });
        return;
      }

      console.log('Branch added successfully:', data);
      setBranches([{ ...data, employee_count: 0 }, ...branches]);
      setNewBranchName("");
      setIsAddDialogOpen(false);
      toast({
        title: "Success",
        description: "Branch added successfully",
      });
    } catch (error) {
      console.error('Unexpected error adding branch:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while adding the branch",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEditBranch = async () => {
    if (!editingBranch || !editingBranch.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Branch name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      console.log('Updating branch:', editingBranch);

      const { error } = await supabase
        .from('branches')
        .update({ name: editingBranch.name.trim() })
        .eq('id', editingBranch.id);

      if (error) {
        console.error('Error updating branch:', error);
        toast({
          title: "Error",
          description: "Failed to update branch: " + error.message,
          variant: "destructive",
        });
        return;
      }

      console.log('Branch updated successfully');
      setBranches(branches.map(branch => 
        branch.id === editingBranch.id ? editingBranch : branch
      ));
      setEditingBranch(null);
      setIsEditDialogOpen(false);
      toast({
        title: "Success",
        description: "Branch updated successfully",
      });
    } catch (error) {
      console.error('Unexpected error updating branch:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while updating the branch",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBranch = (branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    if (branch) {
      setBranchToDelete(branch);
      setIsDeleteDialogOpen(true);
    }
  };

  const confirmDeleteBranch = async () => {
    if (!branchToDelete) return;

    try {
      setSaving(true);
      console.log('Deleting branch:', branchToDelete.id);

      const { error } = await supabase
        .from('branches')
        .delete()
        .eq('id', branchToDelete.id);

      if (error) {
        console.error('Error deleting branch:', error);
        toast({
          title: "Error",
          description: "Failed to delete branch: " + error.message,
          variant: "destructive",
        });
        return;
      }

      console.log('Branch deleted successfully');
      setBranches(branches.filter(branch => branch.id !== branchToDelete.id));
      
      const deletedItems = [];
      if (branchToDelete.employee_count && branchToDelete.employee_count > 0) {
        deletedItems.push(`${branchToDelete.employee_count} employee(s)`);
      }
      if (branchToDelete.document_count && branchToDelete.document_count > 0) {
        deletedItems.push(`${branchToDelete.document_count} document(s)`);
      }
      
      toast({
        title: "Success",
        description: deletedItems.length > 0 
          ? `Branch and ${deletedItems.join(', ')} deleted successfully`
          : "Branch deleted successfully",
      });
      
      setIsDeleteDialogOpen(false);
      setBranchToDelete(null);
      
      // Refresh the branches to update employee counts
      fetchBranches();
    } catch (error) {
      console.error('Unexpected error deleting branch:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while deleting the branch",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="card-premium animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-primary" />
            Branch Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading branches...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="card-premium animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-primary" />
            Branch Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Active Branches ({branches.length})</h4>
              <Button 
                onClick={() => setIsAddDialogOpen(true)} 
                className="bg-gradient-primary hover:opacity-90"
                disabled={saving}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Branch
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {branches.length > 0 ? (
                branches.map((branch) => (
                  <div key={branch.id} className="p-4 border rounded-lg space-y-2 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <h5 className="font-medium text-lg">{branch.name}</h5>
                      <span className="text-sm text-muted-foreground bg-green-100 text-green-800 px-2 py-1 rounded-full">
                        Active
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span>{branch.employee_count || 0} employees</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>📄</span>
                        <span>{branch.document_count || 0} documents</span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Created: {new Date(branch.created_at).toLocaleDateString()}
                    </p>
                    <div className="flex items-center gap-2 pt-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setEditingBranch(branch);
                          setIsEditDialogOpen(true);
                        }}
                        disabled={saving}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDeleteBranch(branch.id)}
                        disabled={saving}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-2 text-center py-12">
                  <Building2 className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No branches found</h3>
                  <p className="text-muted-foreground mb-4">
                    Get started by adding your first branch location.
                  </p>
                  <Button 
                    onClick={() => setIsAddDialogOpen(true)}
                    className="bg-gradient-primary hover:opacity-90"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Branch
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Branch Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Branch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="branch-name">Branch Name *</Label>
              <Input
                id="branch-name"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="Enter branch name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !saving && newBranchName.trim()) {
                    handleAddBranch();
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsAddDialogOpen(false);
                  setNewBranchName("");
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleAddBranch} 
                disabled={!newBranchName.trim() || saving}
              >
                {saving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>}
                Add Branch
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Branch Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Branch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-branch-name">Branch Name *</Label>
              <Input
                id="edit-branch-name"
                value={editingBranch?.name || ""}
                onChange={(e) => setEditingBranch(prev => prev ? { ...prev, name: e.target.value } : null)}
                placeholder="Enter branch name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !saving && editingBranch?.name.trim()) {
                    handleEditBranch();
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditingBranch(null);
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleEditBranch} 
                disabled={!editingBranch?.name.trim() || saving}
              >
                {saving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>}
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Branch Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete Branch
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              {(branchToDelete?.employee_count && branchToDelete.employee_count > 0) || 
               (branchToDelete?.document_count && branchToDelete.document_count > 0) ? (
                <>
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="font-semibold text-destructive">⚠️ Critical Warning</p>
                    <div className="text-sm mt-1 space-y-1">
                      {branchToDelete?.employee_count && branchToDelete.employee_count > 0 && (
                        <p>This branch has <strong>{branchToDelete.employee_count} employee(s)</strong> assigned to it.</p>
                      )}
                      {branchToDelete?.document_count && branchToDelete.document_count > 0 && (
                        <p>This branch has <strong>{branchToDelete.document_count} document(s)</strong> linked to it.</p>
                      )}
                    </div>
                  </div>
                  <p>
                    Deleting "<strong>{branchToDelete?.name}</strong>" will <strong>permanently delete</strong> all assigned employees, documents, and their data. 
                    This action cannot be undone.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Are you absolutely sure you want to continue?
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Are you sure you want to delete the branch "<strong>{branchToDelete?.name}</strong>"?
                  </p>
                  <p className="text-sm text-muted-foreground">
                    This action cannot be undone.
                  </p>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setBranchToDelete(null);
              }}
              disabled={saving}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteBranch}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>}
              Delete Branch
              {((branchToDelete?.employee_count && branchToDelete.employee_count > 0) || 
                (branchToDelete?.document_count && branchToDelete.document_count > 0)) && 
                ` & All Data`
              }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
