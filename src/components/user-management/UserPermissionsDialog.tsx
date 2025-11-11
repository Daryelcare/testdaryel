import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Key, Save, Shield, Users } from "lucide-react";
import { generateLimitedPermissions, generateFullPermissions, ALL_PAGE_MODULES } from "@/utils/limitedRoleTemplate";

interface UserWithRole {
  id: string;
  email: string;
  role: string;
}

interface UserPermissionsDialogProps {
  user: UserWithRole;
  onSuccess: () => void;
}

interface Permission {
  type: string;
  key: string;
  label: string;
  granted: boolean;
}

interface BranchAccess {
  id: string;
  name: string;
  hasAccess: boolean;
}

export function UserPermissionsDialog({ user, onSuccess }: UserPermissionsDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [branchAccess, setBranchAccess] = useState<BranchAccess[]>([]);
  const { toast } = useToast();

  const pageModules = ALL_PAGE_MODULES;

  const generateDefaultPermissions = () => {
    const permissions: Permission[] = [];
    
    // Add page access permissions
    pageModules.forEach(module => {
      permissions.push({
        type: 'page_access',
        key: module.path,
        label: `${module.name} - Page Access`,
        granted: true
      });
    });
    
    // Add page action permissions
    pageModules.forEach(module => {
      module.actions.forEach(action => {
        permissions.push({
          type: 'page_action',
          key: `${module.key}:${action}`,
          label: `${module.name} - ${action.charAt(0).toUpperCase() + action.slice(1)}`,
          granted: true
        });
      });
    });
    
    return permissions;
  };

  const defaultPermissions = generateDefaultPermissions();

  useEffect(() => {
    if (open) {
      fetchUserPermissions();
      fetchBranches();
    }
  }, [open]);

  const fetchUserPermissions = async () => {
    try {
      const { data: userPermissions, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      const permissionsMap = new Map(
        (userPermissions || []).map(p => [`${p.permission_type}:${p.permission_key}`, p.granted])
      );

      const permissionsWithState = defaultPermissions.map(perm => ({
        ...perm,
        granted: permissionsMap.get(`${perm.type}:${perm.key}`) ?? true
      }));

      setPermissions(permissionsWithState);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      toast({
        title: "Error loading permissions",
        description: "Could not fetch user permissions. Please try again.",
        variant: "destructive",
      });
      // Use default permissions if there's an error
      setPermissions(defaultPermissions.map(perm => ({ ...perm, granted: true })));
    }
  };

  const fetchBranches = async () => {
    try {
      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('*')
        .order('name');

      if (branchesError) throw branchesError;

      const { data: userBranchAccess, error: accessError } = await supabase
        .from('user_branch_access')
        .select('branch_id')
        .eq('user_id', user.id);

      if (accessError) throw accessError;

      const accessibleBranchIds = new Set(
        (userBranchAccess || []).map(access => access.branch_id)
      );

      const branchesWithAccess = (branchesData || []).map(branch => ({
        id: branch.id,
        name: branch.name,
        hasAccess: accessibleBranchIds.has(branch.id)
      }));

      setBranchAccess(branchesWithAccess);
    } catch (error) {
      console.error('Error fetching branches:', error);
      toast({
        title: "Error loading branches",
        description: "Could not fetch branch data. Please try again.",
        variant: "destructive",
      });
      setBranchAccess([]);
    }
  };

  const handlePermissionChange = (index: number, granted: boolean) => {
    setPermissions(prev => prev.map((perm, i) => 
      i === index ? { ...perm, granted } : perm
    ));
  };

  const handleBranchAccessChange = (branchId: string, hasAccess: boolean) => {
    setBranchAccess(prev => prev.map(branch =>
      branch.id === branchId ? { ...branch, hasAccess } : branch
    ));
  };

  const applyLimitedTemplate = () => {
    const limitedPerms = generateLimitedPermissions();
    setPermissions(prev => prev.map(perm => {
      const match = limitedPerms.find(
        lp => lp.permission_type === perm.type && lp.permission_key === perm.key
      );
      return match ? { ...perm, granted: match.granted } : perm;
    }));
    toast({
      title: "Limited template applied",
      description: "5 sensitive pages have been restricted",
    });
  };

  const applyFullTemplate = () => {
    setPermissions(prev => prev.map(perm => ({ ...perm, granted: true })));
    toast({
      title: "Full access template applied",
      description: "All pages and actions have been enabled",
    });
  };

  const savePermissions = async () => {
    setLoading(true);
    try {
      // Batch save all permissions in a single call
      const permissionsToUpsert = permissions.map(p => ({
        user_id: user.id,
        permission_type: p.type,
        permission_key: p.key,
        granted: p.granted,
        updated_at: new Date().toISOString()
      }));

      const { error: permError } = await supabase
        .from('user_permissions')
        .upsert(permissionsToUpsert, {
          onConflict: 'user_id,permission_type,permission_key'
        });

      if (permError) throw permError;

      // Save branch access permissions
      // First, remove all existing branch access for this user
      const { error: deleteError } = await supabase
        .from('user_branch_access')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      // Then, insert new branch access records for branches with access
      const branchesToInsert = branchAccess
        .filter(branch => branch.hasAccess)
        .map(branch => ({
          user_id: user.id,
          branch_id: branch.id
        }));

      if (branchesToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('user_branch_access')
          .insert(branchesToInsert);

        if (insertError) throw insertError;
      }

      toast({
        title: "Permissions updated",
        description: "User permissions have been saved successfully",
      });

      setOpen(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error saving permissions:', error);
      toast({
        title: "Error updating permissions",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full hover:bg-primary/10 transition-colors">
          <Key className="w-4 h-4 mr-2" />
          Manage Permissions
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="space-y-3 pb-6 border-b">
          <DialogTitle className="text-2xl font-bold">
            Permissions Manager
          </DialogTitle>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{user.email}</p>
              <p className="text-xs text-muted-foreground">Configure access levels and permissions</p>
            </div>
          </div>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Quick Templates Section */}
          {user.role !== 'admin' && (
            <div className="mb-6 p-4 bg-muted/30 rounded-lg border">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Quick Templates
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={applyLimitedTemplate}
                  className="flex flex-col items-start h-auto py-3 hover:bg-primary/5 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="w-4 h-4 text-orange-600" />
                    <span className="font-semibold">Limited Access</span>
                  </div>
                  <span className="text-xs text-muted-foreground text-left">
                    Restricts 5 sensitive pages
                  </span>
                </Button>
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={applyFullTemplate}
                  className="flex flex-col items-start h-auto py-3 hover:bg-primary/5 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-green-600" />
                    <span className="font-semibold">Full Access</span>
                  </div>
                  <span className="text-xs text-muted-foreground text-left">
                    Enables all pages & actions
                  </span>
                </Button>
              </div>
            </div>
          )}

          {/* Page Access Permissions */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Key className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Page Access</h3>
                <p className="text-sm text-muted-foreground">
                  Control which pages the user can view
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-muted/30 rounded-lg border"
            >
              {pageModules.map((module) => {
                const pageAccessPermission = permissions.find(p => 
                  p.type === 'page_access' && p.key === module.path
                );
                const permIndex = permissions.findIndex(p => 
                  p.type === 'page_access' && p.key === module.path
                );
                
                if (!pageAccessPermission) return null;
                
                return (
                  <div key={`page-${module.key}`} className="flex items-center space-x-2 p-2 rounded-md hover:bg-background transition-colors">
                    <Checkbox
                      id={`page-access-${module.key}`}
                      checked={pageAccessPermission.granted}
                      onCheckedChange={(checked) => handlePermissionChange(permIndex, !!checked)}
                    />
                    <Label 
                      htmlFor={`page-access-${module.key}`}
                      className="text-sm cursor-pointer font-medium flex-1"
                    >
                      {module.name}
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Page Action Permissions */}
          <div className="space-y-4">
            {pageModules.map((module) => {
              const pageAccessPermission = permissions.find(p => 
                p.type === 'page_access' && p.key === module.path
              );
              const hasPageAccess = pageAccessPermission?.granted ?? true;
              
              return (
                <div key={module.key} className={`space-y-3 ${!hasPageAccess ? "opacity-50" : ""}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                      <Key className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold">{module.name}</h4>
                      <p className="text-xs text-muted-foreground">{module.path}</p>
                      {!hasPageAccess && (
                        <p className="text-xs text-warning mt-1 flex items-center gap-1">
                          <span>⚠️</span> Page access required
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pl-13 p-3 bg-muted/20 rounded-lg border"
                  >
                    {module.actions.map((action) => {
                      const permKey = `${module.key}:${action}`;
                      const permission = permissions.find(p => p.key === permKey && p.type === 'page_action');
                      const permIndex = permissions.findIndex(p => p.key === permKey && p.type === 'page_action');
                      
                      if (!permission) return null;
                      
                      return (
                        <div key={action} className="flex items-center space-x-2 p-2 rounded-md hover:bg-background transition-colors">
                          <Checkbox
                            id={`${module.key}-${action}`}
                            checked={permission.granted}
                            disabled={!hasPageAccess}
                            onCheckedChange={(checked) => handlePermissionChange(permIndex, !!checked)}
                          />
                          <Label 
                            htmlFor={`${module.key}-${action}`}
                            className="text-sm capitalize cursor-pointer flex-1"
                          >
                            {action.replace(/-/g, ' ')}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Branch Access */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Branch Access</h3>
                <p className="text-sm text-muted-foreground">
                  Select which branches the user can access
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4 bg-muted/30 rounded-lg border">
              {branchAccess.map((branch) => (
                <div key={branch.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-background transition-colors">
                  <Checkbox
                    id={`branch-${branch.id}`}
                    checked={branch.hasAccess}
                    onCheckedChange={(checked) => handleBranchAccessChange(branch.id, !!checked)}
                  />
                  <Label htmlFor={`branch-${branch.id}`} className="cursor-pointer flex-1">{branch.name}</Label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={savePermissions} 
              disabled={loading}
              className="bg-gradient-to-r from-primary to-purple-600 hover:opacity-90"
            >
              <Save className="w-4 h-4 mr-2" />
              {loading ? "Saving..." : "Save Permissions"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}