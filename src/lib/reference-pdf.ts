import jsPDF from 'jspdf';

interface ReferenceData {
  refereeFullName: string;
  refereeJobTitle?: string;
  
  // Employment reference specific
  employmentStatus?: string; // current, previous, or neither
  relationshipDescription?: string;
  jobTitle?: string;
  startDate?: string;
  endDate?: string;
  attendance?: string;
  leavingReason?: string;
  
  // Common checkbox qualities
  honestTrustworthy?: boolean;
  communicatesEffectively?: boolean;
  effectiveTeamMember?: boolean;
  respectfulConfidentiality?: boolean;
  reliablePunctual?: boolean;
  suitablePosition?: boolean;
  kindCompassionate?: boolean;
  worksIndependently?: boolean;
  
  // If any qualities not ticked
  qualitiesNotTickedReason?: string;
  
  // Criminal/legal questions
  convictionsKnown?: string;
  criminalProceedingsKnown?: string;
  criminalDetails?: string;
  
  // Final comments and signature
  additionalComments?: string;
  signatureDate?: string;
}

interface CompletedReference {
  id: string;
  reference_name: string;
  reference_type: string;
  form_data: ReferenceData;
  completed_at: string;
  created_at: string;
  sent_at: string;
  application_id: string;
}

interface CompanySettings {
  name: string;
  logo?: string;
}

