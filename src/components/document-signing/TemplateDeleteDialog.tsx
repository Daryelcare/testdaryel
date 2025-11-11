import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";

interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  file_path: string;
  file_type: string;
  created_at: string;
}

interface TemplateDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: DocumentTemplate | null;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export function TemplateDeleteDialog({
  open,
  onOpenChange,
  template,
  onConfirm,
  isDeleting = false,
}: TemplateDeleteDialogProps) {
  if (!template) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <AlertDialogTitle>Delete Template</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this template?
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="font-semibold text-foreground">{template.name}</div>
              <div className="text-sm text-muted-foreground">
                Type: {template.file_type}
              </div>
              <div className="text-sm text-muted-foreground">
                Created: {new Date(template.created_at).toLocaleDateString()}
              </div>
            </div>
          </CardContent>
        </Card>

        <AlertDialogDescription className="text-destructive font-medium">
          This action cannot be undone. The template and all associated data will be permanently deleted.
        </AlertDialogDescription>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Deleting..." : "Delete Template"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
