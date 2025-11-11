import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import DejaVuSansRegularUrl from '@/assets/fonts/dejavu/DejaVuSans.ttf'
import DejaVuSansBoldUrl from '@/assets/fonts/dejavu/DejaVuSans-Bold.ttf'
import { format } from 'date-fns'
import type { AnnualAppraisalFormData } from '@/components/compliance/AnnualAppraisalFormDialog';
import { questions } from '@/components/compliance/annual-appraisal-constants';

interface CompanyInfo {
  name?: string
  logo?: string
}

export async function generateAnnualAppraisalPDF(data: AnnualAppraisalFormData, employeeName: string = '', company?: CompanyInfo) {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)

  // Fonts
  const regularBytes = await fetch(DejaVuSansRegularUrl).then(r => r.arrayBuffer())
  const boldBytes = await fetch(DejaVuSansBoldUrl).then(r => r.arrayBuffer())
  const font = await doc.embedFont(new Uint8Array(regularBytes), { subset: true })
  const boldFont = await doc.embedFont(new Uint8Array(boldBytes), { subset: true })

  // Try to embed company logo once (optional)
  let embeddedLogo: any | undefined
  if (company?.logo) {
    try {
      const logoBytes = await fetch(company.logo).then(r => r.arrayBuffer())
      try {
        embeddedLogo = await doc.embedPng(logoBytes)
      } catch {
        embeddedLogo = await doc.embedJpg(logoBytes)
      }
    } catch {
      embeddedLogo = undefined
    }
  }

  // Layout constants
  const marginX = 48
  const marginTop = 64
  const marginBottom = 56
  const lineHeight = 16
  const sectionGap = 10
  const pageWidth = () => page.getWidth()
  const contentWidth = () => pageWidth() - marginX * 2

  // Colors
  const textColor = rgb(0, 0, 0)
  const subtle = rgb(0.6, 0.6, 0.6)
  const divider = rgb(0.85, 0.85, 0.85)
  const accent = rgb(0.2, 0.55, 0.95)
  const sectionBg = rgb(0.96, 0.97, 0.99)

  // Page state
  let page = doc.addPage()
  let y = page.getHeight() - marginTop
  let pageIndex = 1

  // Date formatter (dd/MM/yyyy)
  const formatDateDmy = (s?: string) => {
    if (!s) return ''
    const d = new Date(s)
    return isNaN(d.getTime()) ? s : format(d, 'dd/MM/yyyy')
  }

  const drawHeader = () => {
    const headerHeight = embeddedLogo ? 120 : 100
    // Header background
    page.drawRectangle({ x: 0, y: page.getHeight() - headerHeight, width: page.getWidth(), height: headerHeight, color: rgb(0.98, 0.98, 0.985) })

    const centerX = page.getWidth() / 2
    let cursorY = page.getHeight() - 16

    // Logo (centered)
    if (embeddedLogo) {
      const logoW = 56
      const logoH = (embeddedLogo.height / embeddedLogo.width) * logoW
      const logoX = centerX - logoW / 2
      const logoY = page.getHeight() - headerHeight + headerHeight - logoH - 8
      page.drawImage(embeddedLogo, { x: logoX, y: logoY, width: logoW, height: logoH })
      cursorY = logoY - 6
    }

    // Company name (centered)
    const companyName = company?.name || 'Company'
    const companySize = 13
    const companyWidth = boldFont.widthOfTextAtSize(companyName, companySize)
    page.drawText(companyName, { x: centerX - companyWidth / 2, y: cursorY - companySize, size: companySize, font: boldFont, color: textColor })
    cursorY -= companySize + 2

    // Report title (centered)
    const title = 'Annual Appraisal Form'
    const titleSize = 12
    const titleWidth = boldFont.widthOfTextAtSize(title, titleSize)
    page.drawText(title, { x: centerX - titleWidth / 2, y: cursorY - titleSize - 2, size: titleSize, font: boldFont, color: textColor })
    cursorY -= titleSize + 8

    // Date (centered)
    const dateText = formatDateDmy(data.appraisal_date)
    const dateSize = 11
    const dateWidth = font.widthOfTextAtSize(dateText, dateSize)
    page.drawText(dateText, { x: centerX - dateWidth / 2, y: cursorY - dateSize, size: dateSize, font, color: subtle })

    // Divider
    page.drawRectangle({ x: marginX, y: page.getHeight() - headerHeight - 1, width: page.getWidth() - marginX * 2, height: 1, color: divider })

    // Reset content Y just below header
    y = page.getHeight() - headerHeight - 16
  }

  const drawFooter = () => {
    const footerY = marginBottom - 24
    page.drawRectangle({ x: marginX, y: footerY + 12, width: page.getWidth() - marginX * 2, height: 1, color: divider })
    const footerText = `Page ${pageIndex}`
    page.drawText(footerText, { x: marginX, y: footerY, size: 10, font, color: subtle })
  }

  const ensureSpace = (needed: number) => {
    if (y - needed < marginBottom) {
      drawFooter()
      page = doc.addPage()
      pageIndex += 1
      drawHeader()
    }
  }

  const drawSectionTitle = (title: string) => {
    const pad = 6
    const h = 24
    ensureSpace(h + 6)
    page.drawRectangle({ x: marginX, y: y - h + pad, width: contentWidth(), height: h, color: sectionBg })
    page.drawText(title, { x: marginX + 10, y: y - h + pad + 6, size: 12, font: boldFont, color: textColor })
    y -= h + 6
  }

  const drawDivider = () => {
    ensureSpace(10)
    page.drawRectangle({ x: marginX, y: y - 2, width: contentWidth(), height: 1, color: accent })
    y -= 10
  }

  const wrapText = (text: string, width: number, f = font, size = 11) => {
    const words = (text || '').split(/\s+/).filter(Boolean)
    const lines: string[] = []
    let line = ''
    for (const w of words) {
      const test = line ? line + ' ' + w : w
      if (f.widthOfTextAtSize(test, size) <= width) line = test
      else { if (line) lines.push(line); line = w }
    }
    if (line) lines.push(line)
    return lines.length ? lines : ['']
  }

  const drawKeyVal = (label: string, value?: string) => {
    const labelText = `${label}: `
    const labelSize = 11
    const labelWidth = boldFont.widthOfTextAtSize(labelText, labelSize)
    const maxValWidth = contentWidth() - labelWidth
    const lines = wrapText(String(value ?? ''), maxValWidth, font, labelSize)

    ensureSpace(lineHeight * Math.max(1, lines.length))
    // Label
    page.drawText(labelText, { x: marginX, y: y - lineHeight, size: labelSize, font: boldFont, color: textColor })
    // First value line on same line as label
    if (lines.length) {
      page.drawText(lines[0], { x: marginX + labelWidth, y: y - lineHeight, size: labelSize, font, color: textColor })
    }
    y -= lineHeight
    // Remaining lines
    for (let i = 1; i < lines.length; i++) {
      ensureSpace(lineHeight)
      page.drawText(lines[i], { x: marginX + labelWidth, y: y - lineHeight, size: labelSize, font, color: textColor })
      y -= lineHeight
    }
  }

  // Initialize first page header
  drawHeader()

  // Employee Information Section
  drawSectionTitle('Employee Information')
  drawKeyVal('Employee Name', employeeName)
  drawKeyVal('Job Title', data.job_title)
  drawKeyVal('Date of Appraisal', formatDateDmy(data.appraisal_date))
  drawDivider()

  // Performance Assessment Section
  drawSectionTitle('Performance Assessment')
  
  const drawQuestionWithOptions = (question: any) => {
    const selectedRating = (data.ratings as any)[question.id];
    const requiredSpace = 20 + (question.options.length * 16) + 10; // Question title + options + spacing
    ensureSpace(requiredSpace);
    
    // Question title
    const lines = wrapText(question.title, contentWidth(), boldFont, 11);
    for (const line of lines) {
      ensureSpace(lineHeight);
      page.drawText(line, { x: marginX, y: y - lineHeight, size: 11, font: boldFont, color: textColor });
      y -= lineHeight;
    }
    y -= 6;
    
    // Draw all options with selection indicators
    question.options.forEach((option: any) => {
      const isSelected = selectedRating === option.value;
      const optionText = option.label;
      const indent = 20;
      
      ensureSpace(lineHeight + 2);
      
      // Selection indicator
      if (isSelected) {
        page.drawText('●', { x: marginX + indent, y: y - lineHeight, size: 11, font: boldFont, color: rgb(0.2, 0.6, 0.3) });
      } else {
        page.drawText('○', { x: marginX + indent, y: y - lineHeight, size: 11, font, color: rgb(0.7, 0.7, 0.7) });
      }
      
      // Option text
      const textColor = isSelected ? rgb(0.2, 0.6, 0.3) : rgb(0.5, 0.5, 0.5);
      const textFont = isSelected ? boldFont : font;
      const maxTextWidth = contentWidth() - indent - 20;
      
      const textLines = wrapText(optionText, maxTextWidth, textFont, 10);
      
      for (let i = 0; i < textLines.length; i++) {
        if (i > 0) {
          ensureSpace(lineHeight);
          y -= lineHeight;
        }
        const xOffset = i === 0 ? indent + 15 : indent + 15;
        page.drawText(textLines[i], { x: marginX + xOffset, y: y - lineHeight + 2, size: 10, font: textFont, color: textColor });
      }
      
      y -= lineHeight + 2;
    });
    
    y -= 8; // Extra spacing after question
  };

  questions.forEach((question) => {
    drawQuestionWithOptions(question);
  });

  // Comments Section
  drawSectionTitle('Comments')
  
  const drawParagraph = (title: string, content?: string) => {
    if (!content) return
    ensureSpace(lineHeight + 10)
    page.drawText(title, { x: marginX, y: y - lineHeight, size: 11, font: boldFont, color: textColor })
    y -= lineHeight + 4
    const lines = wrapText(content, contentWidth())
    for (const l of lines) {
      ensureSpace(lineHeight)
      page.drawText(l, { x: marginX, y: y - lineHeight, size: 11, font, color: textColor })
      y -= lineHeight
    }
    y -= 8
  }

  drawParagraph('Manager Comments:', data.comments_manager)
  drawParagraph('Employee Comments:', data.comments_employee)
  
  drawDivider()
  
  // Action Plans Section
  drawSectionTitle('Action Plans')
  drawParagraph('Actions plans agreed to develop employee and/or the job include any Training or counselling requirements:', data.action_training)
  drawParagraph('Career development - possible steps in career development:', data.action_career)
  drawParagraph('Agreed action plan, job & development objectives, and time scale:', data.action_plan)
  
  drawDivider()
  
  // Signatures Section
  drawSectionTitle('Signatures')
  drawKeyVal('Supervisor/Manager', data.signature_manager)
  drawKeyVal('Employee', data.signature_employee)
  drawKeyVal('Date', formatDateDmy(new Date().toISOString()))

  // Final footer
  drawFooter()

  // Save & download
  const bytes = await doc.save()
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const appraisalDate = data.appraisal_date ? new Date(data.appraisal_date) : new Date()
  const filename = `${employeeName || 'Employee'} ${appraisalDate.getFullYear()} annual appraisal.pdf`
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export const downloadAnnualAppraisalPDF = async (data: AnnualAppraisalFormData, employeeName: string = '', company?: CompanyInfo) => {
  await generateAnnualAppraisalPDF(data, employeeName, company);
};