import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DatePicker } from '@/components/ui/date-picker';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { Loader2 } from 'lucide-react';

interface ReferenceRequest {
  id: string;
  application_id: string;
  reference_type: string;
  reference_name: string;
  reference_email: string;
  reference_data: any;
  status: string;
  expires_at: string;
}

interface JobApplication {
  id: string;
  personal_info: any;
}

interface ReferenceFormProps {
  token: string;
}

export function ReferenceForm({ token }: ReferenceFormProps) {
  const { toast } = useToast();
  const { companySettings } = useCompany();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [referenceRequest, setReferenceRequest] = useState<ReferenceRequest | null>(null);
  const [application, setApplication] = useState<JobApplication | null>(null);
  const [formData, setFormData] = useState({
    // Referee information
    refereeFullName: '',
    refereeJobTitle: '',
    
    // Employment reference specific
    employmentStatus: '', // current, previous, or neither
    relationshipDescription: '',
    jobTitle: '',
    startDate: null as Date | null,
    endDate: null as Date | null,
    attendance: '',
    leavingReason: '',
    
    // Common checkbox qualities
    honestTrustworthy: false,
    communicatesEffectively: false,
    effectiveTeamMember: false,
    respectfulConfidentiality: false,
    reliablePunctual: false,
    suitablePosition: false,
    kindCompassionate: false,
    worksIndependently: false,
    
    // If any qualities not ticked
    qualitiesNotTickedReason: '',
    
    // Criminal/legal questions
    convictionsKnown: '',
    criminalProceedingsKnown: '',
    criminalDetails: '',
    
    // Final comments and signature
    additionalComments: '',
    signatureDate: new Date() as Date
  });

  useEffect(() => {
    if (token) {
      fetchReferenceRequest(token);
    }
  }, [token]);

  const fetchReferenceRequest = async (token: string) => {
    try {
      // Fetch reference request using the token
      const { data: referenceData, error: refError } = await supabase
        .from('reference_requests')
        .select('*')
        .eq('token', token)
        .single();

      if (refError) {
        console.error('Reference request error:', refError);
        toast({
          title: "Invalid Link",
          description: "This reference link is invalid or has expired.",
          variant: "destructive",
        });
        return;
      }

      // Check if the request has expired
      if (new Date(referenceData.expires_at) < new Date()) {
        toast({
          title: "Link Expired",
          description: "This reference link has expired.",
          variant: "destructive",
        });
        return;
      }

      // Check if already completed
      if (referenceData.status === 'completed') {
        setReferenceRequest(referenceData);
        setLoading(false);
        return;
      }

      // Fetch the associated job application with specific fields only
      const { data: applicationData, error: appError } = await supabase
        .from('job_applications')
        .select('id, personal_info')
        .eq('id', referenceData.application_id)
        .maybeSingle();

      if (appError) {
        console.error('Application error:', appError);
        // If we can't fetch the application due to RLS, continue with minimal data
        console.warn('Could not fetch application data, continuing with reference request only');
      }

      setReferenceRequest(referenceData);
      if (applicationData) {
        setApplication(applicationData);
      } else {
        // Create minimal application object with just the ID
        setApplication({ 
          id: referenceData.application_id, 
          personal_info: { fullName: 'Applicant' } 
        });
      }
      
      // Pre-fill form with existing data if available
      setFormData(prev => ({
        ...prev,
        refereeEmail: referenceData.reference_email
      }));

    } catch (error) {
      console.error('Error fetching reference request:', error);
      toast({
        title: "Error",
        description: "Failed to load reference request.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (!referenceRequest) return;

      // Convert dates to ISO strings for database storage
      const submissionData = {
        ...formData,
        startDate: formData.startDate ? formData.startDate.toISOString() : null,
        endDate: formData.endDate ? formData.endDate.toISOString() : null,
        signatureDate: formData.signatureDate.toISOString()
      };

      // Update the reference request with the form data and mark as completed
      const { error: updateError } = await supabase
        .from('reference_requests')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          form_data: submissionData
        })
        .eq('id', referenceRequest.id);

      if (updateError) throw updateError;

      toast({
        title: "Reference Submitted",
        description: "Thank you for providing your reference. It has been submitted successfully.",
      });

      // Update local state to show completion message
      setReferenceRequest(prev => prev ? { ...prev, status: 'completed' } : null);

    } catch (error) {
      console.error('Error submitting reference:', error);
      toast({
        title: "Error",
        description: "Failed to submit reference. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card className="card-premium">
        <CardContent className="flex flex-col items-center justify-center min-h-64 py-12">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
          <p className="text-muted-foreground">Loading your reference form...</p>
        </CardContent>
      </Card>
    );
  }

  if (!referenceRequest || !application) {
    return (
      <Card className="card-premium text-center py-12">
        <CardContent>
          <div className="w-16 h-16 bg-destructive-soft rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">❌</span>
          </div>
          <h2 className="text-xl font-semibold mb-2">Reference Not Found</h2>
          <p className="text-muted-foreground">This reference link is invalid or has expired.</p>
        </CardContent>
      </Card>
    );
  }

  if (referenceRequest.status === 'completed') {
    return (
      <Card className="card-premium text-center py-12 transition-opacity duration-300">
        <CardContent>
          <div className="w-16 h-16 bg-success-soft rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✅</span>
          </div>
          <h2 className="text-xl font-semibold mb-2 text-success">Reference Already Submitted</h2>
          <p className="text-muted-foreground">Thank you for providing your reference. It has been successfully submitted.</p>
        </CardContent>
      </Card>
    );
  }

  const applicantName = application.personal_info?.fullName || 'the applicant';
  const isEmployerReference = referenceRequest.reference_type === 'employer';

  return (
    <div className="space-y-6">
      {/* Company Header */}
      <Card className="card-premium border-none bg-gradient-card overflow-hidden">
        <CardContent className="relative text-center py-4">
          {companySettings.logo && (
            <div className="flex justify-center mb-2">
              <div className="p-2 bg-background rounded-xl shadow-sm">
                <img 
                  src={companySettings.logo} 
                  alt={`${companySettings.name} logo`}
                  className="h-8 sm:h-10 w-auto object-contain"
                />
              </div>
            </div>
          )}
          <h2 className="text-base sm:text-lg font-bold text-foreground">{companySettings.name}</h2>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="card-premium">
          <CardHeader className="bg-gradient-surface border-b border-border">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-muted rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-xl sm:text-2xl">📝</span>
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-lg sm:text-xl break-words">
                  {isEmployerReference ? 'Employer Reference' : 'Character Reference'} for {applicantName}
                </CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {/* Basic Information */}
            <div className="bg-gradient-surface p-4 sm:p-6 rounded-xl border border-border">
              <h4 className="font-semibold mb-3 text-primary flex items-center gap-2">
                <span>👤</span>
                Reference for:
              </h4>
              <div className="space-y-2 text-sm sm:text-base">
                <p className="flex flex-wrap gap-2"><strong className="text-foreground">Name:</strong> <span className="text-muted-foreground">{applicantName}</span></p>
                <p className="flex flex-wrap gap-2"><strong className="text-foreground">Date of Birth:</strong> <span className="text-muted-foreground">{application.personal_info?.dateOfBirth || 'Not provided'}</span></p>
                <p className="flex flex-wrap gap-2"><strong className="text-foreground">Postcode:</strong> <span className="text-muted-foreground">{application.personal_info?.postcode || 'Not provided'}</span></p>
              </div>
            </div>

            {/* Referee Information */}
            <div>
              <h4 className="font-semibold mb-4 text-foreground flex items-center gap-2">
                <span>✍️</span>
                Your Information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="refereeFullName" className="text-sm font-medium">Referee Name *</Label>
                <Input
                  id="refereeFullName"
                  value={formData.refereeFullName}
                  onChange={(e) => setFormData(prev => ({ ...prev, refereeFullName: e.target.value }))}
                  className="border-input-border focus:border-primary"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="refereeJobTitle" className="text-sm font-medium">Referee Job Title *</Label>
                <Input
                  id="refereeJobTitle"
                  value={formData.refereeJobTitle}
                  onChange={(e) => setFormData(prev => ({ ...prev, refereeJobTitle: e.target.value }))}
                  className="border-input-border focus:border-primary"
                  required
                />
              </div>
            </div>
          </div>

            {/* Reference Type Specific Questions */}
            {isEmployerReference ? (
              <div className="space-y-6">
                <div className="bg-muted p-4 sm:p-6 rounded-xl">
                  <Label className="text-base font-semibold flex items-center gap-2 mb-3">
                    <span>💼</span>
                    Are you this person's current or previous employer? *
                  </Label>
                  <RadioGroup 
                    value={formData.employmentStatus} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, employmentStatus: value }))}
                    className="space-y-3"
                  >
                    <div className="flex items-center space-x-3 p-3 bg-background rounded-lg hover:shadow-sm transition-shadow">
                      <RadioGroupItem value="current" id="current" />
                      <Label htmlFor="current" className="cursor-pointer flex-1">Current</Label>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-background rounded-lg hover:shadow-sm transition-shadow">
                      <RadioGroupItem value="previous" id="previous" />
                      <Label htmlFor="previous" className="cursor-pointer flex-1">Previous</Label>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-background rounded-lg hover:shadow-sm transition-shadow">
                      <RadioGroupItem value="neither" id="neither" />
                      <Label htmlFor="neither" className="cursor-pointer flex-1">Neither</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="relationshipDescription" className="text-sm font-medium">What is your relationship to this person (e.g. "I am her/his manager")? *</Label>
                  <Input
                    id="relationshipDescription"
                    value={formData.relationshipDescription}
                    onChange={(e) => setFormData(prev => ({ ...prev, relationshipDescription: e.target.value }))}
                    placeholder="e.g., I am their direct manager"
                    className="border-input-border focus:border-primary"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jobTitle" className="text-sm font-medium">Please state the person's job title *</Label>
                  <Input
                    id="jobTitle"
                    value={formData.jobTitle}
                    onChange={(e) => setFormData(prev => ({ ...prev, jobTitle: e.target.value }))}
                    className="border-input-border focus:border-primary"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate" className="text-sm font-medium">Employment Start Date *</Label>
                    <DatePicker
                      selected={formData.startDate || undefined}
                      onChange={(date) => setFormData(prev => ({ ...prev, startDate: date || null }))}
                      placeholder="Select start date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate" className="text-sm font-medium">Employment End Date *</Label>
                    <DatePicker
                      selected={formData.endDate || undefined}
                      onChange={(date) => setFormData(prev => ({ ...prev, endDate: date || null }))}
                      placeholder="Select end date"
                    />
                  </div>
                </div>

                <div className="bg-accent-soft p-4 sm:p-6 rounded-xl">
                  <Label className="text-base font-semibold mb-3 block">How would you describe their recent attendance record? *</Label>
                  <RadioGroup 
                    value={formData.attendance} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, attendance: value }))}
                    className="space-y-3"
                  >
                    <div className="flex items-center space-x-3 p-3 bg-background rounded-lg hover:shadow-sm transition-shadow">
                      <RadioGroupItem value="good" id="att-good" />
                      <Label htmlFor="att-good" className="cursor-pointer flex-1">Good</Label>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-background rounded-lg hover:shadow-sm transition-shadow">
                      <RadioGroupItem value="average" id="att-average" />
                      <Label htmlFor="att-average" className="cursor-pointer flex-1">Average</Label>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-background rounded-lg hover:shadow-sm transition-shadow">
                      <RadioGroupItem value="poor" id="att-poor" />
                      <Label htmlFor="att-poor" className="cursor-pointer flex-1">Poor</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="leavingReason" className="text-sm font-medium">Why did the person leave your employment (if they are still employed, please write 'still employed')? *</Label>
                  <Textarea
                    id="leavingReason"
                    value={formData.leavingReason}
                    onChange={(e) => setFormData(prev => ({ ...prev, leavingReason: e.target.value }))}
                    className="border-input-border focus:border-primary min-h-[100px]"
                    required
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-accent-soft p-4 sm:p-6 rounded-xl">
                  <Label className="text-base font-semibold flex items-center gap-2 mb-3">
                    <span>🤝</span>
                    Do you know this person from outside employment or education? *
                  </Label>
                  <RadioGroup 
                    value={formData.employmentStatus} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, employmentStatus: value }))}
                    className="space-y-3"
                  >
                    <div className="flex items-center space-x-3 p-3 bg-background rounded-lg hover:shadow-sm transition-shadow">
                      <RadioGroupItem value="yes" id="outside-yes" />
                      <Label htmlFor="outside-yes" className="cursor-pointer flex-1">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-background rounded-lg hover:shadow-sm transition-shadow">
                      <RadioGroupItem value="no" id="outside-no" />
                      <Label htmlFor="outside-no" className="cursor-pointer flex-1">No</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="relationshipDescription" className="text-sm font-medium">Please describe your relationship with this person, including how long you have known them *</Label>
                  <Textarea
                    id="relationshipDescription"
                    value={formData.relationshipDescription}
                    onChange={(e) => setFormData(prev => ({ ...prev, relationshipDescription: e.target.value }))}
                    placeholder="Describe how you know them and for how long"
                    className="border-input-border focus:border-primary min-h-[100px]"
                    required
                  />
                </div>
              </div>
            )}

            {/* Common Character Assessment */}
            <div className="bg-success-soft p-4 sm:p-6 rounded-xl">
              <Label className="text-base font-semibold mb-4 flex items-center gap-2">
                <span>⭐</span>
                In your opinion, which of the following describes this person (tick each that is true)? *
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { key: 'honestTrustworthy', label: 'Honest and trustworthy', emoji: '🤝' },
                  { key: 'communicatesEffectively', label: 'Communicates effectively', emoji: '💬' },
                  { key: 'effectiveTeamMember', label: 'An effective team member', emoji: '👥' },
                  { key: 'respectfulConfidentiality', label: 'Respectful of confidentiality', emoji: '🔒' },
                  { key: 'reliablePunctual', label: 'Reliable and punctual', emoji: '⏰' },
                  { key: 'suitablePosition', label: 'Suitable for the position applied for', emoji: '✅' },
                  { key: 'kindCompassionate', label: 'Kind and compassionate', emoji: '❤️' },
                  { key: 'worksIndependently', label: 'Able to work well without close supervision', emoji: '🎯' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center space-x-3 p-3 bg-background rounded-lg hover:shadow-sm transition-shadow">
                    <input
                      type="checkbox"
                      id={item.key}
                      checked={formData[item.key as keyof typeof formData] as boolean}
                      onChange={(e) => setFormData(prev => ({ ...prev, [item.key]: e.target.checked }))}
                      className="rounded border-input-border w-5 h-5 text-primary focus:ring-primary"
                    />
                    <Label htmlFor={item.key} className="cursor-pointer flex-1 flex items-center gap-2">
                      <span>{item.emoji}</span>
                      <span>{item.label}</span>
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="qualitiesNotTickedReason" className="text-sm font-medium">If you did not tick one or more of the above, please tell us why here</Label>
              <Textarea
                id="qualitiesNotTickedReason"
                value={formData.qualitiesNotTickedReason}
                onChange={(e) => setFormData(prev => ({ ...prev, qualitiesNotTickedReason: e.target.value }))}
                placeholder="Please explain any concerns"
                className="border-input-border focus:border-primary min-h-[100px]"
              />
            </div>

            {/* Criminal Background Questions */}
            <div className="bg-warning-soft p-4 sm:p-6 rounded-xl space-y-6">
              <h4 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                <span>⚠️</span>
                Background Check Questions
              </h4>

              <div className="space-y-2">
                <Label className="text-sm font-medium leading-relaxed">
                  The position this person has applied for involves working with vulnerable people. Are you aware of any convictions, cautions, reprimands or final warnings that the person may have received that are not 'protected' as defined by the Rehabilitation of Offenders Act 1974 (Exceptions) Order 1975 (as amended in 2013 by SI 210 1198)? *
                </Label>
                <RadioGroup 
                  value={formData.convictionsKnown} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, convictionsKnown: value }))}
                  className="space-y-2 mt-3"
                >
                  <div className="flex items-center space-x-3 p-3 bg-background rounded-lg hover:shadow-sm transition-shadow">
                    <RadioGroupItem value="yes" id="convictions-yes" />
                    <Label htmlFor="convictions-yes" className="cursor-pointer flex-1">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-background rounded-lg hover:shadow-sm transition-shadow">
                    <RadioGroupItem value="no" id="convictions-no" />
                    <Label htmlFor="convictions-no" className="cursor-pointer flex-1">No</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium leading-relaxed">
                  To your knowledge, is this person currently the subject of any criminal proceedings (for example, charged or summoned but not yet dealt with) or any police investigation? *
                </Label>
                <RadioGroup 
                  value={formData.criminalProceedingsKnown} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, criminalProceedingsKnown: value }))}
                  className="space-y-2 mt-3"
                >
                  <div className="flex items-center space-x-3 p-3 bg-background rounded-lg hover:shadow-sm transition-shadow">
                    <RadioGroupItem value="yes" id="proceedings-yes" />
                    <Label htmlFor="proceedings-yes" className="cursor-pointer flex-1">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-background rounded-lg hover:shadow-sm transition-shadow">
                    <RadioGroupItem value="no" id="proceedings-no" />
                    <Label htmlFor="proceedings-no" className="cursor-pointer flex-1">No</Label>
                  </div>
                </RadioGroup>
              </div>

              {(formData.convictionsKnown === 'yes' || formData.criminalProceedingsKnown === 'yes') && (
                <div className="space-y-2 animate-slide-up">
                  <Label htmlFor="criminalDetails" className="text-sm font-medium">If you answered 'yes' to either of the two previous questions, please provide details *</Label>
                  <Textarea
                    id="criminalDetails"
                    value={formData.criminalDetails}
                    onChange={(e) => setFormData(prev => ({ ...prev, criminalDetails: e.target.value }))}
                    placeholder="Please provide full details"
                    className="border-input-border focus:border-primary min-h-[100px]"
                    required={formData.convictionsKnown === 'yes' || formData.criminalProceedingsKnown === 'yes'}
                  />
                </div>
              )}
            </div>

            {/* Additional Comments */}
            <div className="space-y-2">
              <Label htmlFor="additionalComments" className="text-sm font-medium flex items-center gap-2">
                <span>💭</span>
                Any additional comments you would like to make about this person
              </Label>
              <Textarea
                id="additionalComments"
                value={formData.additionalComments}
                onChange={(e) => setFormData(prev => ({ ...prev, additionalComments: e.target.value }))}
                placeholder="Any other relevant information"
                className="border-input-border focus:border-primary min-h-[120px]"
              />
            </div>

            {/* Declaration and Signature */}
            <div className="bg-gradient-surface p-4 sm:p-6 rounded-xl border border-border">
              <h4 className="font-semibold mb-3 flex items-center gap-2 text-foreground">
                <span>📋</span>
                Declaration
              </h4>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                I certify that, to the best of my knowledge, the information I have given is true and complete. I understand that any deliberate omission, falsification or misrepresentation may lead to refusal of appointment or dismissal. I consent to enquiries being made of third parties, which may include previous employers (if applicable), in order to verify the information I have provided.
              </p>
              
              <div className="space-y-2">
                <Label htmlFor="signatureDate" className="text-sm font-medium">Date of completion *</Label>
                <DatePicker
                  selected={formData.signatureDate}
                  onChange={(date) => setFormData(prev => ({ ...prev, signatureDate: date || new Date() }))}
                  placeholder="Select date"
                  className="max-w-xs"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-border">
              <Button
                type="submit"
                disabled={submitting}
                className="bg-gradient-primary hover:opacity-90 text-primary-foreground font-semibold px-8 py-6 text-base shadow-glow"
                size="lg"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Submitting Reference...
                  </>
                ) : (
                  <>
                    <span className="mr-2">✓</span>
                    Submit Reference
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}