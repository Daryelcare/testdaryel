import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, FileCheck, Eye } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
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

export function CompletedDocuments() {
  const queryClient = useQueryClient();

  // Fetch completed documents
  const { data: completedDocs, isLoading } = useQuery({
    queryKey: ["signed-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signed_documents")
        .select(`
          *,
          signing_requests(
            title,
            document_templates(name),
            signing_request_recipients(recipient_name, recipient_email)
          )
        `)
        .order("completed_at", { ascending: false });
      
      if (error) throw error;
      return data as SignedDocument[];
    },
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
    staleTime: 0,
  });

  // Realtime updates for signed documents and signing requests
  useEffect(() => {
    const channel = supabase
      .channel('document-signing-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'signed_documents' }, () => {
        queryClient.invalidateQueries({ queryKey: ['signed-documents'] });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'signed_documents' }, () => {
        queryClient.invalidateQueries({ queryKey: ['signed-documents'] });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'signing_requests' }, () => {
        queryClient.invalidateQueries({ queryKey: ['signed-documents'] });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'signing_request_recipients' }, () => {
        queryClient.invalidateQueries({ queryKey: ['signed-documents'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const getDocumentUrl = (filePath: string) => {
    const { data } = supabase.storage
      .from("company-assets")
      .getPublicUrl(filePath);
    return data.publicUrl;
  };

  const downloadDocument = (doc: SignedDocument) => {
    const url = getDocumentUrl(doc.final_document_path);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${doc.signing_requests.title}_signed.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return <div className="text-center p-8">Loading completed documents...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Completed Documents</h2>
        <p className="text-muted-foreground">
          View and download fully signed documents
        </p>
      </div>

      {completedDocs && completedDocs.length > 0 ? (
        <div className="space-y-4">
          {completedDocs.map((doc) => (
            <Card key={doc.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-green-600" />
                  {doc.signing_requests.title}
                </CardTitle>
                <CardDescription>
                  Template: {doc.signing_requests.document_templates.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Completed: {new Date(doc.completed_at).toLocaleDateString()}
                    </span>
                    <Badge className="bg-green-100 text-green-800 border-green-200">
                      Fully Signed
                    </Badge>
                  </div>
                  
                  {doc.signing_requests.signing_request_recipients.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Signers:</h4>
                      <div className="flex flex-wrap gap-2">
                        {doc.signing_requests.signing_request_recipients.map((recipient, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {recipient.recipient_name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(getDocumentUrl(doc.final_document_path), '_blank')}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => downloadDocument(doc)}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Download
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
            <FileCheck className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Completed Documents</h3>
            <p className="text-muted-foreground">
              Completed and signed documents will appear here
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}