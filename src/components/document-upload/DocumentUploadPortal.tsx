import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Camera, Upload, FileText, Trash2 } from 'lucide-react';
import { DocumentCaptureCamera } from './DocumentCaptureCamera';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface CapturedDocument {
  id: string;
  type: string;
  imageData: string;
  uploadedUrl?: string;
}

interface DocumentUploadPortalProps {
  token: string;
  applicantName: string;
  requiredDocuments: string[];
  onComplete: () => void;
}

const DOCUMENT_TYPES = [
  'Passport',
  'National ID Card',
  'Driving License',
  'Proof of Address',
  'Birth Certificate',
  'Right to Work Document',
  'DBS Certificate',
  'Qualification Certificate',
  'Other'
];

export function DocumentUploadPortal({
  token,
  applicantName,
  requiredDocuments,
  onComplete
}: DocumentUploadPortalProps) {
  const [mode, setMode] = useState<'select' | 'camera' | 'upload'>('select');
  const [selectedType, setSelectedType] = useState<string>('');
  const [documents, setDocuments] = useState<CapturedDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleCameraCapture = (imageData: string) => {
    if (!selectedType) return;

    const newDoc: CapturedDocument = {
      id: crypto.randomUUID(),
      type: selectedType,
      imageData
    };

    setDocuments(prev => [...prev, newDoc]);
    setMode('select');
    setSelectedType('');

    toast({
      title: 'Document Captured',
      description: `${selectedType} has been captured successfully.`
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedType) return;

    // Validate file
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File Too Large',
        description: 'Maximum file size is 10MB.',
        variant: 'destructive'
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target?.result as string;
      const newDoc: CapturedDocument = {
        id: crypto.randomUUID(),
        type: selectedType,
        imageData
      };

      setDocuments(prev => [...prev, newDoc]);
      setMode('select');
      setSelectedType('');

      toast({
        title: 'Document Added',
        description: `${selectedType} has been added successfully.`
      });
    };

    reader.readAsDataURL(file);
  };

  const handleDelete = (id: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id));
  };

  const handleSubmit = async () => {
    if (documents.length === 0) {
      toast({
        title: 'No Documents',
        description: 'Please capture or upload at least one document.',
        variant: 'destructive'
      });
      return;
    }

    setIsUploading(true);

    try {
      // Upload each document
      for (const doc of documents) {
        try {
          // Convert base64 to blob
          const response = await fetch(doc.imageData);
          if (!response.ok) {
            throw new Error(`Failed to process image: ${response.statusText}`);
          }
          
          const blob = await response.blob();
          
          if (blob.size === 0) {
            throw new Error('Image data is empty');
          }
          
          const fileName = `${Date.now()}_${doc.type.replace(/\s+/g, '_')}.jpg`;
          const filePath = `${token}/${doc.type}/${fileName}`;

          console.log('Uploading document:', { fileName, filePath, size: blob.size });

          // Upload to Supabase Storage
          const { error: uploadError, data } = await supabase.storage
            .from('applicant-documents')
            .upload(filePath, blob, {
              contentType: blob.type || 'image/jpeg',
              upsert: false
            });

          if (uploadError) {
            console.error('Storage upload error:', uploadError);
            throw new Error(`Storage error: ${uploadError.message}`);
          }

          console.log('Upload successful:', data);
          doc.uploadedUrl = filePath;
        } catch (docError) {
          console.error(`Error uploading ${doc.type}:`, docError);
          throw docError;
        }
      }

      console.log('All documents uploaded, updating token...');

      // Update token with uploaded documents
      const { error: updateError } = await supabase
        .from('document_upload_tokens')
        .update({
          documents_uploaded: documents.map(doc => ({
            type: doc.type,
            url: doc.uploadedUrl,
            uploaded_at: new Date().toISOString()
          })),
          used_at: new Date().toISOString()
        })
        .eq('token', token);

      if (updateError) {
        console.error('Token update error:', updateError);
        throw new Error(`Database error: ${updateError.message}`);
      }

      console.log('Token updated successfully');

      toast({
        title: 'Success!',
        description: 'All documents have been uploaded successfully.'
      });

      onComplete();
    } catch (error) {
      console.error('Upload error details:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      toast({
        title: 'Upload Failed',
        description: `Error: ${errorMessage}. Please try again.`,
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  };

  if (mode === 'camera' && selectedType) {
    return (
      <DocumentCaptureCamera
        onCapture={handleCameraCapture}
        onCancel={() => {
          setMode('select');
          setSelectedType('');
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Documents</CardTitle>
          <CardDescription>
            Welcome {applicantName}! Please upload the following documents.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {requiredDocuments.length > 0 && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Required Documents:</p>
              <ul className="list-disc list-inside space-y-1">
                {requiredDocuments.map((doc, idx) => (
                  <li key={idx} className="text-sm">{doc}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="document-type">Document Type</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger id="document-type">
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => setMode('camera')}
                disabled={!selectedType}
                className="flex-1 gap-2"
              >
                <Camera className="h-4 w-4" />
                Use Camera
              </Button>
              <Button
                variant="outline"
                disabled={!selectedType}
                className="flex-1 gap-2"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <Upload className="h-4 w-4" />
                Upload File
              </Button>
              <Input
                id="file-upload"
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Captured documents */}
      {documents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Captured Documents ({documents.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {documents.map(doc => (
                <div key={doc.id} className="relative group">
                  <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                    <img
                      src={doc.imageData}
                      alt={doc.type}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="absolute top-2 right-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(doc.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="mt-2 text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {doc.type}
                  </p>
                </div>
              ))}
            </div>

            <Button
              onClick={handleSubmit}
              disabled={isUploading}
              className="w-full mt-6"
              size="lg"
            >
              {isUploading ? 'Uploading...' : 'Submit All Documents'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
