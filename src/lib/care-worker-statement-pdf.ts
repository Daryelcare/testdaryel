import jsPDF from 'jspdf';

interface CareWorkerStatement {
  id: string;
  care_worker_name: string;
  client_name: string;
  client_address: string;
  report_date: string;
  statement: string | null;
  person_completing_report: string | null;
  position: string | null;
  digital_signature: string | null;
  completion_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  rejection_reason?: string | null;
  employees?: {
    name: string;
  } | null;
}

export const generateCareWorkerStatementPDF = async (statement: CareWorkerStatement): Promise<Blob> => {
  const pdf = new jsPDF();
  let yPosition = 30;
  
  // Fetch company settings
  const { supabase } = await import('@/integrations/supabase/client');
  const { data: companyData } = await supabase
    .from('company_settings')
    .select('*')
    .single();
  
  const companyName = companyData?.name || 'Care Excellence Ltd';
  const companyLogo = companyData?.logo;
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long', 
      year: 'numeric'
    });
  };

  const formatTime = () => {
    return new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Helper function for gradient backgrounds
  const addGradientBackground = (x: number, y: number, width: number, height: number, startColor: [number, number, number], endColor: [number, number, number]) => {
    const steps = 50;
    const stepHeight = height / steps;
    
    for (let i = 0; i < steps; i++) {
      const ratio = i / steps;
      const r = Math.round(startColor[0] * (1 - ratio) + endColor[0] * ratio);
      const g = Math.round(startColor[1] * (1 - ratio) + endColor[1] * ratio);
      const b = Math.round(startColor[2] * (1 - ratio) + endColor[2] * ratio);
      
      pdf.setFillColor(r, g, b);
      pdf.rect(x, y + (i * stepHeight), width, stepHeight, 'F');
    }
  };

  // Dark blue header background to match design
  pdf.setFillColor(51, 65, 85); // Dark blue background
  pdf.rect(0, 0, 210, 55, 'F');
  
  // Decorative accent line
  pdf.setFillColor(59, 130, 246);
  pdf.rect(0, 55, 210, 3, 'F');

  // Company logo centered at top
  if (companyLogo) {
    try {
      const logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';
      
      await new Promise((resolve) => {
        logoImg.onload = () => {
          try {
            // Logo centered horizontally at top
            const logoSize = 30;
            const logoX = (210 - logoSize) / 2; // Center horizontally
            pdf.addImage(companyLogo, 'PNG', logoX, 8, logoSize, logoSize);
            resolve(true);
          } catch (error) {
            console.warn('Could not add logo to PDF:', error);
            resolve(false);
          }
        };
        logoImg.onerror = () => resolve(false);
        logoImg.src = companyLogo;
      });
    } catch (error) {
      console.warn('Error loading company logo:', error);
    }
  }

  // Company name centered below logo
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor(255, 255, 255);
  const companyNameWidth = pdf.getTextWidth(companyName);
  const companyNameX = (210 - companyNameWidth) / 2;
  pdf.text(companyName, companyNameX, 45);
  
  // Document title centered below company name
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(255, 255, 255);
  const titleText = 'Care Worker Statement Report';
  const titleWidth = pdf.getTextWidth(titleText);
  const titleX = (210 - titleWidth) / 2;
  pdf.text(titleText, titleX, 55);


  yPosition = 75;

  // Main content area with modern cards
  const addModernCard = (title: string, y: number, height: number = 45) => {
    // Card shadow effect
    pdf.setFillColor(0, 0, 0, 0.05);
    pdf.roundedRect(17, y + 2, 176, height, 6, 6, 'F');
    
    // Main card
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(15, y, 180, height, 6, 6, 'F');
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.5);
    pdf.roundedRect(15, y, 180, height, 6, 6);
    
    // Header with gradient
    addGradientBackground(15, y, 180, 12, [241, 245, 249], [248, 250, 252]);
    pdf.setDrawColor(226, 232, 240);
    pdf.line(15, y + 12, 195, y + 12);
    
    // Title
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(30, 41, 59);
    pdf.text(title, 20, y + 8);
    
    return y + 18;
  };

  // Care Worker & Client Information Card
  let cardY = addModernCard('Care Worker & Client Information', yPosition, 50);
  
  // Modern two-column layout with visual separators
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(71, 85, 105);
  
  // Left column
  pdf.text('CARE WORKER', 25, cardY + 5);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.setTextColor(15, 23, 42);
  pdf.text(statement.care_worker_name, 25, cardY + 13);
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(71, 85, 105);
  pdf.text('CLIENT ADDRESS', 25, cardY + 23);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.setTextColor(15, 23, 42);
  const addressLines = pdf.splitTextToSize(statement.client_address, 75);
  addressLines.forEach((line: string, index: number) => {
    pdf.text(line, 25, cardY + 31 + (index * 6));
  });

  // Vertical separator
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(1);
  pdf.line(110, cardY, 110, cardY + 32);

  // Right column
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(71, 85, 105);
  pdf.text('CLIENT NAME', 120, cardY + 5);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.setTextColor(15, 23, 42);
  pdf.text(statement.client_name, 120, cardY + 13);
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(71, 85, 105);
  pdf.text('REPORT DATE', 120, cardY + 23);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.setTextColor(15, 23, 42);
  pdf.text(formatDate(statement.report_date), 120, cardY + 31);

  yPosition += 70;

  // Statement Details without card styling
  if (statement.statement) {
    // Section title
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(30, 41, 59);
    pdf.text('Statement Details', 20, yPosition);
    
    yPosition += 10;
    
    // Statement content with enhanced readability
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(30, 41, 59);
    pdf.setLineHeightFactor(1.6);
    
    const maxWidth = 170;
    const lines = pdf.splitTextToSize(statement.statement, maxWidth);
    const lineHeight = 7;
    
    let currentY = yPosition;
    const pageMargin = 270;
    
    lines.forEach((line: string, index: number) => {
      if (currentY > pageMargin) {
        pdf.addPage();
        currentY = 30;
      }
      pdf.text(line, 20, currentY);
      currentY += lineHeight;
    });
    
    yPosition = currentY + 15;
  } else {
    // Section title
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(30, 41, 59);
    pdf.text('Statement Details', 20, yPosition);
    
    yPosition += 10;
    
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(11);
    pdf.setTextColor(107, 114, 128);
    pdf.text('No statement provided', 20, yPosition);
    yPosition += 25;
  }


  

  // Digital Signature Section with premium styling
  if (statement.digital_signature) {
    if (yPosition > 200) {
      pdf.addPage();
      yPosition = 30;
    }
    
    const sigCardY = addModernCard('Digital Signature & Authentication', yPosition, 65);
    
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve) => {
        img.onload = () => {
          try {
            // Signature container with elegant border
            const sigX = 25;
            const sigY = sigCardY + 5;
            const maxWidth = 90;
            const maxHeight = 35;
            
            let imgWidth = Math.min(maxWidth, img.width * 0.4);
            let imgHeight = (img.height * imgWidth) / img.width;
            
            if (imgHeight > maxHeight) {
              imgHeight = maxHeight;
              imgWidth = (img.width * imgHeight) / img.height;
            }
            
            // Signature background with subtle pattern
            pdf.setFillColor(249, 250, 251);
            pdf.roundedRect(sigX, sigY, imgWidth + 10, imgHeight + 10, 4, 4, 'F');
            pdf.setDrawColor(191, 219, 254);
            pdf.setLineWidth(2);
            pdf.roundedRect(sigX, sigY, imgWidth + 10, imgHeight + 10, 4, 4);
            
            // Add signature
            pdf.addImage(statement.digital_signature!, 'PNG', sigX + 5, sigY + 5, imgWidth, imgHeight);
            
            // Authentication details
            const detailsX = sigX + imgWidth + 25;
            
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(9);
            pdf.setTextColor(71, 85, 105);
            pdf.text('Completed by:', detailsX, sigY + 10);
            pdf.text('Position:', detailsX, sigY + 18);
            pdf.text('Date:', detailsX, sigY + 26);
            
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(9);
            pdf.setTextColor(15, 23, 42);
            pdf.text(statement.person_completing_report || 'Not specified', detailsX + 35, sigY + 10);
            pdf.text(statement.position || 'Not specified', detailsX + 25, sigY + 18);
            pdf.text(statement.completion_date ? formatDate(statement.completion_date) : 'Unknown', detailsX + 20, sigY + 26);
            
            resolve(true);
          } catch (error) {
            console.error('Error adding signature image:', error);
            resolve(false);
          }
        };
        img.onerror = () => resolve(false);
        img.src = statement.digital_signature;
      });
    } catch (error) {
      console.error('Error loading signature:', error);
    }
    
    yPosition += 85;
  }

  // Rejection Details (if applicable) with alert styling
  if (statement.rejection_reason) {
    if (yPosition > 240) {
      pdf.addPage();
      yPosition = 30;
    }
    
    const rejectionLines = pdf.splitTextToSize(statement.rejection_reason, 160);
    const rejectionHeight = 30 + (rejectionLines.length * 6);
    
    // Alert card with red accent
    pdf.setFillColor(254, 242, 242);
    pdf.roundedRect(15, yPosition, 180, rejectionHeight, 6, 6, 'F');
    pdf.setDrawColor(248, 113, 113);
    pdf.setLineWidth(2);
    pdf.roundedRect(15, yPosition, 180, rejectionHeight, 6, 6);
    
    // Alert header with icon effect
    pdf.setFillColor(239, 68, 68);
    pdf.roundedRect(15, yPosition, 180, 15, 6, 6, 'F');
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(255, 255, 255);
    pdf.text('⚠ REJECTION NOTICE', 25, yPosition + 9);
    
    // Rejection content
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(127, 29, 29);
    rejectionLines.forEach((line: string, index: number) => {
      pdf.text(line, 25, yPosition + 25 + (index * 6));
    });
    
    yPosition += rejectionHeight + 10;
  }


  return pdf.output('blob');
};