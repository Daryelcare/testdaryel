import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DocumentUploadPortal } from '@/components/document-upload/DocumentUploadPortal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface TokenData {
  applicant_name: string;
  applicant_email: string;
  required_documents: string[];
  expires_at: string;
  used_at: string | null;
}

export default function DocumentUpload() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    document.title = 'Document Upload | Submit Your Documents';
    
    const validateToken = async () => {
      if (!token) {
        setError('Invalid upload link. Please check your email for the correct link.');
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('document_upload_tokens')
          .select('*')
          .eq('token', token)
          .single();

        if (fetchError || !data) {
          setError('Invalid or expired upload link.');
          setLoading(false);
          return;
        }

        // Check if expired
        if (new Date(data.expires_at) < new Date()) {
          setError('This upload link has expired. Please contact support for a new link.');
          setLoading(false);
          return;
        }

        // Check if already used
        if (data.used_at) {
          setCompleted(true);
        }

        setTokenData({
          applicant_name: data.applicant_name,
          applicant_email: data.applicant_email,
          required_documents: Array.isArray(data.required_documents) 
            ? data.required_documents as string[]
            : [],
          expires_at: data.expires_at,
          used_at: data.used_at
        });
      } catch (err) {
        console.error('Token validation error:', err);
        setError('An error occurred. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
            <p className="text-center mt-4 text-muted-foreground">Validating upload link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Upload Link Invalid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              Documents Submitted
            </CardTitle>
            <CardDescription>
              Thank you for uploading your documents!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Submission Complete</AlertTitle>
              <AlertDescription>
                Your documents have been successfully uploaded. We will review them and contact you soon.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Document Upload Portal</h1>
          <p className="text-muted-foreground">
            Securely upload your documents using your camera or file upload
          </p>
        </div>

        {tokenData && (
          <DocumentUploadPortal
            token={token!}
            applicantName={tokenData.applicant_name}
            requiredDocuments={tokenData.required_documents}
            onComplete={() => setCompleted(true)}
          />
        )}
      </div>
    </div>
  );
}
