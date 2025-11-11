import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, CheckCircle, Shield } from 'lucide-react';
import { CompanyProvider, useCompany } from '@/contexts/CompanyContext';
import { JobApplicationData, PersonalInfo, Availability, EmergencyContact, EmploymentHistory, References, SkillsExperience, Declaration, TermsPolicy } from './types';
import { PersonalInfoStep } from './steps/PersonalInfoStep';
import { AvailabilityStep } from './steps/AvailabilityStep';
import { EmergencyContactStep } from './steps/EmergencyContactStep';
import { EmploymentHistoryStep } from './steps/EmploymentHistoryStep';
import { ReferencesStep } from './steps/ReferencesStep';
import { SkillsExperienceStep } from './steps/SkillsExperienceStep';
import { DeclarationStep } from './steps/DeclarationStep';
import { TermsPolicyStep } from './steps/TermsPolicyStep';
import { generateJobApplicationPdf } from '@/lib/job-application-pdf';
import { validateStep } from './ValidationLogic';
import { StepNavigationCards } from './StepNavigationCards';

const initialFormData: JobApplicationData = {
  personalInfo: {
    title: '',
    fullName: '',
    email: '',
    confirmEmail: '',
    telephone: '',
    dateOfBirth: '',
    streetAddress: '',
    streetAddress2: '',
    town: '',
    borough: '',
    postcode: '',
    englishProficiency: '',
    otherLanguages: [],
    positionAppliedFor: '',
    personalCareWillingness: '',
    hasDBS: '',
    hasCarAndLicense: '',
    nationalInsuranceNumber: '',
  },
  availability: {
    timeSlots: {},
    hoursPerWeek: '',
    hasRightToWork: '',
  },
  emergencyContact: {
    fullName: '',
    relationship: '',
    contactNumber: '',
    howDidYouHear: '',
  },
  employmentHistory: {
    previouslyEmployed: '',
  },
  references: {
    reference1: {
      name: '', company: '', jobTitle: '', email: '', address: '', address2: '', town: '', contactNumber: '', postcode: ''
    },
    reference2: {
      name: '', company: '', jobTitle: '', email: '', address: '', address2: '', town: '', contactNumber: '', postcode: ''
    }
  },
  skillsExperience: { skills: {} },
  declaration: {
    socialServiceEnquiry: '', convictedOfOffence: '', safeguardingInvestigation: '', 
    criminalConvictions: '', healthConditions: '', cautionsReprimands: ''
  },
  termsPolicy: { consentToTerms: false, signature: '', fullName: '', date: '' }
};

function JobApplicationPortalContent() {
const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<JobApplicationData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [honeypotField, setHoneypotField] = useState('');
  const [startTime] = useState(Date.now());
  const [isEmailValid, setIsEmailValid] = useState(true);
  const [emailUsageCount, setEmailUsageCount] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const { companySettings } = useCompany();
  const { toast } = useToast();

  const DRAFT_KEY = 'job_application_draft';

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.formData) setFormData(saved.formData);
        if (saved?.currentStep) setCurrentStep(saved.currentStep);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ formData, currentStep }));
    } catch {}
  }, [formData, currentStep]);

  // Auto-fill Terms & Policy fields when reaching step 8
  useEffect(() => {
    if (currentStep === 8) {
      // Auto-fill signature with full name if not already filled
      if (formData.personalInfo.fullName && !formData.termsPolicy.signature) {
        updateTermsPolicy('signature', formData.personalInfo.fullName);
      }
      
      // Auto-fill date with today's date if not already filled
      if (!formData.termsPolicy.date) {
        const today = new Date().toISOString().split('T')[0];
        updateTermsPolicy('date', today);
      }
    }
  }, [currentStep, formData.personalInfo.fullName, formData.termsPolicy.signature, formData.termsPolicy.date]);

  const totalSteps = 8;

  const updatePersonalInfo = (field: keyof PersonalInfo, value: string | string[]) => {
    setFormData(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, [field]: value } }));
  };

  const updateAvailability = (field: keyof Availability, value: string | Record<string, string[]>) => {
    setFormData(prev => ({ ...prev, availability: { ...prev.availability, [field]: value } }));
  };

  const updateEmergencyContact = (field: keyof EmergencyContact, value: string) => {
    setFormData(prev => ({ ...prev, emergencyContact: { ...prev.emergencyContact, [field]: value } }));
  };

  const updateEmploymentHistory = (field: keyof EmploymentHistory, value: any) => {
    setFormData(prev => ({ ...prev, employmentHistory: { ...prev.employmentHistory, [field]: value } }));
  };

  const updateReferences = (field: keyof References, value: any) => {
    setFormData(prev => ({ ...prev, references: { ...prev.references, [field]: value } }));
  };

  const updateSkillsExperience = (field: keyof SkillsExperience, value: any) => {
    setFormData(prev => ({ ...prev, skillsExperience: { ...prev.skillsExperience, [field]: value } }));
  };

  const updateDeclaration = (field: keyof Declaration, value: string) => {
    setFormData(prev => ({ ...prev, declaration: { ...prev.declaration, [field]: value } }));
  };

  const updateTermsPolicy = (field: keyof TermsPolicy, value: string | boolean) => {
    setFormData(prev => ({ ...prev, termsPolicy: { ...prev.termsPolicy, [field]: value } }));
  };

