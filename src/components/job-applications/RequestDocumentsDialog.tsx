import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { FileUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface RequestDocumentsDialogProps {
  application: any;
  onSuccess?: () => void;
}

const AVAILABLE_DOCUMENTS = [
  'Passport',
  'National ID Card',
  'Driving License',
  'Proof of Address',
  'Birth Certificate',
  'Right to Work Document',
  'DBS Certificate',
  'Qualification Certificate',
  'Professional References',
  'Proof of Previous Employment'
];

export function RequestDocumentsDialog({ application, onSuccess }: RequestDocumentsDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleToggleDocument = (doc: string) => {
    setSelectedDocs(prev =>
      prev.includes(doc)
        ? prev.filter(d => d !== doc)
        : [...prev, doc]
    );
  };

  const handleSubmit = async () => {
    if (selectedDocs.length === 0) {
      toast({
        title: 'No Documents Selected',
        description: 'Please select at least one document type.',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.functions.invoke('send-document-upload-link', {
        body: {
          applicationId: application.id,
          applicantEmail: application.personal_info.email,
          applicantName: application.personal_info.fullName,
          requiredDocuments: selectedDocs
        }
      });

      if (error) throw error;

      toast({
        title: 'Documents Requested',
        description: `Upload link sent to ${application.personal_info.email}`
      });

      setOpen(false);
      setSelectedDocs([]);
      onSuccess?.();
    } catch (error) {
      console.error('Error requesting documents:', error);
      toast({
        title: 'Error',
        description: 'Failed to send document request. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileUp className="h-4 w-4" />
          Request Documents
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request Documents</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select the documents you need from {application.personal_info.fullName}:
          </p>
          
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {AVAILABLE_DOCUMENTS.map(doc => (
              <div key={doc} className="flex items-center space-x-2">
                <Checkbox
                  id={doc}
                  checked={selectedDocs.includes(doc)}
                  onCheckedChange={() => handleToggleDocument(doc)}
                />
                <Label
                  htmlFor={doc}
                  className="text-sm font-normal cursor-pointer"
                >
                  {doc}
                </Label>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || selectedDocs.length === 0}
              className="flex-1"
            >
              {loading ? 'Sending...' : 'Send Request'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
