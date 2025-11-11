import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { usePermissions } from "@/contexts/PermissionsContext";
import { usePagePermissions } from "@/hooks/usePagePermissions";
import { Send, Download, Loader2, CheckCircle2, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { generateReferencePDF, generateManualReferencePDF } from '@/lib/reference-pdf';

interface ReferenceButtonsProps {
  application: any;
  references: any;
  onUpdate?: () => void;
}

export function ReferenceButtons({ application, references, onUpdate }: ReferenceButtonsProps) {
  const { toast } = useToast();
  const { companySettings } = useCompany();
  const [sending, setSending] = useState<string | null>(null);
  const [completedReferences, setCompletedReferences] = useState<any[]>([]);
  const [pendingReferences, setPendingReferences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAdmin } = usePermissions();
  const { 
    canSendReferenceRequest, 
    canDownloadReferencePDF, 
    canManualReferencePDF 
  } = usePagePermissions();

  useEffect(() => {
    fetchCompletedReferences();
  }, [application.id]);

  const fetchCompletedReferences = async () => {
    try {
      const { data, error } = await supabase
        .from('reference_requests')
        .select('*')
        .eq('application_id', application.id)
        .order('sent_at', { ascending: false });

      if (error) throw error;
      
      const completed = (data || []).filter(ref => ref.status === 'completed');
      const pending = (data || []).filter(ref => ref.status === 'pending');
      
      setCompletedReferences(completed);
      setPendingReferences(pending);
    } catch (error) {
      console.error('Error fetching references:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get all employers from employment history
  const getAllEmployers = (application: any) => {
    const employmentHistory = application.employment_history;
    const employers = [];
    
    if (!employmentHistory) return [];
    
    // Add recent employer
    if (employmentHistory.recentEmployer?.company?.trim() || employmentHistory.recentEmployer?.name?.trim()) {
      employers.push({
        ...employmentHistory.recentEmployer,
        isRecent: true
      });
    }
    
    // Add previous employers
    if (employmentHistory.previousEmployers?.length) {
      employers.push(...employmentHistory.previousEmployers.filter((emp: any) => 
        emp.company?.trim() || emp.name?.trim()
      ).map((emp: any) => ({ ...emp, isRecent: false })));
    }
    
    return employers;
  };

  // Find matching employer for a reference
  const findEmployerMatch = (reference: any, employers: any[]) => {
    if (!reference || !employers?.length) return null;
    
    // Try to match by company name (case-insensitive)
    const refCompany = reference.company?.trim().toLowerCase();
    if (refCompany) {
      const match = employers.find(emp => 
        emp.company?.trim().toLowerCase() === refCompany
      );
      if (match) return match;
    }
    
    // Try to match by contact name (case-insensitive)
    const refName = reference.name?.trim().toLowerCase();
    if (refName) {
      const match = employers.find(emp => 
        emp.name?.trim().toLowerCase() === refName
      );
      if (match) return match;
    }
    
    // Try to match by email
    const refEmail = reference.email?.trim().toLowerCase();
    if (refEmail) {
      const match = employers.find(emp => 
        emp.email?.trim().toLowerCase() === refEmail
      );
      if (match) return match;
    }
    
    return null;
  };

  // Determine reference type and matching employer for specific reference
  const getReferenceDetails = (application: any, referenceKey: 'reference1' | 'reference2') => {
    const employers = getAllEmployers(application);
    const reference = application.reference_info?.[referenceKey];
    
    if (!reference) {
      return { type: 'character', matchedEmployer: null };
    }
    
    const matchedEmployer = findEmployerMatch(reference, employers);
    
    if (matchedEmployer) {
      return { type: 'employer', matchedEmployer };
    }
    
    // Fallback to positional logic if no match found
    if (employers.length >= 2) {
      return { type: 'employer', matchedEmployer: null };
    } else if (employers.length === 1) {
      const type = referenceKey === 'reference1' ? 'employer' : 'character';
      const matchedEmployer = type === 'employer' ? employers[0] : null;
      return { type, matchedEmployer };
    } else {
      return { type: 'character', matchedEmployer: null };
    }
  };

  // Helper function for backward compatibility
  const referenceTypeForKey = (application: any, referenceKey: 'reference1' | 'reference2') => {
    return getReferenceDetails(application, referenceKey).type;
  };

  const sendReferenceEmail = async (referenceKey: string, reference: any) => {
    setSending(referenceKey);
    
    try {
      const referenceType = referenceTypeForKey(application, referenceKey as 'reference1' | 'reference2');
      const personalInfo = application.personal_info || {};
      
      // Validate required company settings
      if (!companySettings.name || companySettings.name.trim().length === 0) {
        toast({
          title: "Configuration Required",
          description: "Please configure your company name in Settings before sending reference emails.",
          variant: "destructive",
        });
        return;
      }

      if (!personalInfo.positionAppliedFor || personalInfo.positionAppliedFor.trim().length === 0) {
        toast({
          title: "Missing Information",
          description: "The position applied for is not specified in the application.",
          variant: "destructive",
        });
        return;
      }

      const emailData = {
        applicationId: application.id,
        applicantName: personalInfo.fullName || 'Unknown Applicant',
        applicantFirstName: personalInfo.fullName?.split(' ')[0] || 'Applicant',
        applicantAddress: `${personalInfo.streetAddress || ''}, ${personalInfo.town || ''}`,
        applicantPostcode: personalInfo.postcode || '',
        positionAppliedFor: personalInfo.positionAppliedFor,
        referenceEmail: reference.email,
        referenceName: reference.name,
        referenceCompany: reference.company,
        referenceAddress: `${reference.address || ''}, ${reference.town || ''}`,
        companyName: companySettings.name,
        referenceType: referenceType,
        employmentDetails: application.employment_history?.recentEmployer
      };

      const { error } = await supabase.functions.invoke('send-reference-email', {
        body: emailData
      });

      if (error) {
        // Parse error message for user-friendly display
        const errorMessage = error.message || "Failed to send reference email";
        toast({
          title: "Error Sending Reference",
          description: errorMessage,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Reference Email Sent",
        description: `Reference request sent to ${reference.name} (${reference.email})`,
      });

      onUpdate?.();
    } catch (error: any) {
      console.error('Error sending reference email:', error);
      const errorMessage = error.message || "Failed to send reference email. Please check your settings.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSending(null);
    }
  };

  const downloadCompletedReference = async (completedRef: any) => {
    try {
      const applicantName = application.personal_info?.fullName || 'Unknown Applicant';
      const applicantDOB = application.personal_info?.dateOfBirth || 'Not provided';
      const applicantPostcode = application.personal_info?.postcode || 'Not provided';
      const pdf = await generateReferencePDF(
        completedRef, 
        applicantName, 
        applicantDOB, 
        applicantPostcode, 
        { name: companySettings.name, logo: companySettings.logo }
      );
      
      const fileName = `reference-${completedRef.reference_name.replace(/\s+/g, '-')}-${applicantName.replace(/\s+/g, '-')}.pdf`;
      pdf.save(fileName);
      
      toast({
        title: "Reference Downloaded",
        description: `Downloaded reference from ${completedRef.reference_name}`,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive",
      });
    }
  };

  const getCompletedReferenceForEmail = (email: string) => {
    return completedReferences.find(ref => ref.reference_email === email);
  };

  const getPendingReferenceForEmail = (email: string) => {
    return pendingReferences.find(ref => ref.reference_email === email);
  };

  const generateBlankPDF = async (referenceKey: string, reference: any) => {
    try {
      const personalInfo = application.personal_info || {};
      const applicantName = personalInfo.fullName || 'Unknown Applicant';
      const { type: refType, matchedEmployer } = getReferenceDetails(application, referenceKey as 'reference1' | 'reference2');

      // Use matched employer data if available, otherwise use defaults
      let employmentFrom = '';
      let employmentTo = '';
      let reasonForLeaving = '';
      let employmentStatus = 'neither';

      if (refType === 'employer' && matchedEmployer) {
        employmentFrom = matchedEmployer.from || '';
        employmentTo = matchedEmployer.to || '';
        reasonForLeaving = matchedEmployer.reasonForLeaving || '';
        
        // Determine employment status
        const today = new Date();
        const endDate = matchedEmployer.to ? new Date(matchedEmployer.to) : null;
        
        if (!matchedEmployer.to || endDate > today) {
          employmentStatus = 'current';
        } else {
          employmentStatus = 'previous';
        }
      }
      
      const pdf = await generateManualReferencePDF({
        applicantName,
        applicantPosition: refType === 'employer' ? (matchedEmployer?.position || application.employment_history?.recentEmployer?.position || '') : personalInfo.positionAppliedFor,
        referenceType: refType as 'employer' | 'character',
        applicantDOB: personalInfo.dateOfBirth,
        applicantPostcode: personalInfo.postcode,
        employmentFrom,
        employmentTo,
        reasonForLeaving,
        employmentStatus: employmentStatus as 'current' | 'previous' | 'neither',
        referenceNumber: referenceKey === 'reference1' ? 1 : 2,
        referee: {
          name: reference.name,
          company: reference.company,
          jobTitle: reference.jobTitle,
          email: reference.email,
          phone: reference.contactNumber,
          address: reference.address,
          town: reference.town,
          postcode: reference.postcode,
        },
      }, { name: companySettings.name, logo: companySettings.logo });

      const fileName = `manual-reference-${reference.name?.replace(/\s+/g, '-') || referenceKey}-${applicantName.replace(/\s+/g, '-')}.pdf`;
      pdf.save(fileName);

      toast({
        title: 'Manual PDF Generated',
        description: `Blank reference form for ${reference.name || referenceKey} downloaded`,
      });
    } catch (error) {
      console.error('Error generating manual reference PDF:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate manual reference PDF',
        variant: 'destructive',
      });
    }
  };
  if (!references) return null;

  if (loading) {
    return (
      <div className="space-y-4">
        <h4 className="font-medium">Reference Actions</h4>
        <div className="flex justify-center p-4">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="font-medium">Reference Actions</h4>
      
      {/* Reference 1 */}
      {references.reference1 && (() => {
        const completedRef = getCompletedReferenceForEmail(references.reference1.email);
        const pendingRef = getPendingReferenceForEmail(references.reference1.email);
        return (
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="font-medium">{references.reference1.name}</div>
                {completedRef && <CheckCircle2 className="w-4 h-4 text-green-600" />}
              </div>
              <div className="text-sm text-muted-foreground">{references.reference1.company}</div>
              <div className="text-sm text-muted-foreground">{references.reference1.email}</div>
              <div className="flex gap-2 mt-1">
                <Badge variant="outline">
                  {referenceTypeForKey(application, 'reference1') === 'employer' ? 'Employer Reference' : 'Character Reference'}
                </Badge>
                {completedRef && (
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    Completed on {new Date(completedRef.completed_at).toLocaleDateString()}
                  </Badge>
                )}
              </div>
              {pendingRef && !completedRef && pendingRef.sent_at && (
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>Last sent: {formatDistanceToNow(new Date(pendingRef.sent_at), { addSuffix: true })}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {completedRef ? (
                <>
                  {(isAdmin || canDownloadReferencePDF()) && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => downloadCompletedReference(completedRef)}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Download PDF
                    </Button>
                  )}
                  {(isAdmin || canManualReferencePDF()) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => generateBlankPDF('reference1', references.reference1)}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Manual PDF
                    </Button>
                  )}
                </>
              ) : (
                <>
                  {(isAdmin || canSendReferenceRequest()) && (
                    <Button
                      size="sm"
                      onClick={() => sendReferenceEmail('reference1', references.reference1)}
                      disabled={sending === 'reference1'}
                    >
                      {sending === 'reference1' ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-1" />
                          Send Request
                        </>
                      )}
                    </Button>
                  )}
                  {(isAdmin || canManualReferencePDF()) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => generateBlankPDF('reference1', references.reference1)}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Manual PDF
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* Reference 2 */}
      {references.reference2 && (() => {
        const completedRef = getCompletedReferenceForEmail(references.reference2.email);
        const pendingRef = getPendingReferenceForEmail(references.reference2.email);
        return (
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="font-medium">{references.reference2.name}</div>
                {completedRef && <CheckCircle2 className="w-4 h-4 text-green-600" />}
              </div>
              <div className="text-sm text-muted-foreground">{references.reference2.company}</div>
              <div className="text-sm text-muted-foreground">{references.reference2.email}</div>
              <div className="flex gap-2 mt-1">
                <Badge variant="outline">
                  {referenceTypeForKey(application, 'reference2') === 'employer' ? 'Employer Reference' : 'Character Reference'}
                </Badge>
                {completedRef && (
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    Completed on {new Date(completedRef.completed_at).toLocaleDateString()}
                  </Badge>
                )}
              </div>
              {pendingRef && !completedRef && pendingRef.sent_at && (
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>Last sent: {formatDistanceToNow(new Date(pendingRef.sent_at), { addSuffix: true })}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {completedRef ? (
                <>
                  {(isAdmin || canDownloadReferencePDF()) && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => downloadCompletedReference(completedRef)}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Download PDF
                    </Button>
                  )}
                  {(isAdmin || canManualReferencePDF()) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => generateBlankPDF('reference2', references.reference2)}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Manual PDF
                    </Button>
                  )}
                </>
              ) : (
                <>
                  {(isAdmin || canSendReferenceRequest()) && (
                    <Button
                      size="sm"
                      onClick={() => sendReferenceEmail('reference2', references.reference2)}
                      disabled={sending === 'reference2'}
                    >
                      {sending === 'reference2' ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-1" />
                          Send Request
                        </>
                      )}
                    </Button>
                  )}
                  {(isAdmin || canManualReferencePDF()) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => generateBlankPDF('reference2', references.reference2)}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Manual PDF
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}