export const generateReferencePDF = async (
  reference: CompletedReference,
  applicantName: string,
  applicantDOB: string,
  applicantPostcode: string,
  companySettings: CompanySettings = { name: 'Company Name' }
) => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15; // Content margin inside border
  const lineHeight = 7;
  let yPosition = 25; // Start closer to border

  // Set font to support Unicode characters
  pdf.setFont('helvetica', 'normal');

  // Add page border
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.5);
  pdf.rect(10, 10, pageWidth - 20, pageHeight - 20);

  // Helper function to ensure space on page
  const ensureSpace = (needed: number) => {
    if (yPosition + needed > pageHeight - 25) { // Account for border
      pdf.addPage();
      // Add border to new page
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.5);
      pdf.rect(10, 10, pageWidth - 20, pageHeight - 20);
      yPosition = 25; // Start closer to border on new page
    }
  };

  // Add company logo if available
  if (companySettings.logo) {
    try {
      // Create a temporary image to get dimensions
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = companySettings.logo!;
      });
      
      // Calculate scaling to maintain aspect ratio
      const maxWidth = 50;
      const maxHeight = 25;
      const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
      const logoWidth = img.width * scale;
      const logoHeight = img.height * scale;
      const logoX = (pageWidth / 2) - (logoWidth / 2);
      
      // Determine image type and add to PDF
      const format = companySettings.logo.toLowerCase().includes('.png') ? 'PNG' : 'JPEG';
      pdf.addImage(companySettings.logo, format, logoX, yPosition - 5, logoWidth, logoHeight);
      yPosition += logoHeight + 10;
    } catch (error) {
      console.error('Error adding logo to PDF:', error);
      // If logo fails, just add some spacing
      yPosition += 5;
    }
  }

  // Add company name
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text(companySettings.name, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 12;

  // Helper function to add text with word wrap
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 11): number => {
    pdf.setFontSize(fontSize);
    const lines = pdf.splitTextToSize(text, maxWidth);
    pdf.text(lines, x, y);
    return y + (lines.length * lineHeight);
  };

  // Header
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  const referenceType = reference.reference_type === 'employer' ? 'Employment reference for' : 'Character reference for';
  pdf.text(referenceType, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 12;

  // Applicant Information - Horizontal Layout
  pdf.setFontSize(12);
  
  // Name
  pdf.setFont('helvetica', 'bold');
  pdf.text('Name:', margin, yPosition);
  const nameLabelWidth = pdf.getTextWidth('Name:');
  pdf.setFont('helvetica', 'normal');
  pdf.text(` ${applicantName}`, margin + nameLabelWidth, yPosition);
  const nameWidth = pdf.getTextWidth(`Name: ${applicantName}`);
  
  // Date of Birth
  pdf.setFont('helvetica', 'bold');
  pdf.text('Date of Birth:', margin + nameWidth + 20, yPosition);
  const dobLabelWidth = pdf.getTextWidth('Date of Birth:');
  pdf.setFont('helvetica', 'normal');
  pdf.text(` ${applicantDOB}`, margin + nameWidth + 20 + dobLabelWidth, yPosition);
  const dobWidth = pdf.getTextWidth(`Date of Birth: ${applicantDOB}`);
  
  // Postcode
  pdf.setFont('helvetica', 'bold');
  pdf.text('Postcode:', margin + nameWidth + dobWidth + 40, yPosition);
  const postcodeLabelWidth = pdf.getTextWidth('Postcode:');
  pdf.setFont('helvetica', 'normal');
  pdf.text(` ${applicantPostcode}`, margin + nameWidth + dobWidth + 40 + postcodeLabelWidth, yPosition);
  yPosition += 15;

  // Referee Information
  pdf.setFont('helvetica', 'bold');
  pdf.text('Referee Name:', margin, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(reference.form_data.refereeFullName || '', margin + 70, yPosition);
  
  if (reference.form_data.refereeJobTitle) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('Job Title:', margin + 200, yPosition);
    pdf.setFont('helvetica', 'normal');
    pdf.text(reference.form_data.refereeJobTitle, margin + 250, yPosition);
  }
  yPosition += 15;

  // Reference specific content
  ensureSpace(60);
  if (reference.reference_type === 'employer') {
  // Employment Status
  pdf.setFont('helvetica', 'bold');
  pdf.text('Are you this person\'s current or previous employer?', margin, yPosition);
  yPosition += lineHeight;
  pdf.setFont('helvetica', 'normal');
  const currentBox = reference.form_data.employmentStatus === 'current' ? '[X]' : '[ ]';
  const previousBox = reference.form_data.employmentStatus === 'previous' ? '[X]' : '[ ]';
  const neitherBox = reference.form_data.employmentStatus === 'neither' ? '[X]' : '[ ]';
  pdf.text(`${currentBox} Current    ${previousBox} Previous    ${neitherBox} Neither`, margin, yPosition);
  yPosition += lineHeight + 2;

    // Relationship Description
    ensureSpace(25);
    pdf.setFont('helvetica', 'bold');
    pdf.text('What is your relationship to this person (e.g. "I am her/his manager")?', margin, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');
    yPosition = addWrappedText(`${reference.form_data.relationshipDescription || 'Not provided'}`, margin, yPosition, pageWidth - 2 * margin);
    yPosition += 2;

    // Job Title
    ensureSpace(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Please state the person\'s job title:', margin, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${reference.form_data.jobTitle || 'Not provided'}`, margin, yPosition);
    yPosition += lineHeight + 2;

    // Employment Dates
    ensureSpace(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Employment Period:', margin, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');
    const startDate = reference.form_data.startDate ? new Date(reference.form_data.startDate).toLocaleDateString() : 'Not provided';
    const endDate = reference.form_data.endDate ? new Date(reference.form_data.endDate).toLocaleDateString() : 'Not provided';
    pdf.text(`From ${startDate} to ${endDate}`, margin, yPosition);
    yPosition += lineHeight + 2;

    // Attendance
    ensureSpace(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('How would you describe their recent attendance record?', margin, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');
    const goodBox = reference.form_data.attendance === 'good' ? '[X]' : '[ ]';
    const averageBox = reference.form_data.attendance === 'average' ? '[X]' : '[ ]';
    const poorBox = reference.form_data.attendance === 'poor' ? '[X]' : '[ ]';
    pdf.text(`${goodBox} Good    ${averageBox} Average    ${poorBox} Poor`, margin, yPosition);
    yPosition += lineHeight + 2;

    // Leaving Reason
    ensureSpace(30);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Why did the person leave your employment (if they are still employed, please write \'still employed\')?', margin, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');
    yPosition = addWrappedText(`${reference.form_data.leavingReason || 'Not provided'}`, margin, yPosition, pageWidth - 2 * margin);
    yPosition += 2;
  } else {
    // Character reference specific content
    ensureSpace(40);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Do you know this person from outside employment or education?', margin, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');
    const outsideYesBox = reference.form_data.employmentStatus === 'yes' ? '[X]' : '[ ]';
    const outsideNoBox = reference.form_data.employmentStatus === 'no' ? '[X]' : '[ ]';
    pdf.text(`${outsideYesBox} Yes    ${outsideNoBox} No`, margin, yPosition);
    yPosition += lineHeight + 5;

    pdf.setFont('helvetica', 'bold');
    pdf.text('Please describe your relationship with this person, including how long you have known them:', margin, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');
    yPosition = addWrappedText(`${reference.form_data.relationshipDescription || 'Not provided'}`, margin, yPosition, pageWidth - 2 * margin);
    yPosition += 5;
  }

  // Character qualities - Horizontal layout in 2 columns
  ensureSpace(60);
  pdf.setFont('helvetica', 'bold');
  pdf.text('In your opinion, which of the following describes this person (tick each that is true)?', margin, yPosition);
  yPosition += lineHeight + 3;

  const qualities = [
    { key: 'honestTrustworthy', label: 'Honest and trustworthy' },
    { key: 'communicatesEffectively', label: 'Communicates effectively' },
    { key: 'effectiveTeamMember', label: 'An effective team member' },
    { key: 'respectfulConfidentiality', label: 'Respectful of confidentiality' },
    { key: 'reliablePunctual', label: 'Reliable and punctual' },
    { key: 'suitablePosition', label: 'Suitable for the position applied for' },
    { key: 'kindCompassionate', label: 'Kind and compassionate' },
    { key: 'worksIndependently', label: 'Able to work well without close supervision' },
  ];

  pdf.setFont('helvetica', 'normal');
  
  // Display qualities in 2 columns
  const columnWidth = (pageWidth - 2 * margin) / 2;
  for (let i = 0; i < qualities.length; i += 2) {
    ensureSpace(8);
    
    // Left column quality
    const leftQuality = qualities[i];
    const leftChecked = reference.form_data[leftQuality.key as keyof ReferenceData];
    const leftCheckbox = leftChecked ? '[X]' : '[ ]';
    pdf.text(leftCheckbox, margin, yPosition);
    pdf.text(leftQuality.label, margin + 10, yPosition);
    
    // Right column quality (if exists)
    if (i + 1 < qualities.length) {
      const rightQuality = qualities[i + 1];
      const rightChecked = reference.form_data[rightQuality.key as keyof ReferenceData];
      const rightCheckbox = rightChecked ? '[X]' : '[ ]';
      const rightStartX = margin + columnWidth;
      pdf.text(rightCheckbox, rightStartX, yPosition);
      pdf.text(rightQuality.label, rightStartX + 10, yPosition);
    }
    
    yPosition += lineHeight;
  }

  // Qualities not ticked reason
  ensureSpace(30);
  yPosition += 3;
  pdf.setFont('helvetica', 'bold');
  pdf.text('If you did not tick one or more of the above, please tell us why here:', margin, yPosition);
  yPosition += lineHeight;
  pdf.setFont('helvetica', 'normal');
  yPosition = addWrappedText(`${reference.form_data.qualitiesNotTickedReason || 'Not provided'}`, margin, yPosition, pageWidth - 2 * margin);
  yPosition += 5;

  // Criminal background questions - CRITICAL SECTION
  ensureSpace(100);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text('CRIMINAL BACKGROUND CHECK', margin, yPosition);
  yPosition += lineHeight + 3;
  
  pdf.setFontSize(11);
  yPosition = addWrappedText('The position this person has applied for involves working with vulnerable people. Are you aware of any convictions, cautions, reprimands or final warnings that the person may have received that are not \'protected\' as defined by the Rehabilitation of Offenders Act 1974 (Exceptions) Order 1975 (as amended in 2013 by SI 210 1198)?', margin, yPosition, pageWidth - 2 * margin, 11);
  yPosition += 3;
  pdf.setFont('helvetica', 'normal');
  const convictionsYesBox = reference.form_data.convictionsKnown === 'yes' ? '[X]' : '[ ]';
  const convictionsNoBox = reference.form_data.convictionsKnown === 'no' ? '[X]' : '[ ]';
  const convictionsAnswer = reference.form_data.convictionsKnown ? `${convictionsYesBox} Yes    ${convictionsNoBox} No` : 'Not answered';
  pdf.text(convictionsAnswer, margin, yPosition);
  yPosition += lineHeight + 8;

  ensureSpace(50);
  pdf.setFont('helvetica', 'bold');
  yPosition = addWrappedText('To your knowledge, is this person currently the subject of any criminal proceedings (for example, charged or summoned but not yet dealt with) or any police investigation?', margin, yPosition, pageWidth - 2 * margin, 11);
  yPosition += 3;
  pdf.setFont('helvetica', 'normal');
  const proceedingsYesBox = reference.form_data.criminalProceedingsKnown === 'yes' ? '[X]' : '[ ]';
  const proceedingsNoBox = reference.form_data.criminalProceedingsKnown === 'no' ? '[X]' : '[ ]';
  const proceedingsAnswer = reference.form_data.criminalProceedingsKnown ? `${proceedingsYesBox} Yes    ${proceedingsNoBox} No` : 'Not answered';
  pdf.text(proceedingsAnswer, margin, yPosition);
  yPosition += lineHeight + 8;

  // Criminal details if provided
  if (reference.form_data.convictionsKnown === 'yes' || reference.form_data.criminalProceedingsKnown === 'yes' || reference.form_data.criminalDetails) {
    ensureSpace(40);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Details provided:', margin, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');
    yPosition = addWrappedText(`${reference.form_data.criminalDetails || 'Not provided'}`, margin, yPosition, pageWidth - 2 * margin);
    yPosition += 10;
  }

  // Additional Comments
  ensureSpace(40);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Any additional comments you would like to make about this person:', margin, yPosition);
  yPosition += lineHeight;
  pdf.setFont('helvetica', 'normal');
  yPosition = addWrappedText(`${reference.form_data.additionalComments || 'Not provided'}`, margin, yPosition, pageWidth - 2 * margin);
  yPosition += 10;

  // Declaration and Date
  ensureSpace(30);
  pdf.setFont('helvetica', 'bold');
  pdf.text('DECLARATION', margin, yPosition);
  yPosition += lineHeight + 3;
  pdf.setFont('helvetica', 'normal');
  const declarationText = 'I certify that, to the best of my knowledge, the information I have given is true and complete. I understand that any deliberate omission, falsification or misrepresentation may lead to refusal of appointment or dismissal.';
  yPosition = addWrappedText(declarationText, margin, yPosition, pageWidth - 2 * margin);
  yPosition += 8;

  // Referee Information
  ensureSpace(70);
  pdf.setFont('helvetica', 'bold');
  pdf.text('REFEREE INFORMATION', margin, yPosition);
  yPosition += lineHeight + 3;
  
  pdf.setFont('helvetica', 'bold');
  pdf.text('Referee Name:', margin, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(reference.form_data.refereeFullName || '', margin + 110, yPosition);
  yPosition += lineHeight;

  pdf.setFont('helvetica', 'bold');
  pdf.text('Referee Job Title:', margin, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(reference.form_data.refereeJobTitle || '', margin + 110, yPosition);
  yPosition += lineHeight;

  pdf.setFont('helvetica', 'bold');
  pdf.text('Reference Created:', margin, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(new Date(reference.created_at).toLocaleDateString(), margin + 110, yPosition);
  yPosition += lineHeight;

  pdf.setFont('helvetica', 'bold');
  pdf.text('Reference Sent:', margin, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(new Date(reference.sent_at).toLocaleDateString(), margin + 110, yPosition);
  yPosition += lineHeight;

  pdf.setFont('helvetica', 'bold');
  pdf.text('Reference Completed:', margin, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(new Date(reference.completed_at).toLocaleDateString(), margin + 110, yPosition);
  yPosition += lineHeight + 5;

  return pdf;
};

export interface ManualReferenceInput {
  applicantName: string;
  applicantPosition?: string;
  referenceType: 'employer' | 'character';
  applicantDOB?: string;
  applicantPostcode?: string;
  employmentFrom?: string;
  employmentTo?: string;
  reasonForLeaving?: string;
  employmentStatus?: 'current' | 'previous' | 'neither';
  referenceNumber?: number;
  referee: {
    name?: string;
    company?: string;
    jobTitle?: string;
    email?: string;
    phone?: string;
    address?: string;
    town?: string;
    postcode?: string;
  };
}

export const generateManualReferencePDF = async (
  data: ManualReferenceInput,
  companySettings: CompanySettings = { name: 'Company Name' }
) => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15; // Content margin inside border
  const lineHeight = 7;
  let yPosition = 25; // Start closer to border

  // Set font to support Unicode characters
  pdf.setFont('helvetica', 'normal');

  // Add page border
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.5);
  pdf.rect(10, 10, pageWidth - 20, pageHeight - 20);

  // Add company logo if available
  if (companySettings.logo) {
    try {
      // Create a temporary image to get dimensions
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = companySettings.logo!;
      });
      
      // Calculate scaling to maintain aspect ratio
      const maxWidth = 50;
      const maxHeight = 25;
      const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
      const logoWidth = img.width * scale;
      const logoHeight = img.height * scale;
      const logoX = (pageWidth / 2) - (logoWidth / 2);
      
      // Determine image type and add to PDF
      const format = companySettings.logo.toLowerCase().includes('.png') ? 'PNG' : 'JPEG';
      pdf.addImage(companySettings.logo, format, logoX, yPosition - 5, logoWidth, logoHeight);
      yPosition += logoHeight + 10;
    } catch (error) {
      console.error('Error adding logo to PDF:', error);
      // If logo fails, just add some spacing
      yPosition += 5;
    }
  }

  // Add company name
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text(companySettings.name, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 12;

  // Helper function to add text with word wrap
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 11): number => {
    pdf.setFontSize(fontSize);
    const lines = pdf.splitTextToSize(text, maxWidth);
    pdf.text(lines, x, y);
    return y + (lines.length * lineHeight);
  };

  // Helper function to ensure space on page
  const ensureSpace = (needed: number) => {
    if (yPosition + needed > pageHeight - 25) { // Account for border
      pdf.addPage();
      // Add border to new page
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.5);
      pdf.rect(10, 10, pageWidth - 20, pageHeight - 20);
      yPosition = 25; // Start closer to border on new page
    }
  };

  // Title
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  const referenceTitle = data.referenceType === 'employer' ? 'Employment reference for' : 'Character reference for';
  pdf.text(referenceTitle, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 12;

  // Basic Information - Horizontal Layout
  pdf.setFontSize(12);
  
  // Name
  pdf.setFont('helvetica', 'bold');
  pdf.text('Name:', margin, yPosition);
  const nameLabelWidth = pdf.getTextWidth('Name:');
  pdf.setFont('helvetica', 'normal');
  pdf.text(` ${data.applicantName}`, margin + nameLabelWidth, yPosition);
  const nameWidth = pdf.getTextWidth(`Name: ${data.applicantName}`);
  
  // Date of Birth
  pdf.setFont('helvetica', 'bold');
  pdf.text('Date of Birth:', margin + nameWidth + 20, yPosition);
  const dobLabelWidth = pdf.getTextWidth('Date of Birth:');
  pdf.setFont('helvetica', 'normal');
  pdf.text(` ${data.applicantDOB || ''}`, margin + nameWidth + 20 + dobLabelWidth, yPosition);
  const dobWidth = pdf.getTextWidth(`Date of Birth: ${data.applicantDOB || ''}`);
  
  // Postcode
  pdf.setFont('helvetica', 'bold');
  pdf.text('Postcode:', margin + nameWidth + dobWidth + 40, yPosition);
  const postcodeLabelWidth = pdf.getTextWidth('Postcode:');
  pdf.setFont('helvetica', 'normal');
  pdf.text(` ${data.applicantPostcode || ''}`, margin + nameWidth + dobWidth + 40 + postcodeLabelWidth, yPosition);
  yPosition += 15;

  // Referee Information
  pdf.setFont('helvetica', 'bold');
  pdf.text('Referee Name:', margin, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(data.referee.name || '', margin + 70, yPosition);
  
  if (data.referee.jobTitle) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('Job Title:', margin + 200, yPosition);
    pdf.setFont('helvetica', 'normal');
    pdf.text(data.referee.jobTitle, margin + 250, yPosition);
  }
  yPosition += 15;

  // Reference specific content
  ensureSpace(60);
  if (data.referenceType === 'employer') {
    // Employment Status with proper checkboxes
    pdf.setFont('helvetica', 'bold');
    pdf.text('Are you this person\'s current or previous employer?', margin, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');
    
    const currentCheck = data.employmentStatus === 'current' ? '[X]' : '[ ]';
    const previousCheck = data.employmentStatus === 'previous' ? '[X]' : '[ ]';
    const neitherCheck = data.employmentStatus === 'neither' ? '[X]' : '[ ]';
    pdf.text(`${currentCheck} Current    ${previousCheck} Previous    ${neitherCheck} Neither`, margin, yPosition);
    yPosition += lineHeight + 2;

    // Relationship Description - prefill with Referee Job Title
    ensureSpace(25);
    pdf.setFont('helvetica', 'bold');
    pdf.text('What is your relationship to this person (e.g. "I am her/his manager")?', margin, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');
    yPosition = addWrappedText(`${data.referee.jobTitle || ''}`, margin, yPosition, pageWidth - 2 * margin);
    yPosition += 2;

    // Job Title
    ensureSpace(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Please state the person\'s job title:', margin, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${data.applicantPosition || ''}`, margin, yPosition);
    yPosition += lineHeight + 2;

    // Employment Dates
    ensureSpace(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Employment Period:', margin, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');
    const startDate = data.employmentFrom || '';
    const endDate = data.employmentTo || '';
    pdf.text(`From ${startDate} to ${endDate}`, margin, yPosition);
    yPosition += lineHeight + 2;

    // Attendance - leave unchecked
    ensureSpace(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('How would you describe their recent attendance record?', margin, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');
    pdf.text('[X] Good    [ ] Average    [ ] Poor', margin, yPosition);
    yPosition += lineHeight + 2;

    // Leaving Reason
    ensureSpace(30);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Why did the person leave your employment (if they are still employed, please write \'still employed\')?', margin, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');
    yPosition = addWrappedText(`${data.reasonForLeaving || ''}`, margin, yPosition, pageWidth - 2 * margin);
    yPosition += 2;
  } else {
    // Character reference specific content
    ensureSpace(40);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Do you know this person from outside employment or education?', margin, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');
    pdf.text('[X] Yes    [ ] No', margin, yPosition);
    yPosition += lineHeight + 5;

    pdf.setFont('helvetica', 'bold');
    pdf.text('Please describe your relationship with this person, including how long you have known them:', margin, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');
    yPosition = addWrappedText('', margin, yPosition, pageWidth - 2 * margin);
    yPosition += 5;
  }

  // Character qualities - Horizontal layout in 2 columns
  ensureSpace(60);
  pdf.setFont('helvetica', 'bold');
  pdf.text('In your opinion, which of the following describes this person (tick each that is true)?', margin, yPosition);
  yPosition += lineHeight + 3;

  const qualities = [
    'Honest and trustworthy',
    'Communicates effectively',
    'An effective team member',
    'Respectful of confidentiality',
    'Reliable and punctual',
    'Suitable for the position applied for',
    'Kind and compassionate',
    'Able to work well without close supervision',
  ];

  pdf.setFont('helvetica', 'normal');
  
  // Display qualities in 2 columns - leave unchecked by default
  const columnWidth = (pageWidth - 2 * margin) / 2;
  for (let i = 0; i < qualities.length; i += 2) {
    ensureSpace(8);
    
    // Left column quality - preselected
    pdf.text('[X]', margin, yPosition);
    pdf.text(qualities[i], margin + 15, yPosition);
    
    // Right column quality (if exists) - preselected
    if (i + 1 < qualities.length) {
      const rightStartX = margin + columnWidth;
      pdf.text('[X]', rightStartX, yPosition);
      pdf.text(qualities[i + 1], rightStartX + 15, yPosition);
    }
    
    yPosition += lineHeight;
  }

  // Qualities not ticked reason
  ensureSpace(30);
  yPosition += 3;
  pdf.setFont('helvetica', 'bold');
  pdf.text('If you did not tick one or more of the above, please tell us why here:', margin, yPosition);
  yPosition += lineHeight;
  pdf.setFont('helvetica', 'normal');
  yPosition = addWrappedText('Not provided', margin, yPosition, pageWidth - 2 * margin);
  yPosition += 5;

  // Criminal background questions - CRITICAL SECTION
  ensureSpace(100);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text('CRIMINAL BACKGROUND CHECK', margin, yPosition);
  yPosition += lineHeight + 3;
  
  pdf.setFontSize(11);
  yPosition = addWrappedText('The position this person has applied for involves working with vulnerable people. Are you aware of any convictions, cautions, reprimands or final warnings that the person may have received that are not \'protected\' as defined by the Rehabilitation of Offenders Act 1974 (Exceptions) Order 1975 (as amended in 2013 by SI 210 1198)?', margin, yPosition, pageWidth - 2 * margin, 11);
  yPosition += 3;
  pdf.setFont('helvetica', 'normal');
  pdf.text('[ ] Yes    [X] No', margin, yPosition);
  yPosition += lineHeight + 8;

  ensureSpace(50);
  pdf.setFont('helvetica', 'bold');
  yPosition = addWrappedText('To your knowledge, is this person currently the subject of any criminal proceedings (for example, charged or summoned but not yet dealt with) or any police investigation?', margin, yPosition, pageWidth - 2 * margin, 11);
  yPosition += 3;
  pdf.setFont('helvetica', 'normal');
  pdf.text('[ ] Yes    [X] No', margin, yPosition);
  yPosition += lineHeight + 8;

  // Additional Comments
  ensureSpace(40);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Any additional comments you would like to make about this person:', margin, yPosition);
  yPosition += lineHeight;
  pdf.setFont('helvetica', 'normal');
  yPosition = addWrappedText('Not provided', margin, yPosition, pageWidth - 2 * margin);
  yPosition += 10;

  // Declaration and Date
  ensureSpace(30);
  pdf.setFont('helvetica', 'bold');
  pdf.text('DECLARATION', margin, yPosition);
  yPosition += lineHeight + 3;
  pdf.setFont('helvetica', 'normal');
  const declarationText = 'I certify that, to the best of my knowledge, the information I have given is true and complete. I understand that any deliberate omission, falsification or misrepresentation may lead to refusal of appointment or dismissal.';
  yPosition = addWrappedText(declarationText, margin, yPosition, pageWidth - 2 * margin);
  yPosition += 8;

  // Referee Information
  ensureSpace(70);
  pdf.setFont('helvetica', 'bold');
  pdf.text('REFEREE INFORMATION', margin, yPosition);
  yPosition += lineHeight + 3;
  
  pdf.setFont('helvetica', 'bold');
  pdf.text('Referee Name:', margin, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(data.referee.name || '', margin + 110, yPosition);
  yPosition += lineHeight;

  pdf.setFont('helvetica', 'bold');
  pdf.text('Referee Job Title:', margin, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(data.referee.jobTitle || '', margin + 110, yPosition);
  yPosition += lineHeight;

  const createdKey = `{R${data.referenceNumber || 1}_Created}`;
  pdf.setFont('helvetica', 'bold');
  pdf.text('Reference Created:', margin, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(createdKey, margin + 110, yPosition);
  yPosition += lineHeight;

  const signatureKey = `{R${data.referenceNumber || 1}_Signed}`;
  pdf.setFont('helvetica', 'bold');
  pdf.text('Reference Sent:', margin, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(signatureKey, margin + 110, yPosition);
  yPosition += lineHeight;

  pdf.setFont('helvetica', 'bold');
  pdf.text('Reference Completed:', margin, yPosition);
  pdf.setFont('helvetica', 'normal');
  pdf.text(signatureKey, margin + 110, yPosition);
  yPosition += lineHeight + 5;

  return pdf;
};