
import { useState, useEffect } from "react";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface DocumentType {
  id: string;
  name: string;
  created_at: string;
}

export function DocumentTypeManagement() {
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingDocumentType, setEditingDocumentType] = useState<DocumentType | null>(null);
  const [newDocumentTypeName, setNewDocumentTypeName] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentTypeToDelete, setDocumentTypeToDelete] = useState<DocumentType | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchDocumentTypes();
  }, []);

  const fetchDocumentTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('document_types')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching document types:', error);
        return;
      }

      setDocumentTypes(data || []);
    } catch (error) {
      console.error('Error fetching document types:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDocumentType = async () => {
    if (!newDocumentTypeName.trim()) return;

    try {
      const { data, error } = await supabase
        .from('document_types')
        .insert([{ name: newDocumentTypeName }])
        .select()
        .single();

      if (error) {
        console.error('Error adding document type:', error);
        toast({
          title: "Error",
          description: "Failed to add document type",
          variant: "destructive",
        });
        return;
      }

      setDocumentTypes([...documentTypes, data]);
      setNewDocumentTypeName("");
      setIsAddDialogOpen(false);
      toast({
        title: "Success",
        description: "Document type added successfully",
      });
    } catch (error) {
      console.error('Error adding document type:', error);
      toast({
        title: "Error",
        description: "Failed to add document type",
        variant: "destructive",
      });
    }
  };

  const handleEditDocumentType = async () => {
    if (!editingDocumentType || !editingDocumentType.name.trim()) return;

    try {
      const { error } = await supabase
        .from('document_types')
        .update({ name: editingDocumentType.name })
        .eq('id', editingDocumentType.id);

      if (error) {
        console.error('Error updating document type:', error);
        toast({
          title: "Error",
          description: "Failed to update document type",
          variant: "destructive",
        });
        return;
      }

      setDocumentTypes(documentTypes.map(type => 
        type.id === editingDocumentType.id ? editingDocumentType : type
      ));
      setEditingDocumentType(null);
      setIsEditDialogOpen(false);
      toast({
        title: "Success",
        description: "Document type updated successfully",
      });
    } catch (error) {
      console.error('Error updating document type:', error);
      toast({
        title: "Error",
        description: "Failed to update document type",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = (documentType: DocumentType) => {
    setDocumentTypeToDelete(documentType);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!documentTypeToDelete) return;

    try {
      const { error } = await supabase
        .from('document_types')
        .delete()
        .eq('id', documentTypeToDelete.id);

      if (error) {
        console.error('Error deleting document type:', error);
        toast({
          title: "Error",
          description: "Failed to delete document type",
          variant: "destructive",
        });
        return;
      }

      setDocumentTypes(documentTypes.filter(type => type.id !== documentTypeToDelete.id));
      toast({
        title: "Success",
        description: "Document type deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting document type:', error);
      toast({
        title: "Error",
        description: "Failed to delete document type",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setDocumentTypeToDelete(null);
    }
  };

  if (loading) {
    return <div>Loading document types...</div>;
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold">Document Types</h4>
          <Button onClick={() => setIsAddDialogOpen(true)} className="bg-gradient-primary hover:opacity-90">
            <Plus className="w-4 h-4 mr-2" />
            Add Document Type
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {documentTypes.length > 0 ? (
            documentTypes.map((documentType) => (
              <div key={documentType.id} className="p-4 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="font-medium">{documentType.name}</h5>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setEditingDocumentType(documentType);
                      setIsEditDialogOpen(true);
                    }}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleDeleteClick(documentType)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-2 text-center py-8 text-muted-foreground">
              No document types found. Add your first document type to get started.
            </div>
          )}
        </div>
      </div>

      {/* Add Document Type Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Document Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="document-type-name">Document Type Name</Label>
              <Input
                id="document-type-name"
                value={newDocumentTypeName}
                onChange={(e) => setNewDocumentTypeName(e.target.value)}
                placeholder="Enter document type name"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddDocumentType} disabled={!newDocumentTypeName.trim()}>
                Add Document Type
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Document Type Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Document Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-document-type-name">Document Type Name</Label>
              <Input
                id="edit-document-type-name"
                value={editingDocumentType?.name || ""}
                onChange={(e) => setEditingDocumentType(prev => prev ? { ...prev, name: e.target.value } : null)}
                placeholder="Enter document type name"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditDocumentType} disabled={!editingDocumentType?.name.trim()}>
                Save Changes
              </Button>
            </div>
          </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Document Type</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the document type "{documentTypeToDelete?.name}"? 
                This action cannot be undone and may affect existing documents using this type.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Document Type
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }
