import { PDFDocument, PDFPage, rgb, grayscale } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { format } from 'date-fns';

// Import the DejaVu fonts
import DejaVuSansRegular from '@/assets/fonts/dejavu/DejaVuSans.ttf';
import DejaVuSansBold from '@/assets/fonts/dejavu/DejaVuSans-Bold.ttf';

export interface CompetencyResponse {
  question: string;
  answer: 'yes' | 'not-yet' | 'yes_no' | string;
  comment: string;
  section?: string;
  helpText?: string;
}

export interface MedicationCompetencyData {
  employeeId: string;
  employeeName: string;
  periodIdentifier: string;
  assessmentDate: string;
  supervisor?: string;
  branch?: string;
  responses: CompetencyResponse[];
  signature?: string;
  completedAt: string;
  questionnaireName?: string;
  overallResult?: 'competent' | 'not-yet-competent' | 'requires-training';
  assessorName?: string;
  assessorSignatureData?: string;
  employeeSignatureData?: string;
}

interface CompanyInfo {
  name?: string;
  logo?: string;
}

export async function generateMedicationCompetencyPdf(
  data: MedicationCompetencyData,
  company?: CompanyInfo
): Promise<void> {
  try {
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    // Embed fonts
    const regularFontBytes = await fetch(DejaVuSansRegular).then(res => res.arrayBuffer());
    const boldFontBytes = await fetch(DejaVuSansBold).then(res => res.arrayBuffer());
    
    const regularFont = await pdfDoc.embedFont(regularFontBytes);
    const boldFont = await pdfDoc.embedFont(boldFontBytes);

    // Embed company logo if provided
    let logoImage = null;
    if (company?.logo) {
      try {
        const logoBytes = await fetch(company.logo).then(res => res.arrayBuffer());
        logoImage = await pdfDoc.embedPng(logoBytes);
      } catch (error) {
        console.warn('Could not embed logo:', error);
      }
    }

    let page = pdfDoc.addPage([595, 842]); // A4 size
    let yPosition = 820;
    let pageIndex = 1; // Track page numbers
    
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();
    const margin = 40;
    const contentWidth = pageWidth - (margin * 2);

    // Color palette - modern medical theme
    const colors = {
      primary: rgb(0.2, 0.4, 0.7),      // Medical blue
      secondary: rgb(0.1, 0.6, 0.4),     // Medical green
      accent: rgb(0.8, 0.2, 0.2),        // Alert red
      text: rgb(0.2, 0.2, 0.2),          // Dark gray
      textLight: rgb(0.5, 0.5, 0.5),     // Medium gray
      background: rgb(0.97, 0.98, 0.99), // Light blue-gray
      success: rgb(0.2, 0.7, 0.3),       // Success green
      warning: rgb(0.9, 0.6, 0.1),       // Warning orange
      border: rgb(0.85, 0.85, 0.85),     // Light border
      white: rgb(1, 1, 1)
    };

    // Helper functions
    const drawText = (text: string, x: number, y: number, options: any = {}) => {
      const { size = 10, bold = false, color = colors.text, maxWidth, lineHeight, ...rest } = options;
      const drawOptions: any = {
        x,
        y,
        size,
        font: bold ? boldFont : regularFont,
        color,
      };
      if (typeof maxWidth !== 'undefined') drawOptions.maxWidth = maxWidth;
      if (typeof lineHeight !== 'undefined') drawOptions.lineHeight = lineHeight;
      page.drawText(text, { ...drawOptions, ...rest });
    };

    const drawRectangle = (x: number, y: number, width: number, height: number, color: any) => {
      page.drawRectangle({
        x,
        y,
        width,
        height,
        color
      });
    };

    const drawFooter = () => {
      const footerY = 30; // Position from bottom
      // Draw divider line
      page.drawLine({
        start: { x: margin, y: footerY + 12 },
        end: { x: pageWidth - margin, y: footerY + 12 },
        thickness: 0.5,
        color: colors.border
      });
      // Draw page number
      const footerText = `Page ${pageIndex}`;
      drawText(footerText, margin, footerY, {
        size: 10,
        color: colors.textLight
      });
    };

    const addNewPage = () => {
      drawFooter(); // Draw footer on current page before creating new page
      page = pdfDoc.addPage([595, 842]);
      pageIndex++; // Increment page number
      yPosition = 800;
      drawPageHeader();
    };

    const checkPageSpace = (requiredSpace: number) => {
      if (yPosition - requiredSpace < 80) {
        addNewPage();
      }
    };

    const wrapText = (text: string, maxWidth: number, font: any, fontSize: number): string[] => {
      const lines: string[] = [];
      const paragraphs = String(text || '').split(/\r?\n/);

      const pushBrokenWord = (word: string) => {
        let remainder = word;
        while (font.widthOfTextAtSize(remainder, fontSize) > maxWidth && remainder.length > 1) {
          let sliceEnd = 1;
          for (let i = 1; i <= remainder.length; i++) {
            const part = remainder.slice(0, i);
            if (font.widthOfTextAtSize(part, fontSize) > maxWidth) {
              sliceEnd = i - 1;
              break;
            }
            sliceEnd = i;
          }
          const part = remainder.slice(0, sliceEnd);
          if (!part) break;
          lines.push(part);
          remainder = remainder.slice(sliceEnd);
        }
        if (remainder) lines.push(remainder);
      };

      for (let p = 0; p < paragraphs.length; p++) {
        const para = paragraphs[p];
        const words = para.split(/\s+/).filter(Boolean);
        let currentLine = '';

        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const testWidth = font.widthOfTextAtSize(testLine, fontSize);

          if (testWidth <= maxWidth) {
            currentLine = testLine;
          } else {
            if (currentLine) lines.push(currentLine);
            // If the word alone is too wide, break it into pieces
            if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
              pushBrokenWord(word);
              currentLine = '';
            } else {
              currentLine = word;
            }
          }
        }

        if (currentLine) lines.push(currentLine);
        // Keep paragraph spacing (but avoid trailing empty line)
        if (p < paragraphs.length - 1) lines.push('');
      }

      return lines;
    };

    // Page header (for subsequent pages) - removed per user request
    const drawPageHeader = () => {
      // Header removed - no longer drawing page headers
      yPosition = pageHeight - 20;
    };

    // Modern header with gradient effect simulation
    const drawModernHeader = () => {
      // Header background with gradient effect (simulated with multiple rectangles)
      // Start from the very top of the page
      const headerHeight = 180;
      const headerStartY = pageHeight - headerHeight; // Start from top
      
      for (let i = 0; i < 8; i++) {
        const intensity = 0.2 + (i * 0.1);
        drawRectangle(0, headerStartY + (i * 4), pageWidth, 4, rgb(intensity * 0.2, intensity * 0.4, intensity * 0.7));
      }

      // Main header background - start from very top
      drawRectangle(0, headerStartY, pageWidth, headerHeight, colors.primary);

      let headerY = pageHeight - 40;

      // Centered company logo
      if (logoImage) {
        const logoW = 60;
        const logoH = (logoImage.height / logoImage.width) * logoW;
        const logoX = (pageWidth - logoW) / 2;
        page.drawImage(logoImage, {
          x: logoX,
          y: headerY - logoH,
          width: logoW,
          height: logoH,
        });
        headerY -= logoH + 15;
      }

      // Centered company name
      if (company?.name) {
        const companyNameWidth = boldFont.widthOfTextAtSize(company.name, 18);
        const companyX = (pageWidth - companyNameWidth) / 2;
        drawText(company.name, companyX, headerY, {
          color: colors.white,
          size: 18,
          bold: true
        });
        headerY -= 25;
      }

      // Centered compliance type name
      const complianceName = 'MEDICATION COMPETENCY';
      const complianceNameWidth = boldFont.widthOfTextAtSize(complianceName, 22);
      const complianceX = (pageWidth - complianceNameWidth) / 2;
      drawText(complianceName, complianceX, headerY, {
        color: colors.white,
        size: 22,
        bold: true
      });
      headerY -= 30;

      // Centered frequency period
      const frequencyText = `Assessment Period: ${data.periodIdentifier}`;
      const frequencyWidth = regularFont.widthOfTextAtSize(frequencyText, 14);
      const frequencyX = (pageWidth - frequencyWidth) / 2;
      drawText(frequencyText, frequencyX, headerY, {
        color: rgb(0.9, 0.9, 0.9),
        size: 14
      });

      yPosition = headerStartY - 20;
    };

    // Employee information card
    const drawEmployeeCard = () => {
      checkPageSpace(120);
      
      const cardHeight = 100;
      const cardY = yPosition - cardHeight;
      
      // Card background
      drawRectangle(margin, cardY, contentWidth, cardHeight, colors.background);
      
      // Card header
      drawRectangle(margin, cardY + cardHeight - 25, contentWidth, 25, colors.secondary);
      drawText('👤 EMPLOYEE INFORMATION', margin + 15, cardY + cardHeight - 17, {
        color: colors.white,
        size: 12,
        bold: true
      });

      // Employee details
      const detailsY = cardY + cardHeight - 45;
      drawText('Name:', margin + 20, detailsY, { bold: true, size: 11 });
      drawText(data.employeeName, margin + 100, detailsY, { size: 11, color: colors.primary });
      
      drawText('Assessment Date:', margin + 20, detailsY - 18, { bold: true, size: 11 });
      drawText(data.assessmentDate, margin + 150, detailsY - 18, { size: 11 });
      
      if (data.supervisor) {
        drawText('Supervisor:', margin + 20, detailsY - 36, { bold: true, size: 11 });
        drawText(data.supervisor, margin + 100, detailsY - 36, { size: 11 });
      }
      
      if (data.branch) {
        drawText('Branch:', margin + 300, detailsY, { bold: true, size: 11 });
        drawText(data.branch, margin + 350, detailsY, { size: 11 });
      }
      
      drawText('Completed:', margin + 300, detailsY - 18, { bold: true, size: 11 });
      drawText(format(new Date(data.completedAt), 'MMM dd, yyyy HH:mm'), margin + 370, detailsY - 18, { size: 11 });

      yPosition = cardY - 20;
    };


    // Individual competency assessments
    const drawCompetencyAssessments = () => {
      checkPageSpace(40);
      
      drawText('🎯 DETAILED COMPETENCY ASSESSMENT', margin, yPosition, {
        bold: true,
        size: 14,
        color: colors.primary
      });
      yPosition -= 25;

      // Group responses by section
      const sections = data.responses.reduce((acc, response) => {
        const section = response.section || 'General';
        if (!acc[section]) acc[section] = [];
        acc[section].push(response);
        return acc;
      }, {} as Record<string, CompetencyResponse[]>);

      let questionNumber = 1;

      Object.entries(sections).forEach(([sectionName, responses]) => {
        // Skip the Acknowledgement section header - we handle signatures separately
        if (sectionName === 'Acknowledgement') {
          return;
        }
        
        checkPageSpace(40);
        
        // Section header
        drawRectangle(margin, yPosition - 20, contentWidth, 20, colors.secondary);
        drawText(sectionName.toUpperCase(), margin + 10, yPosition - 13, {
          color: colors.white,
          size: 10,
          bold: true
        });
        yPosition -= 30;

        responses.forEach((response) => {
          // Skip signature-related questions from competency assessment
          if (response.question.toLowerCase().includes('signature')) {
            return;
          }
          // Calculate required height for this item
          const questionLines = wrapText(response.question, contentWidth - 100, regularFont, 10);
          const examplesText = response.helpText || 'Direct observation / discussion';
          const exampleLines = wrapText(examplesText, contentWidth - 100, regularFont, 8);
          const commentLines = response.comment ? wrapText(response.comment, contentWidth - 120, regularFont, 9) : [];
          
          const requiredHeight = 25 + // base height
            (questionLines.length * 12) + // question text
            (exampleLines.length * 10) + 5 + // examples text + spacing
            20 + // assessment label + answer
            (commentLines.length * 11) + 15; // comments + spacing
          
          checkPageSpace(requiredHeight);
          
          const itemY = yPosition - requiredHeight;
          
          // Competency item background
          const bgColor = response.answer === 'yes' ? rgb(0.95, 1, 0.95) : 
                         response.answer === 'not-yet' ? rgb(1, 0.97, 0.95) : 
                         rgb(0.98, 0.98, 0.98);
          
          drawRectangle(margin, itemY, contentWidth, requiredHeight, bgColor);
          
          // Question number instead of status icon
          const questionNumberText = `${questionNumber}.`;
          const statusColor = response.answer === 'yes' ? colors.success : 
                            response.answer === 'not-yet' ? colors.warning : 
                            colors.textLight;
          
          let currentY = itemY + requiredHeight - 10;
          
          drawText(questionNumberText, margin + 10, currentY, { 
            size: 12, 
            bold: true,
            color: colors.text
          });
          
          // Question text
          questionLines.forEach((line, lineIndex) => {
            drawText(line, margin + 30, currentY - (lineIndex * 12), {
              size: 10,
              bold: true,
              color: colors.text
            });
          });
          
          // Move Y position after question
          currentY -= (questionLines.length * 12) + 5;
          
          // Examples/Evidence text
          if (examplesText) {
            exampleLines.forEach((line, lineIndex) => {
              drawText(line, margin + 30, currentY - (lineIndex * 10), {
                size: 8,
                color: colors.textLight,
                bold: false
              });
            });
            currentY -= (exampleLines.length * 10) + 8;
          }
          
          // Assessment label and answer
          drawText('Assessment:', margin + 30, currentY, {
            size: 9,
            bold: true,
            color: colors.textLight
          });
          
          drawText(response.answer === 'yes' ? 'Competent' : 
                  response.answer === 'not-yet' ? 'Not Yet Competent' : 
                  'Not Assessed', margin + 100, currentY, {
            size: 9,
            color: statusColor,
            bold: true
          });
          
          currentY -= 14;
          
          // Comments
          if (response.comment) {
            drawText('Comments:', margin + 30, currentY, {
              size: 9,
              bold: true,
              color: colors.textLight
            });
            commentLines.forEach((line, lineIndex) => {
              drawText(line, margin + 100, currentY - (lineIndex * 11), {
                size: 9,
                color: colors.text
              });
            });
          }
          
          yPosition = itemY - 10;
          questionNumber++;
        });
        
        yPosition -= 10;
      });
    };

    // Signature section
    const drawSignatureSection = async () => {
      checkPageSpace(160);
      
      const sectionHeight = 140;
      const sectionY = yPosition - sectionHeight;
      
      // Section background
      drawRectangle(margin, sectionY, contentWidth, sectionHeight, colors.background);
      
      // Section header
      drawRectangle(margin, sectionY + sectionHeight - 25, contentWidth, 25, colors.primary);
      drawText('✍️ SIGNATURES', margin + 15, sectionY + sectionHeight - 17, {
        color: colors.white,
        size: 12,
        bold: true
      });
      
      const signaturesY = sectionY + sectionHeight - 45;
      
      // Assessor signature section
      if (data.assessorName || data.assessorSignatureData) {
        drawText('Assessor Name:', margin + 20, signaturesY, { bold: true, size: 10 });
        drawText(data.assessorName || '', margin + 120, signaturesY, { size: 10, color: colors.primary });
        
        drawText('Assessor Signature:', margin + 20, signaturesY - 25, { bold: true, size: 10 });
        
        // Draw signature line for assessor
        page.drawLine({
          start: { x: margin + 130, y: signaturesY - 30 },
          end: { x: margin + 300, y: signaturesY - 30 },
          thickness: 0.5,
          color: colors.border
        });
        
        // Embed actual signature image if available
        if (data.assessorSignatureData) {
          try {
            // Convert data URL to image
            const signatureImage = await pdfDoc.embedPng(data.assessorSignatureData);
            const signatureWidth = 150;
            const signatureHeight = (signatureImage.height / signatureImage.width) * signatureWidth;
            
            page.drawImage(signatureImage, {
              x: margin + 130,
              y: signaturesY - 35,
              width: signatureWidth,
              height: Math.min(signatureHeight, 30), // Limit height to keep it proportional
            });
          } catch (error) {
            console.warn('Could not embed assessor signature image:', error);
            drawText('[Digital Signature Present]', margin + 130, signaturesY - 25, { 
              size: 8, 
              color: colors.textLight,
              bold: true 
            });
          }
        }
      }
      
      // Employee signature section
      if (data.employeeName || data.employeeSignatureData) {
        drawText('Employee Name:', margin + 20, signaturesY - 50, { bold: true, size: 10 });
        drawText(data.employeeName || '', margin + 120, signaturesY - 50, { size: 10, color: colors.primary });
        
        drawText('Employee Signature:', margin + 20, signaturesY - 75, { bold: true, size: 10 });
        
        // Draw signature line for employee
        page.drawLine({
          start: { x: margin + 130, y: signaturesY - 80 },
          end: { x: margin + 300, y: signaturesY - 80 },
          thickness: 0.5,
          color: colors.border
        });
        
        // Embed actual signature image if available
        if (data.employeeSignatureData) {
          try {
            // Convert data URL to image
            const signatureImage = await pdfDoc.embedPng(data.employeeSignatureData);
            const signatureWidth = 150;
            const signatureHeight = (signatureImage.height / signatureImage.width) * signatureWidth;
            
            page.drawImage(signatureImage, {
              x: margin + 130,
              y: signaturesY - 85,
              width: signatureWidth,
              height: Math.min(signatureHeight, 30), // Limit height to keep it proportional
            });
          } catch (error) {
            console.warn('Could not embed employee signature image:', error);
            drawText('[Digital Signature Present]', margin + 130, signaturesY - 75, { 
              size: 8, 
              color: colors.textLight,
              bold: true 
            });
          }
        }
      }
      
      // Date
      drawText('Date:', margin + 350, signaturesY - 25, { bold: true, size: 10 });
      drawText(format(new Date(data.completedAt), 'MMM dd, yyyy'), margin + 390, signaturesY - 25, { size: 10 });
      
      yPosition = sectionY - 20;
    };


    // Generate the PDF content
    drawModernHeader();
    drawEmployeeCard();
    drawCompetencyAssessments();
    await drawSignatureSection();
    
    // Draw footer on the last page
    drawFooter();

    // Save and download the PDF
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `medication-competency-${data.employeeName.replace(/\s+/g, '-')}-${data.periodIdentifier}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error generating medication competency PDF:', error);
    throw error;
  }
}