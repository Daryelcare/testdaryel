import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, FileText, Edit, Trash2, Eye } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FieldDesigner } from "./FieldDesigner";

interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  file_path: string;
  file_type: string;
  created_at: string;
}

export function TemplateManager() {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadData, setUploadData] = useState({
    name: "",
    description: "",
    file: null as File | null
  });
  const [fieldDesignerOpen, setFieldDesignerOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [selectedTemplateUrl, setSelectedTemplateUrl] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ["document-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_templates")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as DocumentTemplate[];
    }
  });

  // Upload template mutation
  const uploadTemplateMutation = useMutation({
    mutationFn: async (templateData: { name: string; description: string; file: File }) => {
      // Upload file to storage
      const fileExt = templateData.file.name.split('.').pop();
      const fileName = `${Date.now()}_${templateData.name.replace(/\s+/g, '_')}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("company-assets")
        .upload(`document-templates/${fileName}`, templateData.file);

      if (uploadError) throw uploadError;

      // Create template record
      const { data, error } = await supabase
        .from("document_templates")
        .insert({
          name: templateData.name,
          description: templateData.description,
          file_path: uploadData.path,
          file_type: templateData.file.type
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      setIsUploadOpen(false);
      setUploadData({ name: "", description: "", file: null });
      toast.success("Template uploaded successfully");
    },
    onError: (error) => {
      toast.error("Failed to upload template: " + error.message);
    }
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (template: DocumentTemplate) => {
      // Delete from storage
      await supabase.storage
        .from("company-assets")
        .remove([template.file_path]);

      // Delete from database
      const { error } = await supabase
        .from("document_templates")
        .delete()
        .eq("id", template.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      toast.success("Template deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete template: " + error.message);
    }
  });

  const handleUpload = () => {
    if (!uploadData.name || !uploadData.file) {
      toast.error("Please provide a name and select a file");
      return;
    }
    uploadTemplateMutation.mutate(uploadData);
  };

  const getFileUrl = (filePath: string) => {
    const { data } = supabase.storage
      .from("company-assets")
      .getPublicUrl(filePath);
    return data.publicUrl;
  };

  const getSignedFileUrl = async (filePath: string) => {
    const { data, error } = await supabase.storage
      .from("company-assets")
      .createSignedUrl(filePath, 60 * 60);
    if (error || !data?.signedUrl) {
      return getFileUrl(filePath);
    }
    return data.signedUrl;
  };

  if (isLoading) {
    return <div className="text-center p-8">Loading templates...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Document Templates</h2>
          <p className="text-muted-foreground">
            Upload and manage PDF/Word templates for signing
          </p>
        </div>
        
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Upload Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Document Template</DialogTitle>
              <DialogDescription>
                Upload a PDF or Word document to use as a signing template
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  value={uploadData.name}
                  onChange={(e) => setUploadData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter template name"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={uploadData.description}
                  onChange={(e) => setUploadData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description"
                />
              </div>
              <div>
                <Label htmlFor="file">Document File</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setUploadData(prev => ({ ...prev, file: e.target.files?.[0] || null }))}
                />
              </div>
              <Button 
                onClick={handleUpload} 
                disabled={uploadTemplateMutation.isPending}
                className="w-full"
              >
                {uploadTemplateMutation.isPending ? "Uploading..." : "Upload Template"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {templates && templates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <Card key={template.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  {template.name}
                </CardTitle>
                <CardDescription>
                  {template.description || "No description"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    Type: {template.file_type}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Created: {new Date(template.created_at).toLocaleDateString()}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const url = await getSignedFileUrl(template.file_path);
                        window.open(url, '_blank');
                      }}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const url = await getSignedFileUrl(template.file_path);
                        setSelectedTemplate(template);
                        setSelectedTemplateUrl(url);
                        setFieldDesignerOpen(true);
                      }}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Fields
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this template?")) {
                          deleteTemplateMutation.mutate(template);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center p-12">
            <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Templates Yet</h3>
            <p className="text-muted-foreground mb-4">
              Upload your first document template to get started with digital signatures
            </p>
          </CardContent>
        </Card>
      )}

      {/* Field Designer Dialog */}
      {selectedTemplate && (
        <FieldDesigner
          isOpen={fieldDesignerOpen}
          onClose={() => {
            setFieldDesignerOpen(false);
            setSelectedTemplate(null);
          }}
          templateId={selectedTemplate.id}
          templateUrl={selectedTemplateUrl ?? getFileUrl(selectedTemplate.file_path)}
        />
      )}
    </div>
  );
}