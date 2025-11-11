import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import DejaVuSansRegularUrl from '@/assets/fonts/dejavu/DejaVuSans.ttf'
import DejaVuSansBoldUrl from '@/assets/fonts/dejavu/DejaVuSans-Bold.ttf'
import { format } from 'date-fns'

export interface ClientSpotCheckFormData {
  serviceUserName: string;
  date: string;
  completedBy: string;
  observations: Array<{
    label: string;
    value: string;
    comments?: string;
  }>;
}

interface CompanyInfo {
  name?: string
  logo?: string
}

export async function generateClientSpotCheckPdf(data: ClientSpotCheckFormData, company?: CompanyInfo) {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  let page = doc.addPage()
  const regularBytes = await fetch(DejaVuSansRegularUrl).then(r => r.arrayBuffer())
  const boldBytes = await fetch(DejaVuSansBoldUrl).then(r => r.arrayBuffer())
  const font = await doc.embedFont(new Uint8Array(regularBytes), { subset: true })
  const boldFont = await doc.embedFont(new Uint8Array(boldBytes), { subset: true })

  // Try to embed company logo (optional)
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

  const margin = 40
  const lineHeight = 16
  let y = page.getHeight() - margin

  const drawText = (text: string, opts?: { bold?: boolean; size?: number; color?: [number, number, number]; maxWidth?: number }) => {
    const f = opts?.bold ? boldFont : font
    const size = opts?.size ?? 11
    const color = opts?.color ? rgb(opts.color[0], opts.color[1], opts.color[2]) : rgb(0, 0, 0)
    const maxWidth = opts?.maxWidth ?? (page.getWidth() - margin * 2)
    
    // Handle text wrapping
    const words = (text ?? '').split(' ')
    let currentLine = ''
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const textWidth = f.widthOfTextAtSize(testLine, size)
      
      if (textWidth <= maxWidth) {
        currentLine = testLine
      } else {
        if (currentLine) {
          page.drawText(currentLine, {
            x: margin,
            y: y - lineHeight,
            size,
            font: f,
            color,
          })
          y -= lineHeight
        }
        currentLine = word
        
        // Check if single word is too long and truncate if necessary
        if (f.widthOfTextAtSize(currentLine, size) > maxWidth) {
          while (f.widthOfTextAtSize(currentLine + '...', size) > maxWidth && currentLine.length > 3) {
            currentLine = currentLine.slice(0, -1)
          }
          currentLine += '...'
        }
      }
    }
    
    // Draw remaining text
    if (currentLine) {
      page.drawText(currentLine, {
        x: margin,
        y: y - lineHeight,
        size,
        font: f,
        color,
      })
      y -= lineHeight
    }
  }

  const addSpacer = (amount = 8) => { y -= amount }

  const drawKeyVal = (label: string, value?: string) => {
    const labelText = `${label}: `
    const labelWidth = boldFont.widthOfTextAtSize(labelText, 11)
    const maxValueWidth = page.getWidth() - margin * 2 - labelWidth
    
    page.drawText(labelText, { x: margin, y: y - lineHeight, size: 11, font: boldFont, color: rgb(0,0,0) })
    
    const valueText = String(value ?? '')
    const valueWidth = font.widthOfTextAtSize(valueText, 11)
    
    if (valueWidth <= maxValueWidth) {
      // Value fits on one line
      page.drawText(valueText, { x: margin + labelWidth, y: y - lineHeight, size: 11, font, color: rgb(0,0,0) })
      y -= lineHeight
    } else {
      // Value needs to be wrapped
      y -= lineHeight
      const words = valueText.split(' ')
      let currentLine = ''
      
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word
        const textWidth = font.widthOfTextAtSize(testLine, 11)
        
        if (textWidth <= maxValueWidth) {
          currentLine = testLine
        } else {
          if (currentLine) {
            page.drawText(currentLine, {
              x: margin + labelWidth,
              y: y - lineHeight,
              size: 11,
              font,
              color: rgb(0,0,0)
            })
            y -= lineHeight
          }
          currentLine = word
          
          // Check if single word is too long and truncate if necessary
          if (font.widthOfTextAtSize(currentLine, 11) > maxValueWidth) {
            while (font.widthOfTextAtSize(currentLine + '...', 11) > maxValueWidth && currentLine.length > 3) {
              currentLine = currentLine.slice(0, -1)
            }
            currentLine += '...'
          }
        }
      }
      
      // Draw remaining text
      if (currentLine) {
        page.drawText(currentLine, {
          x: margin + labelWidth,
          y: y - lineHeight,
          size: 11,
          font,
          color: rgb(0,0,0)
        })
        y -= lineHeight
      }
    }
  }

  const ensureSpace = (needed: number) => {
    if (y - needed < margin + 50) { // Leave some space at bottom
      page = doc.addPage()
      y = page.getHeight() - margin
    }
  }

  // Header (logo + centered titles + quarter/year)
  const drawReportHeader = () => {
    const headerHeight = embeddedLogo ? 120 : 100
    // background
    page.drawRectangle({ x: 0, y: page.getHeight() - headerHeight, width: page.getWidth(), height: headerHeight, color: rgb(0.98, 0.98, 0.985) })
    const centerX = page.getWidth() / 2
    let cursorY = page.getHeight() - 16

    if (embeddedLogo) {
      const logoW = 56
      const logoH = (embeddedLogo.height / embeddedLogo.width) * logoW
      const logoX = centerX - logoW / 2
      const logoY = page.getHeight() - headerHeight + headerHeight - logoH - 8
      page.drawImage(embeddedLogo, { x: logoX, y: logoY, width: logoW, height: logoH })
      cursorY = logoY - 6
    }

    const companyName = company?.name || 'Company'
    const companySize = 13
    const companyWidth = boldFont.widthOfTextAtSize(companyName, companySize)
    page.drawText(companyName, { x: centerX - companyWidth / 2, y: cursorY - companySize, size: companySize, font: boldFont, color: rgb(0,0,0) })
    cursorY -= companySize + 2

    const title = 'Client Spot Check Report'
    const titleSize = 12
    const titleWidth = boldFont.widthOfTextAtSize(title, titleSize)
    page.drawText(title, { x: centerX - titleWidth / 2, y: cursorY - titleSize - 2, size: titleSize, font: boldFont, color: rgb(0,0,0) })
    cursorY -= titleSize + 8

    // Quarter and Year centered
    const d = data?.date ? new Date(data.date) : new Date()
    const q = Math.floor((d.getMonth()) / 3) + 1
    const qText = `Q${q} ${d.getFullYear()}`
    const qSize = 11
    const qWidth = font.widthOfTextAtSize(qText, qSize)
    page.drawText(qText, { x: centerX - qWidth / 2, y: cursorY - qSize, size: qSize, font, color: rgb(0.6,0.6,0.6) })

    // Divider
    page.drawRectangle({ x: margin, y: page.getHeight() - headerHeight - 1, width: page.getWidth() - margin * 2, height: 1, color: rgb(0.85,0.85,0.85) })

    // Reset Y to below header
    y = page.getHeight() - headerHeight - 16
  }

  // Draw header
  drawReportHeader()

  // Details section
  drawText('A. Details', { bold: true, size: 13 })
  addSpacer(4)
  drawKeyVal("Service User's Name", data.serviceUserName)
  drawKeyVal('Date of Spot Check', data.date)
  drawKeyVal('Completed By', data.completedBy)

  addSpacer(16)
  drawText('B. Assessment Questions', { bold: true, size: 13 })
  addSpacer(8)

  // Convert rating value to display label with color
  const getRatingDisplay = (value: string): { text: string; color: [number, number, number] } => {
    switch (value?.toLowerCase()) {
      case 'excellent':
        return { text: 'Excellent', color: [0, 0.5, 0] }; // Dark green
      case 'very_good':
      case 'very good':
        return { text: 'Very Good', color: [0, 0.7, 0] }; // Green
      case 'good':
        return { text: 'Good', color: [0.3, 0.8, 0.3] }; // Light green
      case 'fair':
        return { text: 'Fair', color: [0.8, 0.6, 0] }; // Yellow
      case 'poor':
        return { text: 'Poor', color: [0.8, 0.2, 0] }; // Red
      case 'not_applicable':
      case 'n/a':
        return { text: 'N/A', color: [0.5, 0.5, 0.5] }; // Gray
      default:
        return { text: value || 'Not Rated', color: [0.5, 0.5, 0.5] };
    }
  }

  // Render each assessment question vertically
  data.observations?.forEach((obs, index) => {
    const questionText = obs.label || `Question ${index + 1}`
    const ratingDisplay = getRatingDisplay(obs.value)
    const comments = obs.comments || ''

    // Estimate space needed (question + rating + comments + spacing)
    const estimatedHeight = Math.max(80, (comments?.length || 0) > 100 ? 120 : 80)
    ensureSpace(estimatedHeight)

    // Question number and text
    drawText(`${index + 1}. ${questionText}`, { bold: true, size: 12 })
    addSpacer(4)

    // Rating with color
    drawText(`Rating: ${ratingDisplay.text}`, { bold: true, size: 11, color: ratingDisplay.color })
    addSpacer(4)

    // Comments if available
    if (comments) {
      drawText('Comments:', { bold: true, size: 10 })
      addSpacer(2)
      
      // Use drawText with maxWidth for comments (indented)
      const commentMaxWidth = page.getWidth() - margin * 2 - 20 // Indent comments slightly
      const commentLines = comments.split('\n')
      
      commentLines.forEach(line => {
        if (line.trim()) {
          // Temporarily adjust margin for indentation
          const originalMargin = margin
          const commentMargin = margin + 20
          
          // Draw text with custom x position for indentation
          const words = line.split(' ')
          let currentLine = ''
          
          for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word
            const textWidth = font.widthOfTextAtSize(testLine, 10)
            
            if (textWidth <= commentMaxWidth) {
              currentLine = testLine
            } else {
              if (currentLine) {
                page.drawText(currentLine, {
                  x: commentMargin,
                  y: y - lineHeight,
                  size: 10,
                  font,
                  color: rgb(0.3, 0.3, 0.3)
                })
                y -= lineHeight
              }
              currentLine = word
              
              // Truncate if single word is too long
              if (font.widthOfTextAtSize(currentLine, 10) > commentMaxWidth) {
                while (font.widthOfTextAtSize(currentLine + '...', 10) > commentMaxWidth && currentLine.length > 3) {
                  currentLine = currentLine.slice(0, -1)
                }
                currentLine += '...'
              }
            }
          }
          
          // Draw remaining text
          if (currentLine) {
            page.drawText(currentLine, {
              x: commentMargin,
              y: y - lineHeight,
              size: 10,
              font,
              color: rgb(0.3, 0.3, 0.3)
            })
            y -= lineHeight
          }
        } else {
          y -= lineHeight // Empty line
        }
      })
    }

    // Add spacing between questions
    addSpacer(16)

    // Add a subtle separator line between questions (except for the last one)
    if (index < data.observations.length - 1) {
      page.drawRectangle({
        x: margin,
        y: y - 5,
        width: page.getWidth() - margin * 2,
        height: 1,
        color: rgb(0.9, 0.9, 0.9)
      })
      addSpacer(8)
    }
  })

  const bytes = await doc.save()
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const checkDate = data.date ? new Date(data.date) : new Date()
  const quarter = Math.floor(checkDate.getMonth() / 3) + 1
  const filename = `${data.serviceUserName || 'Client'} Q${quarter} ${checkDate.getFullYear()} client spot check.pdf`
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  await new Promise(resolve => setTimeout(resolve, 150))
  a.remove()
  URL.revokeObjectURL(url)
}