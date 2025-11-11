export interface PersonalInfo {
  title: string;
  fullName: string;
  email: string;
  confirmEmail: string;
  telephone: string;
  dateOfBirth: string;
  streetAddress: string;
  streetAddress2: string;
  town: string;
  borough: string;
  postcode: string;
  englishProficiency: string;
  otherLanguages: string[];
  positionAppliedFor: string;
  personalCareWillingness: string;
  hasDBS: string;
  hasCarAndLicense: string;
  nationalInsuranceNumber: string;
}

export interface Availability {
  timeSlots: Record<string, string[]>; // timeSlotId -> array of selected days
  hoursPerWeek: string;
  hasRightToWork: string;
}

export interface EmergencyContact {
  fullName: string;
  relationship: string;
  contactNumber: string;
  howDidYouHear: string;
}

export interface EmploymentHistory {
  previouslyEmployed: string;
  recentEmployer?: {
    company: string;
    name: string;
    email: string;
    position: string;
    address: string;
    address2: string;
    town: string;
    postcode: string;
    telephone: string;
    from: string;
    to: string;
    leavingDate: string;
    keyTasks: string;
    reasonForLeaving: string;
  };
  previousEmployers?: Array<{
    company: string;
    name: string;
    email: string;
    position: string;
    address: string;
    address2: string;
    town: string;
    postcode: string;
    telephone: string;
    from: string;
    to: string;
    leavingDate: string;
    keyTasks: string;
    reasonForLeaving: string;
  }>;
}

export interface References {
  reference1: {
    name: string;
    company: string;
    jobTitle: string;
    email: string;
    address: string;
    address2: string;
    town: string;
    contactNumber: string;
    postcode: string;
  };
  reference2: {
    name: string;
    company: string;
    jobTitle: string;
    email: string;
    address: string;
    address2: string;
    town: string;
    contactNumber: string;
    postcode: string;
  };
}

export interface SkillsExperience {
  skills: Record<string, 'Good' | 'Basic' | 'None'>;
}

export interface Declaration {
  socialServiceEnquiry: string;
  socialServiceDetails?: string;
  convictedOfOffence: string;
  convictedDetails?: string;
  safeguardingInvestigation: string;
  safeguardingDetails?: string;
  criminalConvictions: string;
  criminalDetails?: string;
  healthConditions: string;
  healthDetails?: string;
  cautionsReprimands: string;
  cautionsDetails?: string;
}

export interface TermsPolicy {
  consentToTerms: boolean;
  signature: string;
  fullName: string;
  date: string;
}

export interface JobApplicationData {
  personalInfo: PersonalInfo;
  availability: Availability;
  emergencyContact: EmergencyContact;
  employmentHistory: EmploymentHistory;
  references: References;
  skillsExperience: SkillsExperience;
  declaration: Declaration;
  termsPolicy: TermsPolicy;
}