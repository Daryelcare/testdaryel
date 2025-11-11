import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import DejaVuSansRegularUrl from '@/assets/fonts/dejavu/DejaVuSans.ttf'
import DejaVuSansBoldUrl from '@/assets/fonts/dejavu/DejaVuSans-Bold.ttf'
import { format } from 'date-fns'

import type { SpotCheckFormData } from '@/components/compliance/SpotCheckFormDialog'

interface CompanyInfo {
  name?: string
  logo?: string
}

export async function generateSpotCheckPdf(data: SpotCheckFormData, company?: CompanyInfo) {
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

  const drawText = (text: string, opts?: { bold?: boolean; size?: number }) => {
    const f = opts?.bold ? boldFont : font
    const size = opts?.size ?? 11
    page.drawText(text ?? '', {
      x: margin,
      y: y - lineHeight,
      size,
      font: f,
      color: rgb(0, 0, 0),
    })
    y -= lineHeight
  }

  const addSpacer = (amount = 8) => { y -= amount }

  const drawKeyVal = (label: string, value?: string) => {
    const labelText = `${label}: `
    const labelWidth = boldFont.widthOfTextAtSize(labelText, 11)
    page.drawText(labelText, { x: margin, y: y - lineHeight, size: 11, font: boldFont, color: rgb(0,0,0) })
    page.drawText(String(value ?? ''), { x: margin + labelWidth, y: y - lineHeight, size: 11, font, color: rgb(0,0,0) })
    y -= lineHeight
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

    const title = 'Spot Check Report'
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
  // draw it
  drawReportHeader()

  // Details
  drawText('A. Details', { bold: true, size: 13 })
  addSpacer(4)
  drawKeyVal("Service User's Name", data.serviceUserName)
  drawKeyVal('Care Worker 1', data.careWorker1)
  if (data.careWorker2) drawKeyVal('Care Worker 2', data.careWorker2)
  drawKeyVal('Date of Spot Check', data.date)
  drawKeyVal('Time From', data.timeFrom)
  drawKeyVal('Time To', data.timeTo)
  drawKeyVal('Carried Out By', data.carriedBy)

  addSpacer(10)
  drawText('B. Observations', { bold: true, size: 13 })
  addSpacer(6)

  // Table headers
  const tableX = margin
  // Responsive column widths: smaller Item column, compact Yes/No, larger Comments
  const availableWidth = page.getWidth() - margin * 2
  const colYes = 40
  const colNo = 40
  const colItem = Math.max(180, Math.min(240, Math.floor(availableWidth * 0.32)))
  const colComments = availableWidth - (colItem + colYes + colNo)

  const textSize = 11
  const baseRowHeight = 24
  const cellPadX = 6
  const cellPadY = 6

  const wrapText = (text: string, width: number, f = font) => {
    const words = (text || '').split(/\s+/).filter(Boolean)
    const lines: string[] = []
    let line = ''
    const maxWidth = width - cellPadX * 2

    const pushHardWrapped = (word: string) => {
      let remaining = word
      while (remaining.length > 0 && f.widthOfTextAtSize(remaining, textSize) > maxWidth) {
        let cut = Math.min(remaining.length, 50)
        while (cut > 1 && f.widthOfTextAtSize(remaining.slice(0, cut), textSize) > maxWidth) {
          cut--
        }
        lines.push(remaining.slice(0, cut))
        remaining = remaining.slice(cut)
      }
      if (remaining) {
        if (f.widthOfTextAtSize(remaining, textSize) <= maxWidth) {
          if (!line) line = remaining
          else if (f.widthOfTextAtSize(line + ' ' + remaining, textSize) <= maxWidth) line = line + ' ' + remaining
          else { lines.push(line); line = remaining }
        }
      }
    }

    for (const word of words) {
      const test = line ? line + ' ' + word : word
      if (f.widthOfTextAtSize(test, textSize) <= maxWidth) {
        line = test
      } else {
        if (!line) {
          pushHardWrapped(word)
        } else {
          lines.push(line)
          line = ''
          if (f.widthOfTextAtSize(word, textSize) <= maxWidth) {
            line = word
          } else {
            pushHardWrapped(word)
          }
        }
      }
    }
    if (line) lines.push(line)
    return lines.length ? lines : ['']
  }

  const measureCellHeight = (text: string, width: number, f = font) => {
    const lines = wrapText(text, width, f)
    return Math.max(baseRowHeight, lines.length * lineHeight + cellPadY * 2)
  }

  const drawTableHeader = () => {
    const headerHeight = 30
    page.drawRectangle({
      x: tableX,
      y: y - headerHeight + 5,
      width: page.getWidth() - margin * 2,
      height: headerHeight,
      color: rgb(0.95, 0.96, 1),
    })
    const boldF = boldFont
    const yesX = tableX + colItem
    const noX = yesX + colYes
    const commentsX = noX + colNo

    page.drawText('Item', {
      x: tableX + cellPadX,
      y: y - headerHeight + 9,
      size: 11,
      font: boldF,
      color: rgb(0, 0, 0),
    })

    const centerHeader = (text: string, x: number, width: number) => {
      const size = 11
      const tw = boldF.widthOfTextAtSize(text, size)
      page.drawText(text, {
        x: x + (width - tw) / 2,
        y: y - headerHeight + 9,
        size,
        font: boldF,
        color: rgb(0, 0, 0),
      })
    }
    centerHeader('Yes', yesX, colYes)
    centerHeader('No', noX, colNo)

    // Shorter label to fit the page, with small size to avoid overflow
    const commentsHeader = 'Observation/comments'
    const commentsHeaderSize =
      boldF.widthOfTextAtSize(commentsHeader, 11) <= colComments - cellPadX * 2 ? 11 : 10
    page.drawText(commentsHeader, {
      x: commentsX + cellPadX,
      y: y - headerHeight + 9,
      size: commentsHeaderSize,
      font: boldF,
      color: rgb(0, 0, 0),
    })

    y -= headerHeight
    page.drawRectangle({
      x: tableX,
      y: y - 1 + 5,
      width: page.getWidth() - margin * 2,
      height: 1,
      color: rgb(0.92, 0.92, 0.92),
    })
  }

  const ensureSpace = (needed: number) => {
    if (y - needed < margin) {
      page = doc.addPage()
      y = page.getHeight() - margin
      drawTableHeader()
    }
  }

  // initial table header
  drawTableHeader()

  data.observations.forEach((obs, i) => {
    const itemHeight = measureCellHeight(obs.label || '', colItem)
    const commentsHeight = measureCellHeight(obs.comments || '', colComments)
    let currentRowHeight = Math.max(itemHeight, commentsHeight, baseRowHeight)

    ensureSpace(currentRowHeight)

    if (i % 2 === 0) {
      page.drawRectangle({ x: tableX, y: y - currentRowHeight + 5, width: page.getWidth() - margin * 2, height: currentRowHeight, color: rgb(0.98,0.98,0.99) })
    }

    const itemLines = wrapText(obs.label || '', colItem)
    itemLines.forEach((line, idx) => {
      page.drawText(line, { x: tableX + cellPadX, y: y - cellPadY - (idx + 1) * lineHeight, size: textSize, font, color: rgb(0,0,0) })
    })

    const centerY = y - currentRowHeight / 2 - textSize / 2 + 4
    if (obs.value === 'yes') {
      const tw = font.widthOfTextAtSize('✔', textSize)
      page.drawText('✔', { x: tableX + colItem + (colYes - tw) / 2, y: centerY, size: textSize, font, color: rgb(0,0,0) })
    }
    if (obs.value === 'no') {
      const tw = font.widthOfTextAtSize('✔', textSize)
      page.drawText('✔', { x: tableX + colItem + colYes + (colNo - tw) / 2, y: centerY, size: textSize, font, color: rgb(0,0,0) })
    }

    const commentsLines = wrapText(obs.comments || '', colComments)
    commentsLines.forEach((line, idx) => {
      page.drawText(line, { x: tableX + colItem + colYes + colNo + cellPadX, y: y - cellPadY - (idx + 1) * lineHeight, size: textSize, font, color: rgb(0,0,0) })
    })

    y -= currentRowHeight
    page.drawRectangle({ x: tableX, y: y - 1 + 5, width: page.getWidth() - margin * 2, height: 1, color: rgb(0.92,0.92,0.92) })
  })

  const bytes = await doc.save()
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const checkDate = data.date ? new Date(data.date) : new Date()
  const quarter = Math.floor(checkDate.getMonth() / 3) + 1
  const filename = `${data.serviceUserName || 'Employee'} Q${quarter} ${checkDate.getFullYear()} spot check.pdf`
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