const handleDownloadPdf = async () => {
    try {
      await generateJobApplicationPdf(formData, {
        logoUrl: companySettings.logo,
        companyName: companySettings.name,
      });
    } catch (err) {
      console.error('PDF generation failed', err);
      toast({ title: 'PDF Error', description: 'Failed to generate PDF. Please try again.', variant: 'destructive' });
    }
  };

  const handleDownloadJson = () => {
    try {
      const blob = new Blob([JSON.stringify(formData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'job-application.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('JSON download failed', err);
      toast({ title: 'Download Error', description: 'Failed to download JSON.', variant: 'destructive' });
    }
  };

  const nextStep = () => {
    if (currentStep < totalSteps && canProceed()) {
      // Mark current step as completed
      if (!completedSteps.includes(currentStep)) {
        setCompletedSteps(prev => [...prev, currentStep]);
      }
      setCurrentStep(prev => prev + 1);
    }
  };

  const goToStep = (step: number) => {
    // Can only go to completed steps or the next step after the last completed
    const maxAccessibleStep = Math.max(...completedSteps, 0) + 1;
    if (step <= maxAccessibleStep && step <= totalSteps) {
      setCurrentStep(step);
    }
  };

  const canAccessStep = (step: number) => {
    // Can access completed steps or the next step after the last completed
    const maxAccessibleStep = Math.max(...completedSteps, 0) + 1;
    return step <= maxAccessibleStep;
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Anti-abuse checks
      // 1. Honeypot field check
      if (honeypotField.trim() !== '') {
        console.warn('Bot detected: honeypot field filled');
        toast({
          title: "Submission Failed",
          description: "Please try again later.",
          variant: "destructive",
        });
        return;
      }

      // 2. Time-based validation (submissions too fast are suspicious)
      const timeTaken = Date.now() - startTime;
      if (timeTaken < 30000) { // Less than 30 seconds
        console.warn('Bot detected: submission too fast');
        toast({
          title: "Submission Failed", 
          description: "Please take your time to complete the application.",
          variant: "destructive",
        });
        return;
      }

      // 3. Email duplicate detection
      const { data: existingApplications, error: checkError } = await supabase
        .from('job_applications')
        .select('id')
        .filter('personal_info->>email', 'eq', formData.personalInfo.email)
        .limit(3);

      if (checkError) {
        console.error('Error checking duplicates:', checkError);
      } else if (existingApplications && existingApplications.length >= 2) {
        toast({
          title: "Application Limit Reached",
          description: "This email address has already been used for the maximum number of applications (2). Please contact us directly if you need assistance.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('job_applications')
        .insert([{
          personal_info: formData.personalInfo,
          availability: formData.availability,
          emergency_contact: formData.emergencyContact,
          employment_history: formData.employmentHistory,
          reference_info: formData.references,
          skills_experience: formData.skillsExperience,
          declarations: formData.declaration,
          consent: formData.termsPolicy,
          status: 'new'
        }] as any);

      if (error) throw error;

      setIsSubmitted(true);
      // Clear the draft after successful submission
      localStorage.removeItem(DRAFT_KEY);
      toast({
        title: "Application Submitted",
        description: "Your job application has been submitted successfully. We'll be in touch soon!",
      });
    } catch (error) {
      console.error('Error submitting application:', error);
      toast({
        title: "Submission Failed",
        description: "There was an error submitting your application. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-3 sm:p-6 bg-gradient-to-br from-primary/5 to-secondary/5">
        <Card className="w-full max-w-md mx-4 sm:mx-auto shadow-lg">
          <CardHeader className="text-center pb-4">
            <CheckCircle className="w-12 h-12 sm:w-16 sm:h-16 text-green-500 mx-auto mb-4" />
            <CardTitle className="text-xl sm:text-2xl text-green-700">Application Submitted!</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4 p-4 sm:p-6">
            <p className="text-sm sm:text-base text-muted-foreground">
              Thank you for your interest in joining our team. We have received your application and will review it shortly.
            </p>
            <Button onClick={() => {
              // Reset form data and redirect to start fresh application
              setFormData(initialFormData);
              setCurrentStep(1);
              setIsSubmitted(false);
              window.location.href = '/';
            }} className="w-full min-h-[44px]">
              Return to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <PersonalInfoStep
            data={formData.personalInfo}
            updateData={updatePersonalInfo}
            onEmailValidationChange={(isValid, usageCount) => {
              setIsEmailValid(isValid);
              setEmailUsageCount(usageCount || 0);
            }}
          />
        );
      case 2:
        return <AvailabilityStep data={formData.availability} updateData={updateAvailability} />;
      case 3:
        return <EmergencyContactStep data={formData.emergencyContact} updateData={updateEmergencyContact} />;
      case 4:
        return <EmploymentHistoryStep data={formData.employmentHistory} updateData={updateEmploymentHistory} />;
      case 5:
        return <ReferencesStep data={formData.references} employmentHistory={formData.employmentHistory} updateData={updateReferences} updateEmploymentHistory={updateEmploymentHistory} />;
      case 6:
        return <SkillsExperienceStep data={formData.skillsExperience} updateData={updateSkillsExperience} />;
      case 7:
        return <DeclarationStep data={formData.declaration} updateData={updateDeclaration} />;
      case 8:
        return <TermsPolicyStep data={formData.termsPolicy} updateData={updateTermsPolicy} />;
      default:
        return null;
    }
  };

  const getStepTitle = () => {
    const titles = [
      'Personal Information',
      'Availability',
      'Emergency Contact',
      'Employment History',
      'References',
      'Skills & Experience',
      'Declaration',
      'Terms & Policy'
    ];
    return titles[currentStep - 1];
  };

  const canProceed = () => {
    if (currentStep === 1) {
      return validateStep(currentStep, formData, emailUsageCount) && isEmailValid;
    }
    return validateStep(currentStep, formData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 p-3 sm:p-6">
      <div className="max-w-2xl mx-auto">
        {/* Company Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-4">
            {companySettings.logo ? (
              <img
                src={companySettings.logo}
                alt={companySettings.name}
                className="h-10 w-10 sm:h-12 sm:w-12 object-contain"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="h-10 w-10 sm:h-12 sm:w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              </div>
            )}
            <div className="text-center sm:text-left">
              <div className="text-xl sm:text-2xl font-bold">{companySettings.name}</div>
              <p className="text-sm sm:text-base text-muted-foreground">{companySettings.tagline}</p>
            </div>
          </div>
        </div>

        <div className="mb-6 sm:mb-8">
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              variant="ghost"
              onClick={() => window.history.back()}
              className="text-sm sm:text-base"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Homepage
            </Button>
          </div>
          
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">Job Application</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Complete all steps to submit your application</p>
          </div>

          {/* Step Navigation Cards */}
          <StepNavigationCards
            currentStep={currentStep}
            totalSteps={totalSteps}
            completedSteps={completedSteps}
            onStepClick={goToStep}
            canAccessStep={canAccessStep}
          />
        </div>

        <Card className="shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg sm:text-xl">{getStepTitle()}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {renderStep()}
            
            {/* Invisible honeypot field */}
            <div style={{ position: 'absolute', left: '-9999px', visibility: 'hidden' }} aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input
                id="website"
                name="website"
                type="text"
                value={honeypotField}
                onChange={(e) => setHoneypotField(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6 sm:mt-8">
              {currentStep === totalSteps ? (
                <Button
                  onClick={handleSubmit}
                  disabled={!canProceed() || isSubmitting}
                  className="w-full sm:w-auto min-h-[44px]"
                  size="lg"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Application'}
                  <CheckCircle className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={nextStep}
                  disabled={!canProceed()}
                  className="w-full sm:w-auto min-h-[44px]"
                  size="lg"
                >
                  Continue to Next Step
                  <CheckCircle className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function JobApplicationPortal() {
  return (
    <CompanyProvider>
      <JobApplicationPortalContent />
    </CompanyProvider>
  );
}