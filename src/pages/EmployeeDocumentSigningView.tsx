import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  FileText, 
  PenTool, 
  Loader2, 
  Shield, 
  Eye,
  User,
  Calendar,
  RotateCcw
} from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { CompanyProvider, useCompany } from "@/contexts/CompanyContext";
import { EnhancedPDFViewer } from "@/components/document-signing/EnhancedPDFViewer";
import "@/lib/pdf-config";

interface SigningRequestData {
  id: string;
  template_id: string;
  title: string;
  message: string;
  status: string;
  document_templates: {
    name: string;
    file_path: string;
  };
  signing_request_recipients: {
    id: string;
    recipient_name: string;
    recipient_email: string;
    status: string;
    access_token: string;
    expired_at?: string;
    access_count?: number;
  }[];
}

interface TemplateField {
  id: string;
  field_name: string;
  field_type: string;
  x_position: number;
  y_position: number;
  width: number;
  height: number;
  page_number: number;
  is_required: boolean;
  placeholder_text?: string;
}

function EmployeeDocumentSigningContent() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { companySettings } = useCompany();
  
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(0.8);
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [signatures, setSignatures] = useState<Record<string, string>>({});
  const [isSigningInProgress, setIsSigningInProgress] = useState(false);
  const [hasBeenSigned, setHasBeenSigned] = useState(false);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const signatureRefs = useRef<Record<string, SignatureCanvas | null>>({});

  // Check if mobile view
  useEffect(() => {
    const checkMobileView = () => {
      const isMobile = window.innerWidth < 1024;
      setIsMobileView(isMobile);
      setScale(isMobile ? 0.6 : 0.8);
    };
    
    checkMobileView();
    window.addEventListener('resize', checkMobileView);
    return () => window.removeEventListener('resize', checkMobileView);
  }, []);

  // Fetch signing request data
  const { data: signingData, isLoading, error } = useQuery({
    queryKey: ["signing-request", token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signing_requests")
        .select(`
          *,
          document_templates (name, file_path),
          signing_request_recipients (*)
        `)
        .eq("signing_token", token)
        .single();

      if (error) throw error;
      
      // Track access for expiration checking
      if (data?.signing_request_recipients?.[0]) {
        await supabase
          .from("signing_request_recipients")
          .update({ 
            access_count: (data.signing_request_recipients[0].access_count || 0) + 1 
          })
          .eq("id", data.signing_request_recipients[0].id);
      }
      
      return data as SigningRequestData;
    },
    enabled: !!token,
  });

  // Fetch template fields
  const { data: templateFields } = useQuery({
    queryKey: ["template-fields", signingData?.template_id],
    queryFn: async () => {
      if (!signingData?.template_id) return [];
      
      const { data, error } = await supabase
        .from("template_fields")
        .select("*")
        .eq("template_id", signingData.template_id)
        .order("page_number");

      if (error) throw error;
      return data as TemplateField[];
    },
    enabled: !!signingData?.template_id,
  });

  // Load PDF when data is available
  useEffect(() => {
    if (signingData?.document_templates?.file_path) {
      const url = `${supabase.storage.from("company-assets").getPublicUrl(signingData.document_templates.file_path).data.publicUrl}`;
      setPdfUrl(url);
    }
  }, [signingData]);

  // Complete signing mutation
  const completeSigning = useMutation({
    mutationFn: async () => {
      if (!signingData || !templateFields) return;

      const recipient = signingData.signing_request_recipients[0];
      if (!recipient) throw new Error("No recipient found");

      // Generate final PDF with filled fields and signatures
      const originalPdfUrl = `${supabase.storage.from("company-assets").getPublicUrl(signingData.document_templates.file_path).data.publicUrl}`;
      const originalPdfResponse = await fetch(originalPdfUrl);
      const originalPdfBytes = await originalPdfResponse.arrayBuffer();

      const pdfDoc = await PDFDocument.load(originalPdfBytes);
      const pages = pdfDoc.getPages();

      // Add field values and signatures to the PDF
      for (const field of templateFields) {
        const page = pages[field.page_number - 1];
        if (!page) continue;

        const value = field.field_type === "signature" ? signatures[field.id] : fieldValues[field.id];
        if (!value) continue;

        // Get page dimensions for coordinate conversion
        const { height: pageHeight } = page.getSize();
        
        // Convert web coordinates to PDF coordinates (Y-axis is flipped in PDF)
        const pdfX = field.x_position;
        const pdfY = pageHeight - field.y_position - field.height;

        if (field.field_type === "signature") {
          // Handle signature fields
          try {
            const signatureData = value.split(',')[1];
            const signatureBytes = Uint8Array.from(atob(signatureData), c => c.charCodeAt(0));
            const signatureImage = await pdfDoc.embedPng(signatureBytes);
            
            page.drawImage(signatureImage, {
              x: pdfX,
              y: pdfY,
              width: field.width,
              height: field.height,
            });
          } catch (error) {
            console.error("Error adding signature:", error);
          }
        } else if (field.field_type === "checkbox") {
          if (value === "true") {
            page.drawText("✓", {
              x: pdfX + 2,
              y: pdfY + 5,
              size: field.height - 4,
            });
          }
        } else {
          page.drawText(value.toString(), {
            x: pdfX,
            y: pdfY + (field.height / 2) - 6,
            size: Math.min(12, field.height - 4),
          });
        }
      }

      // Generate the final PDF
      const finalPdfBytes = await pdfDoc.save();
      const finalPdfBlob = new Blob([finalPdfBytes as BlobPart], { type: 'application/pdf' });

      // Upload the final PDF to storage
      const fileName = `${Date.now()}_${signingData.title}_signed.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("company-assets")
        .upload(`signed-documents/${fileName}`, finalPdfBlob);

      if (uploadError) throw uploadError;

      // Update recipient status to signed and mark as expired
      const { error: updateError } = await supabase
        .from("signing_request_recipients")
        .update({
          status: "signed",
          signed_at: new Date().toISOString(),
          expired_at: new Date().toISOString(),
        })
        .eq("id", recipient.id);

      if (updateError) throw updateError;

      // Create signed document record
      const signedDocumentData = {
        signing_request_id: signingData.id,
        final_document_path: `signed-documents/${fileName}`,
        completion_data: {
          recipient_id: recipient.id,
          field_data: {
            ...fieldValues,
            ...signatures,
          },
        },
        completed_at: new Date().toISOString(),
      };

      const { error: docError } = await supabase
        .from("signed_documents")
        .insert(signedDocumentData);

      if (docError) throw docError;

      // Send completion notification
      await supabase.functions.invoke("send-completion-notification", {
        body: {
          documentTitle: signingData.title,
          recipientName: recipient.recipient_name,
          recipientEmail: recipient.recipient_email,
        },
      });
    },
    onSuccess: () => {
      setHasBeenSigned(true);
      toast.success("Document signed successfully!");
      queryClient.invalidateQueries({ queryKey: ["signing-request", token] });
    },
    onError: (error: any) => {
      console.error("Error signing document:", error);
      toast.error("Failed to sign document: " + error.message);
      setIsSigningInProgress(false);
    },
  });

  const handleFieldChange = (fieldId: string, value: string) => {
    setFieldValues(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleSignature = (fieldId: string) => {
    const canvas = signatureRefs.current[fieldId];
    if (canvas && !canvas.isEmpty()) {
      const dataURL = canvas.toDataURL();
      setSignatures(prev => ({ ...prev, [fieldId]: dataURL }));
    }
  };

  const clearSignature = (fieldId: string) => {
    const canvas = signatureRefs.current[fieldId];
    if (canvas) {
      canvas.clear();
    }
    setSignatures(prev => {
      const newSignatures = { ...prev };
      delete newSignatures[fieldId];
      return newSignatures;
    });
  };

  const handleSubmit = () => {
    if (!templateFields || isSigningInProgress) return;

    if (completeSigning.isPending) {
      toast.error("Document is already being signed, please wait...");
      return;
    }

    // Check required fields
    const requiredFields = templateFields.filter(field => field.is_required);
    const missingFields = requiredFields.filter(field => {
      if (field.field_type === "signature") {
        return !signatures[field.id];
      }
      if (field.field_type === "checkbox") {
        return !fieldValues[field.id];
      }
      return !fieldValues[field.id];
    });

    if (missingFields.length > 0) {
      // Navigate to first missing field
      if (missingFields[0]) {
        setCurrentPage(missingFields[0].page_number);
        setSelectedField(missingFields[0].id);
        setShowFieldModal(true);
        toast.error(`Please complete the required field: ${missingFields[0].field_name}`);
      }
      return;
    }

    setIsSigningInProgress(true);
    completeSigning.mutate();
  };

  const handleFieldClick = (fieldId: string) => {
    setSelectedField(fieldId);
    setShowFieldModal(true);
  };

  const closeFieldModal = () => {
    setShowFieldModal(false);
    setSelectedField(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-lg font-medium">Loading document...</p>
            <p className="text-sm text-muted-foreground mt-2">Please wait while we prepare your document</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !signingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">Document Not Found</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="mb-6">The signing link is invalid or has expired.</p>
            <Button onClick={() => navigate("/")}>Return to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const recipient = signingData.signing_request_recipients[0];
  const isAlreadySigned = recipient?.status === "signed" || hasBeenSigned;
  const isExpired = recipient?.expired_at !== null;

  if (isAlreadySigned || isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-green-600">
              {isExpired ? "Link Expired" : "Already Signed"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-600" />
            <p className="mb-6">
              {isExpired 
                ? "This signing link has expired and is no longer accessible." 
                : "This document has already been signed successfully."
              }
            </p>
            <Button onClick={() => navigate("/")}>Return to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate form completion
  const requiredFields = templateFields?.filter(field => field.is_required) || [];
  const completedRequiredFields = requiredFields.filter(field => {
    if (field.field_type === "signature") {
      return signatures[field.id];
    }
    return fieldValues[field.id];
  });
  const isFormComplete = requiredFields.length > 0 && completedRequiredFields.length === requiredFields.length;
  const selectedFieldData = templateFields?.find(field => field.id === selectedField);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Mobile-Optimized Header */}
      <div className="bg-white/95 backdrop-blur-sm border-b sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {companySettings.logo && (
                  <img
                    src={companySettings.logo}
                    alt={companySettings.name}
                    className="h-8 w-8 object-contain flex-shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <h1 className="font-semibold text-lg text-foreground truncate">
                    {companySettings.name || 'Document Signing'}
                  </h1>
                  <p className="text-xs text-muted-foreground truncate">{signingData.title}</p>
                </div>
              </div>
              
              <Badge variant="outline" className="flex items-center gap-1 px-2 py-1 flex-shrink-0">
                <Shield className="h-3 w-3" />
                <span className="text-xs">Secure</span>
              </Badge>
            </div>
            
            {/* Progress Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {completedRequiredFields.length} of {requiredFields.length} fields completed
                </span>
                <span className="text-xs font-medium">
                  {requiredFields.length > 0 ? Math.round((completedRequiredFields.length / requiredFields.length) * 100) : 100}%
                </span>
              </div>
              <Progress 
                value={requiredFields.length > 0 ? (completedRequiredFields.length / requiredFields.length) * 100 : 100} 
                className="h-1.5" 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Instructions Card */}
        {signingData.message && (
          <div className="px-4 pb-2">
            <Card className="border-l-4 border-l-primary">
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">{signingData.message}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* PDF Container - Continuous Scroll */}
        <div className="flex-1 px-4">
          <Card className="h-full">
            <CardContent className="p-0 h-full">
              {pdfUrl && (
                <EnhancedPDFViewer
                  pdfUrl={pdfUrl}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                  scale={scale}
                  onScaleChange={setScale}
                  className="h-full"
                  showToolbar={!isMobileView}
                  isMobile={isMobileView}
                  continuousMode={true}
                   overlayContent={(pageNum, viewerScale) => (
                     <>
                       {templateFields
                         ?.filter(field => field.page_number === pageNum)
                         .map((field) => {
                           const isCompleted = field.field_type === "signature" 
                             ? signatures[field.id] 
                             : fieldValues[field.id];
                           
                           return (
                             <div
                               key={field.id}
                               className={`absolute cursor-pointer transition-all duration-200 rounded-md ${
                                 isCompleted 
                                   ? 'bg-green-200/90 border-2 border-green-500 shadow-green-200' 
                                   : field.is_required 
                                     ? 'bg-red-200/90 border-2 border-red-500 animate-pulse shadow-red-200' 
                                     : 'bg-blue-200/90 border-2 border-blue-500 shadow-blue-200'
                               } hover:scale-105 hover:shadow-lg`}
                               style={{
                                 left: `${field.x_position * viewerScale}px`,
                                 top: `${field.y_position * viewerScale}px`,
                                 width: `${field.width * viewerScale}px`,
                                 height: `${field.height * viewerScale}px`,
                                 transform: 'translateZ(0)',
                               }}
                               onClick={() => handleFieldClick(field.id)}
                               title={`${field.field_name}${field.is_required ? ' (Required)' : ''}`}
                             >
                               <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm">
                                 {isCompleted ? (
                                   <CheckCircle2 className="h-4 w-4 text-green-700 drop-shadow-sm" />
                                 ) : (
                                   <PenTool className="h-4 w-4 text-gray-700 drop-shadow-sm" />
                                 )}
                               </div>
                               <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/90 text-white px-2 py-1 rounded-md text-xs whitespace-nowrap pointer-events-none shadow-lg">
                                 {field.field_name}
                                 {field.is_required && <span className="text-red-300 ml-1">*</span>}
                               </div>
                             </div>
                           );
                         })}
                     </>
                   )}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bottom Action Bar */}
        <div className="bg-white/95 backdrop-blur-sm border-t px-4 py-3 shadow-lg">
          <div className="space-y-3">
            {/* Field Status Pills */}
            {requiredFields.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {requiredFields.slice(0, isMobileView ? 3 : 5).map((field) => {
                  const isCompleted = field.field_type === "signature" 
                    ? signatures[field.id] 
                    : fieldValues[field.id];
                  
                  return (
                    <button
                      key={field.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                        isCompleted 
                          ? 'bg-green-100 text-green-800 border border-green-300' 
                          : 'bg-red-100 text-red-800 border border-red-300'
                      }`}
                      onClick={() => handleFieldClick(field.id)}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <PenTool className="h-3 w-3" />
                      )}
                      {field.field_name}
                    </button>
                  );
                })}
                {requiredFields.length > (isMobileView ? 3 : 5) && (
                  <div className="flex items-center px-3 py-2 text-xs text-muted-foreground">
                    +{requiredFields.length - (isMobileView ? 3 : 5)} more...
                  </div>
                )}
              </div>
            )}

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={!isFormComplete || isSigningInProgress}
              className={`w-full h-12 text-base font-semibold transition-all ${
                isFormComplete 
                  ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-lg' 
                  : 'bg-muted-foreground/10'
              }`}
              size="lg"
            >
              {isSigningInProgress ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Processing Signature...
                </>
              ) : isFormComplete ? (
                <>
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  Sign & Complete Document
                </>
              ) : (
                <>
                  <PenTool className="h-5 w-5 mr-2" />
                  Complete {requiredFields.length - completedRequiredFields.length} Required Fields
                </>
              )}
            </Button>
            
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-3 w-3" />
              <span>256-bit SSL Encryption • Legally Binding</span>
            </div>
          </div>
        </div>
      </div>

      {/* Field Modal */}
      <Dialog open={showFieldModal} onOpenChange={closeFieldModal}>
        <DialogContent className={`${isMobileView ? 'max-w-[95vw] max-h-[90vh]' : 'max-w-2xl'} overflow-y-auto`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5" />
              {selectedFieldData?.field_name}
              {selectedFieldData?.is_required && <span className="text-red-500">*</span>}
            </DialogTitle>
          </DialogHeader>
          
          {selectedFieldData && (
            <div className="space-y-4">
              {selectedFieldData.field_type === "text" && (
                <div>
                  <Label htmlFor="field-input">Enter your information</Label>
                  <Input
                    id="field-input"
                    value={fieldValues[selectedFieldData.id] || ""}
                    onChange={(e) => handleFieldChange(selectedFieldData.id, e.target.value)}
                    placeholder={selectedFieldData.placeholder_text || "Type here..."}
                    className="mt-2"
                  />
                </div>
              )}
              
              {selectedFieldData.field_type === "checkbox" && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="field-checkbox"
                    checked={fieldValues[selectedFieldData.id] === "true"}
                    onCheckedChange={(checked) => 
                      handleFieldChange(selectedFieldData.id, checked ? "true" : "false")
                    }
                  />
                  <Label htmlFor="field-checkbox" className="text-sm">
                    {selectedFieldData.placeholder_text || "Check this box"}
                  </Label>
                </div>
              )}
              
              {selectedFieldData.field_type === "signature" && (
                <div className="space-y-4">
                  <Label>Your Signature</Label>
                  <div className={`border-2 border-dashed border-gray-300 rounded-lg ${isMobileView ? 'h-32' : 'h-48'}`}>
                    <SignatureCanvas
                      ref={(ref) => signatureRefs.current[selectedFieldData.id] = ref}
                      canvasProps={{
                        className: "signature-canvas w-full h-full",
                        style: { backgroundColor: 'white' }
                      }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => clearSignature(selectedFieldData.id)}
                      className="flex-1"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Clear
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        handleSignature(selectedFieldData.id);
                        closeFieldModal();
                      }}
                      className="flex-1"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Save Signature
                    </Button>
                  </div>
                </div>
              )}
              
              {selectedFieldData.field_type !== "signature" && (
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={closeFieldModal}>
                    Cancel
                  </Button>
                  <Button onClick={closeFieldModal}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function EmployeeDocumentSigningView() {
  return (
    <CompanyProvider>
      <EmployeeDocumentSigningContent />
    </CompanyProvider>
  );
}