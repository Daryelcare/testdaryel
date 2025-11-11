import { JobApplicationData, Declaration } from './types';

// Helper function to validate employment dates
const validateEmploymentDates = (employer: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time for accurate comparison
  
  if (!employer.from || !employer.to) {
    return { valid: false, errors: ['From and To dates are required'] };
  }
  
  const fromDate = new Date(employer.from);
  const toDate = new Date(employer.to);
  
  // Check 1: From date should not be in the future
  if (fromDate > today) {
    errors.push('Start date cannot be in the future');
  }
  
  // Check 2: To date should not be in the future
  if (toDate > today) {
    errors.push('End date cannot be in the future');
  }
  
  // Check 3: From date should be before To date
  if (fromDate >= toDate) {
    errors.push('Start date must be before end date');
  }
  
  // Check 4: Employment duration should be reasonable (not more than 60 years)
  const diffYears = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
  if (diffYears > 60) {
    errors.push('Employment duration seems unrealistic (more than 60 years)');
  }
  
  // Check 5: If leaving date exists, validate it
  if (employer.leavingDate) {
    const leavingDate = new Date(employer.leavingDate);
    
    if (leavingDate < toDate) {
      errors.push('Leaving date should be on or after the end date');
    }
  }
  
  return { valid: errors.length === 0, errors };
};

export const validateStep = (currentStep: number, formData: JobApplicationData, emailUsageCount?: number): boolean => {
  switch (currentStep) {
    case 1: {
      // Personal Info: All required except Street Address Second Line and languages
      const pi = formData.personalInfo;
      // Calculate age from date of birth
      const isAgeValid = pi.dateOfBirth && (() => {
        const birthDate = new Date(pi.dateOfBirth);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear() - 
          (today.getMonth() < birthDate.getMonth() || 
           (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0);
        return age >= 16 && age <= 100;
      })();
      
      const basicValidation = !!(pi.title && pi.fullName && pi.email && pi.confirmEmail && 
               pi.email === pi.confirmEmail && pi.telephone && isAgeValid && 
               pi.streetAddress && pi.town && pi.borough && pi.postcode && 
               pi.englishProficiency && pi.positionAppliedFor && 
               (pi.positionAppliedFor !== 'Support Worker/Carer' || pi.personalCareWillingness) && 
               pi.hasDBS && pi.hasCarAndLicense && 
               pi.nationalInsuranceNumber);
      
      // If emailUsageCount is provided, ensure it's less than 2
      if (emailUsageCount !== undefined && emailUsageCount >= 2) {
        return false;
      }
      
      return basicValidation;
    }
    case 2: {
      return !!(formData.availability.hoursPerWeek && formData.availability.hasRightToWork);
    }
    case 3: {
      return !!(formData.emergencyContact.fullName && formData.emergencyContact.relationship && 
               formData.emergencyContact.contactNumber && formData.emergencyContact.howDidYouHear);
    }
    case 4: {
      // Employment History: If previously employed = yes, must complete Most Recent Employer and all Previous Employers
      if (formData.employmentHistory.previouslyEmployed === 'yes') {
        const re = formData.employmentHistory.recentEmployer;
        
        // Basic field validation
        const recentEmployerValid = !!(re && re.company && re.name && re.email && re.position && 
                 re.address && re.town && re.postcode && re.telephone && 
                 re.from && re.to && re.reasonForLeaving);
        
        if (!recentEmployerValid) return false;
        
        // Date validation for recent employer
        const recentDateValidation = validateEmploymentDates(re);
        if (!recentDateValidation.valid) return false;
        
        // Validate all previous employers
        const prevEmployers = formData.employmentHistory.previousEmployers || [];
        const allPreviousEmployersValid = prevEmployers.every(emp => {
          // Basic fields
          const basicValid = emp.company && emp.name && emp.email && emp.position && 
            emp.address && emp.town && emp.postcode && emp.telephone && 
            emp.from && emp.to && emp.reasonForLeaving;
          
          if (!basicValid) return false;
          
          // Date validation
          const dateValidation = validateEmploymentDates(emp);
          return dateValidation.valid;
        });
        
        return allPreviousEmployersValid;
      }
      return formData.employmentHistory.previouslyEmployed === 'no';
    }
    case 5: {
      // References validation - check required fields for both references
      const ref1 = formData.references.reference1;
      const ref2 = formData.references.reference2;
      
      const isRef1Valid = !!(ref1.name && ref1.company && ref1.jobTitle && ref1.email && 
                            ref1.address && ref1.town && ref1.contactNumber && ref1.postcode);
      const isRef2Valid = !!(ref2.name && ref2.company && ref2.jobTitle && ref2.email && 
                            ref2.address && ref2.town && ref2.contactNumber && ref2.postcode);
      
      return isRef1Valid && isRef2Valid;
    }
    case 6: {
      // Skills & Experience step - always allow to proceed as it's optional
      return true;
    }
    case 7: {
      // Declaration step validation
      const declaration = formData.declaration;
      const requiredFields = [
        'socialServiceEnquiry', 'convictedOfOffence', 'safeguardingInvestigation',
        'criminalConvictions', 'healthConditions', 'cautionsReprimands'
      ];
      
      // Check if all required fields are answered
      const allAnswered = requiredFields.every(field => declaration[field as keyof Declaration]);
      
      if (!allAnswered) return false;
      
      // Check if any "yes" answers have required details
      const needsDetails = [
        { field: 'socialServiceEnquiry', detail: 'socialServiceDetails' },
        { field: 'convictedOfOffence', detail: 'convictedDetails' },
        { field: 'safeguardingInvestigation', detail: 'safeguardingDetails' },
        { field: 'criminalConvictions', detail: 'criminalDetails' },
        { field: 'healthConditions', detail: 'healthDetails' },
        { field: 'cautionsReprimands', detail: 'cautionsDetails' }
      ];
      
      return needsDetails.every(({ field, detail }) => {
        if (declaration[field as keyof Declaration] === 'yes') {
          return !!declaration[detail as keyof Declaration]?.trim();
        }
        return true;
      });
    }
    case 8: {
      return !!(formData.termsPolicy.consentToTerms && formData.termsPolicy.signature && formData.termsPolicy.date);
    }
    default:
      return true;
  }
};