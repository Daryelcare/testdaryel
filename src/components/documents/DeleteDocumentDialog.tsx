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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";

interface Document {
  id: string;
  employee_id: string;
  document_type_id: string;
  branch_id: string;
  document_number?: string;
  issue_date?: string;
  expiry_date: string;
  status: string;
  notes?: string;
  country?: string;
  nationality_status?: string;
  employees?: {
    name: string;
    email: string;
    branches?: {
      id: string;
      name: string;
    };
  };
  document_types?: {
    name: string;
  };
}

interface DeleteDocumentDialogProps {
  open: boolean;
  onClose: () => void;
  onOpenChange?: (open: boolean) => void;
  selectedDocument: Document | null;
  documents: Document[];
  onConfirm: (documents: Document[]) => void;
}

export function DeleteDocumentDialog({
  open,
  onClose,
  onOpenChange,
  selectedDocument,
  documents,
  onConfirm,
}: DeleteDocumentDialogProps) {
  const [selectedDocuments, setSelectedDocuments] = useState<Document[]>([]);

  const showSelection = documents.length > 0 && !selectedDocument;

  const handleSelectDocument = (document: Document, checked: boolean) => {
    if (checked) {
      setSelectedDocuments(prev => [...prev, document]);
    } else {
      setSelectedDocuments(prev => prev.filter(doc => doc.id !== document.id));
    }
  };

  const handleConfirm = () => {
    if (selectedDocument) {
      onConfirm([selectedDocument]);
    } else if (selectedDocuments.length > 0) {
      onConfirm(selectedDocuments);
    }
  };

  const handleRowClick = (document: Document) => {
    const isSelected = selectedDocuments.some(doc => doc.id === document.id);
    handleSelectDocument(document, !isSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDocuments([...documents]);
    } else {
      setSelectedDocuments([]);
    }
  };

  const isAllSelected = selectedDocuments.length === documents.length && documents.length > 0;
  const isSomeSelected = selectedDocuments.length > 0 && selectedDocuments.length < documents.length;

  const getStatusBadge = (document: Document) => {
    let badgeVariant: "default" | "destructive" | "secondary" | "outline" = "default";
    let badgeText = "Valid";

    const expiryDate = new Date(document.expiry_date);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 3600 * 24));

    if (daysUntilExpiry < 0) {
      badgeVariant = "destructive";
      badgeText = "Expired";
    } else if (daysUntilExpiry <= 30) {
      badgeVariant = "secondary";
      badgeText = "Expiring Soon";
    }

    return <Badge variant={badgeVariant}>{badgeText}</Badge>;
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange || onClose}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {selectedDocument ? "Delete Document" : "Delete Documents"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {selectedDocument ? (
              "Are you sure you want to delete this document? This action cannot be undone."
            ) : showSelection ? (
              <>
                <span>Select which documents you want to delete. This action cannot be undone.</span>
                <div className="mt-4 space-y-3">
                   <div className="flex items-center space-x-2">
                     <Checkbox
                       id="select-all"
                       checked={isAllSelected}
                       onCheckedChange={handleSelectAll}
                     />
                    <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                      Select All
                    </label>
                  </div>
                  
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {documents.map((document) => (
                      <div
                        key={document.id}
                        className="flex items-center space-x-2 p-3 border rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleRowClick(document)}
                      >
                        <Checkbox
                          id={document.id}
                          checked={selectedDocuments.some(doc => doc.id === document.id)}
                          onCheckedChange={(checked) => handleSelectDocument(document, checked as boolean)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1 flex justify-between items-center">
                          <div className="flex flex-col items-start gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{document.document_types?.name}</span>
                              {getStatusBadge(document)}
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {document.document_number && `${document.document_number} • `}
                              Expires: {new Date(document.expiry_date).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              "Are you sure you want to delete the selected documents? This action cannot be undone."
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        {selectedDocument && (
          <div className="my-4 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{selectedDocument.document_types?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedDocument.document_number && `${selectedDocument.document_number} • `}
                  Expires: {new Date(selectedDocument.expiry_date).toLocaleDateString()}
                </p>
              </div>
              {getStatusBadge(selectedDocument)}
            </div>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!selectedDocument && selectedDocuments.length === 0}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete {selectedDocument ? "Document" : `${selectedDocuments.length} Document${selectedDocuments.length !== 1 ? 's' : ''}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
