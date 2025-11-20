import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  FileCheck, 
  FileWarning, 
  FileX, 
  Download, 
  Eye, 
  CheckCircle2, 
  XCircle,
  AlertCircle,
  Star,
  ImageIcon,
  FileText
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface UploadedDocument {
  id: string;
  type: string;
  uploadedUrl: string;
  uploadedAt?: string;
}

interface DocumentQualityRating {
  documentId: string;
  quality: "excellent" | "good" | "acceptable" | "poor" | "unreadable";
  verified: boolean;
  notes: string;
  ratedBy?: string;
  ratedAt?: string;
}

interface UploadedDocumentsViewProps {
  applicationId: string;
}

export function UploadedDocumentsView({ applicationId }: UploadedDocumentsViewProps) {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [ratings, setRatings] = useState<Record<string, DocumentQualityRating>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<UploadedDocument | null>(null);
  const [tokenInfo, setTokenInfo] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchDocuments();
  }, [applicationId]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      
      // Fetch document upload token info
      const { data: tokenData, error: tokenError } = await supabase
        .from('document_upload_tokens')
        .select('*')
        .eq('application_id', applicationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (tokenError && tokenError.code !== 'PGRST116') {
        console.error('Error fetching token:', tokenError);
        return;
      }

      if (!tokenData) {
        setDocuments([]);
        return;
      }

      setTokenInfo(tokenData);

      // Parse uploaded documents with proper type handling
      let uploadedDocs: UploadedDocument[] = [];
      if (tokenData.documents_uploaded && Array.isArray(tokenData.documents_uploaded)) {
        uploadedDocs = tokenData.documents_uploaded.map((doc: any) => ({
          id: doc.id || '',
          type: doc.type || '',
          uploadedUrl: doc.uploadedUrl || '',
          uploadedAt: doc.uploadedAt,
        }));
      }
      setDocuments(uploadedDocs);

      // Load existing ratings (from local storage for now)
      const savedRatings = localStorage.getItem(`doc-ratings-${applicationId}`);
      if (savedRatings) {
        setRatings(JSON.parse(savedRatings));
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: "Error",
        description: "Failed to load uploaded documents",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateRating = async (documentId: string, updates: Partial<DocumentQualityRating>) => {
    const currentRating = ratings[documentId] || {
      documentId,
      quality: "good",
      verified: false,
      notes: "",
    };

    const newRating = {
      ...currentRating,
      ...updates,
      ratedAt: new Date().toISOString(),
    };

    const newRatings = {
      ...ratings,
      [documentId]: newRating,
    };

    setRatings(newRatings);
    localStorage.setItem(`doc-ratings-${applicationId}`, JSON.stringify(newRatings));

    toast({
      title: "Rating Updated",
      description: "Document rating has been saved",
    });
  };

  const downloadDocument = async (doc: UploadedDocument) => {
    try {
      // Extract path from the URL
      const url = new URL(doc.uploadedUrl);
      const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/applicant-documents\/(.+)$/);
      
      if (!pathMatch) {
        throw new Error('Invalid document URL');
      }

      const filePath = pathMatch[1];
      
      const { data, error } = await supabase.storage
        .from('applicant-documents')
        .download(filePath);

      if (error) throw error;

      // Create download link
      const blob = new Blob([data]);
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${doc.type}_${new Date().getTime()}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);

      toast({
        title: "Download Started",
        description: `Downloading ${doc.type}`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: "Could not download document",
        variant: "destructive",
      });
    }
  };

  const getQualityBadge = (quality?: DocumentQualityRating['quality']) => {
    if (!quality) quality = "good";
    
    const configs = {
      excellent: { label: "Excellent", className: "bg-green-500", icon: CheckCircle2 },
      good: { label: "Good", className: "bg-blue-500", icon: FileCheck },
      acceptable: { label: "Acceptable", className: "bg-yellow-500", icon: AlertCircle },
      poor: { label: "Poor Quality", className: "bg-orange-500", icon: FileWarning },
      unreadable: { label: "Unreadable", className: "bg-red-500", icon: FileX },
    };

    const config = configs[quality];
    const Icon = config.icon;

    return (
      <Badge className={cn(config.className, "text-white")}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Uploaded Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">Loading documents...</div>
        </CardContent>
      </Card>
    );
  }

  if (!tokenInfo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Uploaded Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p>No document upload request sent yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (documents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Uploaded Documents
          </CardTitle>
          <CardDescription>
            Document request sent on {new Date(tokenInfo.created_at).toLocaleDateString()}
            {tokenInfo.used_at && ` • Completed on ${new Date(tokenInfo.used_at).toLocaleDateString()}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <FileX className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p>No documents uploaded yet</p>
            <p className="text-sm mt-1">
              {new Date(tokenInfo.expires_at) > new Date() 
                ? `Link expires on ${new Date(tokenInfo.expires_at).toLocaleDateString()}`
                : 'Upload link has expired'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="w-5 h-5" />
              Uploaded Documents
              <Badge variant="secondary">{documents.length}</Badge>
            </CardTitle>
            <CardDescription>
              Uploaded on {tokenInfo.used_at ? new Date(tokenInfo.used_at).toLocaleDateString() : 'Unknown date'}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              documents.forEach(doc => downloadDocument(doc));
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            Download All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-4">
            {documents.map((doc) => {
              const rating = ratings[doc.id];
              
              return (
                <div
                  key={doc.id}
                  className="border rounded-lg p-4 space-y-3 hover:bg-accent/5 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <ImageIcon className="w-4 h-4 text-muted-foreground" />
                        <h4 className="font-medium">{doc.type}</h4>
                        {getQualityBadge(rating?.quality)}
                        {rating?.verified && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                      </div>
                      {rating?.notes && (
                        <p className="text-sm text-muted-foreground mt-1">{rating.notes}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedDoc(doc)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh]">
                          <DialogHeader>
                            <DialogTitle>{doc.type}</DialogTitle>
                            <DialogDescription>
                              Review and rate document quality
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                              <img
                                src={doc.uploadedUrl}
                                alt={doc.type}
                                className="w-full h-auto max-h-[60vh] object-contain"
                              />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Quality Rating</label>
                                <Select
                                  value={rating?.quality || "good"}
                                  onValueChange={(value) =>
                                    updateRating(doc.id, {
                                      quality: value as DocumentQualityRating['quality'],
                                    })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="excellent">
                                      <div className="flex items-center gap-2">
                                        <Star className="w-4 h-4 text-green-500" />
                                        Excellent - Crystal Clear
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="good">
                                      <div className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-blue-500" />
                                        Good - Fully Readable
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="acceptable">
                                      <div className="flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 text-yellow-500" />
                                        Acceptable - Slightly Blurry
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="poor">
                                      <div className="flex items-center gap-2">
                                        <FileWarning className="w-4 h-4 text-orange-500" />
                                        Poor - Hard to Read
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="unreadable">
                                      <div className="flex items-center gap-2">
                                        <XCircle className="w-4 h-4 text-red-500" />
                                        Unreadable - Unusable
                                      </div>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Verification Status</label>
                                <div className="flex gap-2">
                                  <Button
                                    variant={rating?.verified ? "default" : "outline"}
                                    size="sm"
                                    className="flex-1"
                                    onClick={() =>
                                      updateRating(doc.id, { verified: true })
                                    }
                                  >
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Verified
                                  </Button>
                                  <Button
                                    variant={rating?.verified === false ? "default" : "outline"}
                                    size="sm"
                                    className="flex-1"
                                    onClick={() =>
                                      updateRating(doc.id, { verified: false })
                                    }
                                  >
                                    <XCircle className="w-4 h-4 mr-2" />
                                    Not Verified
                                  </Button>
                                </div>
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Notes</label>
                              <Textarea
                                placeholder="Add notes about document quality, legibility, or issues..."
                                value={rating?.notes || ""}
                                onChange={(e) =>
                                  updateRating(doc.id, { notes: e.target.value })
                                }
                                rows={3}
                              />
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadDocument(doc)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Quick rating buttons */}
                  <div className="flex gap-2 flex-wrap">
                    {!rating?.verified && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            updateRating(doc.id, {
                              quality: "excellent",
                              verified: true,
                            })
                          }
                        >
                          <Star className="w-3 h-3 mr-1 text-green-500" />
                          Mark Excellent
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            updateRating(doc.id, {
                              quality: "poor",
                              verified: false,
                              notes: "Document quality is poor, may need replacement",
                            })
                          }
                        >
                          <FileWarning className="w-3 h-3 mr-1 text-orange-500" />
                          Flag as Poor
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
