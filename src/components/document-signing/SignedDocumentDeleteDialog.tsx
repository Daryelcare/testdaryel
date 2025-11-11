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
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SignedDocument {
  id: string;
  final_document_path: string;
  completed_at: string;
  signing_requests: {
    title: string;
    document_templates: {
      name: string;
    };
    signing_request_recipients: Array<{
      recipient_name: string;
      recipient_email: string;
    }>;
  };
}

interface SignedDocumentDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: SignedDocument | null;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export function SignedDocumentDeleteDialog({
  open,
  onOpenChange,
  document,
  onConfirm,
  isDeleting = false,
}: SignedDocumentDeleteDialogProps) {
  if (!document) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle>Delete Signed Document</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-3">
            Are you sure you want to delete <span className="font-semibold text-foreground">"{document.signing_requests.title}"</span>?
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 py-4">
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <div className="font-medium">{document.signing_requests.title}</div>
            <div className="text-sm text-muted-foreground">
              Template: {document.signing_requests.document_templates.name}
            </div>
            <div className="text-sm text-muted-foreground">
              Completed: {new Date(document.completed_at).toLocaleDateString()}
            </div>
            {document.signing_requests.signing_request_recipients.length > 0 && (
              <div className="pt-2">
                <div className="text-sm font-medium mb-1">Signers:</div>
                <div className="flex flex-wrap gap-1">
                  {document.signing_requests.signing_request_recipients.map((recipient, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {recipient.recipient_name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3">
            <p className="text-sm text-destructive font-medium">
              This will permanently delete both the database record and the signed PDF file. This action cannot be undone.
            </p>
          </div>
        </div>

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
            {isDeleting ? "Deleting..." : "Delete Document"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
