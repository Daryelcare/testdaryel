import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { format, parseISO, isValid as isValidDateFns } from 'date-fns'
import type { JobApplicationData } from '@/components/job-application/types'
import { getTimeSlotMappings, mapTimeSlotIds } from '@/utils/timeSlotUtils'
import { generateEnhancedSkills } from './enhancedSkills'

// Format date to DD-MM-YYYY regardless of input (YYYY-MM-DD, ISO, etc.)
function formatDateDDMMYYYY(value?: string): string {
  if (!value) return ''
  try {
    const parsedISO = parseISO(value)
    if (isValidDateFns(parsedISO)) return format(parsedISO, 'dd-MM-yyyy')
    const d = new Date(value)
    if (!isNaN(d.getTime())) return format(d, 'dd-MM-yyyy')
  } catch {}
  return value
}

function formatFromTo(from?: string, to?: string) {
  const f = formatDateDDMMYYYY(from)
  const t = formatDateDDMMYYYY(to)
  if (f && t) return `${f} - ${t}`
  return f || t || ''
}


// Text writing helper with wrapping and pagination
interface WriterCtx {
  doc: PDFDocument
  page: any
  font: any
  boldFont: any
  fontSize: number
  margin: number
  y: number
  lineHeight: number
  color: { r: number; g: number; b: number }
  blueColor: { r: number; g: number; b: number }
}

function addPage(ctx: WriterCtx) {
  ctx.page = ctx.doc.addPage()
  ctx.y = ctx.page.getHeight() - ctx.margin
}

function ensureSpace(ctx: WriterCtx, requiredHeight: number) {
  if (ctx.y - requiredHeight < ctx.margin) {
    addPage(ctx)
  }
}

function drawText(ctx: WriterCtx, text: string, options?: { bold?: boolean; size?: number; blue?: boolean }) {
  const font = options?.bold ? ctx.boldFont : ctx.font
  const size = options?.size ?? ctx.fontSize
  const color = options?.blue ? ctx.blueColor : ctx.color
  const maxWidth = ctx.page.getWidth() - ctx.margin * 2

  const words = (text ?? '').split(/\s+/)
  let line = ''
  const lines: string[] = []

  for (const w of words) {
    const testLine = line ? `${line} ${w}` : w
    const width = font.widthOfTextAtSize(testLine, size)
    if (width > maxWidth) {
      if (line) lines.push(line)
      line = w
    } else {
      line = testLine
    }
  }
  if (line) lines.push(line)

  const blockHeight = lines.length * ctx.lineHeight
  ensureSpace(ctx, blockHeight)
  for (const l of lines) {
    ctx.page.drawText(l, {
      x: ctx.margin,
      y: ctx.y - ctx.lineHeight,
      size,
      font,
      color: rgb(color.r, color.g, color.b),
    })
    ctx.y -= ctx.lineHeight
  }
}

function addSpacer(ctx: WriterCtx, amount = 8) {
  ensureSpace(ctx, amount)
  ctx.y -= amount
}

function addSectionTitle(ctx: WriterCtx, title: string) {
  addSpacer(ctx, 8)
  drawText(ctx, title, { bold: true, size: ctx.fontSize + 3 })
  // underline divider
  const lineY = ctx.y - 2
  ctx.page.drawRectangle({
    x: ctx.margin,
    y: lineY,
    width: ctx.page.getWidth() - ctx.margin * 2,
    height: 1,
    color: rgb(0.85, 0.85, 0.85),
  })
  ctx.y = lineY - 6
}


function addKeyValue(ctx: WriterCtx, label: string, value?: string) {
  // Ensure space for at least 2 lines before drawing
  ensureSpace(ctx, ctx.lineHeight * 2)
  
  const maxWidth = ctx.page.getWidth() - ctx.margin * 2
  const labelText = `${label}: `
  const labelWidth = ctx.boldFont.widthOfTextAtSize(labelText, ctx.fontSize)

  // If label is too long to fit on one line, wrap label and render value below
  if (labelWidth > maxWidth) {
    // Wrapped label (bold, black)
    drawText(ctx, label, { bold: true })
    // Value (blue) on next lines
    const valueText = value ?? ''
    if (valueText) {
      drawText(ctx, valueText, { blue: true })
    }
    return
  }

  // Draw label in black
  ctx.page.drawText(labelText, {
    x: ctx.margin,
    y: ctx.y - ctx.lineHeight,
    size: ctx.fontSize,
    font: ctx.boldFont,
    color: rgb(ctx.color.r, ctx.color.g, ctx.color.b),
  })

  // Draw value in blue on the same line if it fits, otherwise wrap to next lines
  const valueText = value ?? ''
  const remainingWidth = maxWidth - labelWidth
  const valueWidth = ctx.font.widthOfTextAtSize(valueText, ctx.fontSize)

  if (valueWidth <= remainingWidth) {
    // Fits on same line
    ctx.page.drawText(valueText, {
      x: ctx.margin + labelWidth,
      y: ctx.y - ctx.lineHeight,
      size: ctx.fontSize,
      font: ctx.font,
      color: rgb(ctx.blueColor.r, ctx.blueColor.g, ctx.blueColor.b),
    })
    ctx.y -= ctx.lineHeight
  } else {
    // Wrap to next line
    ctx.y -= ctx.lineHeight
    drawText(ctx, valueText, { blue: true })
  }
}

// Layout helpers for nicer, two-column design
const GUTTER = 18

function getColWidth(ctx: WriterCtx) {
  return (ctx.page.getWidth() - ctx.margin * 2 - GUTTER) / 2
}

function wrapLines(font: any, size: number, text: string, maxWidth: number) {
  const words = (text ?? '').toString().split(/\s+/)
  let line = ''
  const lines: string[] = []
  for (const w of words) {
    const testLine = line ? `${line} ${w}` : w
    const width = font.widthOfTextAtSize(testLine, size)
    if (width > maxWidth) {
      if (line) lines.push(line)
      line = w
    } else {
      line = testLine
    }
  }
  if (line) lines.push(line)
  return lines
}

function drawTextAt(
  ctx: WriterCtx,
  text: string,
  x: number,
  yStart: number,
  width: number,
  options?: { bold?: boolean; size?: number; blue?: boolean }
) {
  const font = options?.bold ? ctx.boldFont : ctx.font
  const size = options?.size ?? ctx.fontSize
  const color = options?.blue ? ctx.blueColor : ctx.color
  const lines = wrapLines(font, size, text ?? '', width)
  let y = yStart
  for (const l of lines) {
    ctx.page.drawText(l, {
      x,
      y: y - ctx.lineHeight,
      size,
      font,
      color: rgb(color.r, color.g, color.b),
    })
    y -= ctx.lineHeight
  }
  return lines.length * ctx.lineHeight
}

function measureKeyValueHeight(ctx: WriterCtx, value: string | undefined, width: number) {
  const valueLines = wrapLines(ctx.font, ctx.fontSize, String(value ?? ''), width)
  // one line for label + value lines
  return ctx.lineHeight + valueLines.length * ctx.lineHeight
}

function drawKeyValueInArea(
  ctx: WriterCtx,
  label: string,
  value: string | undefined,
  x: number,
  yStart: number,
  width: number
) {
  // Label (black)
  ctx.page.drawText(label, {
    x,
    y: yStart - ctx.lineHeight,
    size: ctx.fontSize,
    font: ctx.boldFont,
    color: rgb(ctx.color.r, ctx.color.g, ctx.color.b),
  })
  // Value (blue)
  const used = drawTextAt(ctx, String(value ?? ''), x, yStart - ctx.lineHeight, width, { blue: true })
  return ctx.lineHeight + used
}

function renderTwoColGrid(ctx: WriterCtx, pairs: Array<[string, string | undefined]>) {
  const colWidth = getColWidth(ctx)
  const leftX = ctx.margin
  const rightX = ctx.margin + colWidth + GUTTER
  const rowGap = 8

  for (let i = 0; i < pairs.length; i += 2) {
    const left = pairs[i]
    const right = pairs[i + 1]
    const leftH = measureKeyValueHeight(ctx, left?.[1], colWidth)
    const rightH = right ? measureKeyValueHeight(ctx, right[1], colWidth) : 0
    const rowHeight = Math.max(leftH, rightH)

    ensureSpace(ctx, rowHeight + rowGap)
    const yStart = ctx.y

    if (left) drawKeyValueInArea(ctx, left[0], left[1], leftX, yStart, colWidth)
    if (right) drawKeyValueInArea(ctx, right[0], right[1], rightX, yStart, colWidth)

    ctx.y -= rowHeight + rowGap
  }
}

// Helper to embed image (PNG/JPG) from URL
async function embedImageFromUrl(doc: PDFDocument, url: string) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to fetch logo: ${res.status}`)
    const contentType = res.headers.get('content-type') || ''
    const buf = await res.arrayBuffer()
    const bytes = new Uint8Array(buf)
    if (/png/i.test(contentType) || /\.png(\?|$)/i.test(url)) {
      return await doc.embedPng(bytes as any)
    }
    return await doc.embedJpg(bytes as any)
  } catch (e) {
    console.warn('Logo embedding failed:', e)
    return undefined
  }
}

export async function generateJobApplicationPdf(
  data: JobApplicationData,
  options?: { logoUrl?: string; companyName?: string; applicationId?: string }
) {
  const doc = await PDFDocument.create()
  const page = doc.addPage()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold)

  const ctx: WriterCtx = {
    doc,
    page,
    font,
    boldFont,
    fontSize: 11,
    margin: 40,
    y: page.getHeight() - 40,
    lineHeight: 16,
    color: { r: 0, g: 0, b: 0 },
    blueColor: { r: 0.2, g: 0.4, b: 0.8 },
  }

// Header with optional company logo
if (options?.logoUrl) {
  const img = await embedImageFromUrl(doc, options.logoUrl)
  if (img) {
    const maxW = 140
    const maxH = 60
    const scale = Math.min(maxW / img.width, maxH / img.height, 1)
    const dw = img.width * scale
    const dh = img.height * scale
    const x = (page.getWidth() - dw) / 2
    const y = page.getHeight() - ctx.margin - dh
    page.drawImage(img, { x, y, width: dw, height: dh })
    ctx.y = y - 10
  }
}

drawText(ctx, 'Job Application Summary', { bold: true, size: 16 })
addSpacer(ctx, 10)

  // Personal Information
  addSectionTitle(ctx, '1. Personal Information')
  const pi = data.personalInfo || ({} as any)
  const piPairs: Array<[string, string | undefined]> = [
    ['Title', pi.title],
    ['Full Name', pi.fullName],
    ['Email', pi.email],
    ['Telephone/Mobile', pi.telephone],
    ['Date of Birth', formatDateDDMMYYYY(pi.dateOfBirth)],
    ['Street Address', pi.streetAddress],
    ['Street Address Second Line', pi.streetAddress2],
    ['Town', pi.town],
    ['Borough', pi.borough],
    ['Postcode', pi.postcode],
    ['Proficiency in English (if not first language)', pi.englishProficiency],
    ['Which other languages do you speak?', (pi.otherLanguages || []).join(', ')],
    ['Position applied for', pi.positionAppliedFor],
    ['Which personal care Are you willing to do?', pi.personalCareWillingness === 'yes' ? 'Not specified' : (pi.personalCareWillingness || 'Not specified')],
    ['Do you have a recent or updated DBS?', pi.hasDBS],
    ['National Insurance Number', pi.nationalInsuranceNumber],
    ['Do you currently have your own car and licence?', pi.hasCarAndLicense],
  ]
  renderTwoColGrid(ctx, piPairs)


  // Availability
  addSectionTitle(ctx, '2. Availability')
  const av = data.availability || ({} as any)
  const avaPairs: Array<[string, string | undefined]> = [
    ['How many hours per week are you willing to work?', av.hoursPerWeek],
    ['Do you have current right to live and work in the UK?', av.hasRightToWork],
  ]
  renderTwoColGrid(ctx, avaPairs)

  const timeSlots = av.timeSlots || {}
  const slotEntries = Object.entries(timeSlots)
  if (slotEntries.length) {
    drawText(ctx, 'Selected Time Slots', { bold: true })
    // Get time slot mappings
    const timeSlotMappings = await getTimeSlotMappings()
    const mappedTimeSlots = mapTimeSlotIds(timeSlots, timeSlotMappings)
    const slotPairs = Object.entries(mappedTimeSlots).map(([slotLabel, days]) => [
      String(slotLabel),
      Array.isArray(days) ? (days as string[]).join(', ') : String(days ?? ''),
    ]) as Array<[string, string]>
    renderTwoColGrid(ctx, slotPairs)
  }


  // Emergency Contact
  addSectionTitle(ctx, '3. Emergency Contact')
  const ec = data.emergencyContact || ({} as any)
  renderTwoColGrid(ctx, [
    ['Full Name', ec.fullName],
    ['Relationship', ec.relationship],
    ['Contact number', ec.contactNumber],
    ['How did you Hear about us', ec.howDidYouHear],
  ])


  // Employment History
  addSectionTitle(ctx, '4. Employment History')
  addKeyValue(ctx, 'Were you previously been employed?', data.employmentHistory?.previouslyEmployed)
  if (data.employmentHistory?.previouslyEmployed === 'yes') {
    const recent = data.employmentHistory?.recentEmployer as any
    if (recent) {
      drawText(ctx, 'Most Recent Employer', { bold: true })
      renderTwoColGrid(ctx, [
        ['Company', recent.company],
        ['Name', recent.name],
        ['Email', recent.email],
        ['Position Held', recent.position],
        ['Address', recent.address],
        ['Address 2', recent.address2],
        ['Town', recent.town],
        ['Postcode', recent.postcode],
        ['Telephone Number', recent.telephone],
        ['From to', formatFromTo(recent.from, recent.to)],
        ['Leaving date or notice (if relevant)', formatDateDDMMYYYY(recent.leavingDate)],
        ['Reason for leaving', recent.reasonForLeaving],
      ])
      if (recent.keyTasks) {
        drawText(ctx, 'Key Tasks/Responsibilities', { bold: true })
        drawText(ctx, recent.keyTasks)
      }
    }

    const prevList = data.employmentHistory?.previousEmployers || []
    if (prevList.length) {
      drawText(ctx, 'Previous employers (from most recent)', { bold: true })
      prevList.forEach((emp) => {
        renderTwoColGrid(ctx, [
          ['Company', emp.company],
          ['Name', emp.name],
          ['Email', emp.email],
          ['Position Held', emp.position],
          ['Address', emp.address],
          ['Address 2', emp.address2],
          ['Town', emp.town],
          ['Postcode', emp.postcode],
          ['Telephone Number', emp.telephone],
          ['From to', formatFromTo(emp.from, emp.to)],
          ['Leaving date or notice (if relevant)', formatDateDDMMYYYY(emp.leavingDate)],
          ['Reason for leaving', emp.reasonForLeaving],
        ])
        if (emp.keyTasks) {
          drawText(ctx, 'Key Tasks/Responsibilities', { bold: true })
          drawText(ctx, emp.keyTasks)
        }
        addSpacer(ctx, 6)
      })
    }
  }

  // References (2-column layout)
  addSectionTitle(ctx, '5. References')
  const refs: any[] = Object.values<any>(data.references || {})
  refs
    .filter((r) => r && (r.name || r.company || r.email))
    .forEach((ref, idx) => {
      drawText(ctx, `Reference ${idx + 1}`, { bold: true })
      renderTwoColGrid(ctx, [
        ['Name', ref.name],
        ['Company', ref.company],
        ['Job Title', ref.jobTitle],
        ['Email', ref.email],
        ['Address', ref.address],
        ['Address2', ref.address2],
        ['Town', ref.town],
        ['Contact Number', ref.contactNumber],
        ['Postcode', ref.postcode],
      ])
      addSpacer(ctx, 12)
    })

  // Skills & Experience (2-column layout)
  addSectionTitle(ctx, '6. Skills & Experience')
  const enhancedSkills = await generateEnhancedSkills(data, options?.applicationId)
  const skillEntries = Object.entries(enhancedSkills)
  if (skillEntries.length) {
    const skillPairs = skillEntries.map(([skill, level]) => [skill, String(level)]) as Array<[string, string]>
    renderTwoColGrid(ctx, skillPairs)
  } else {
    drawText(ctx, 'No specific skills listed')
  }

  // Declaration
  addSectionTitle(ctx, '7. Declaration')
  
  // Declaration text
  drawText(ctx, 'Applicant Declaration', { bold: true })
  drawText(ctx, 'Protection of Children, Vulnerable Adults and criminal convictions.')
  addSpacer(ctx, 4)
  drawText(ctx, 'United Kingdom legislation and guidance relating to the welfare of children and vulnerable adults has at its core, the principle that the welfare of vulnerable persons must be the paramount consideration.')
  addSpacer(ctx, 4)
  drawText(ctx, 'Our care Agency fully supports this principle and therefore, we require that everyone who may come into contact with children and vulnerable persons or have access to their personal details, complete and sign this declaration.')
  addSpacer(ctx, 4)
  drawText(ctx, 'This record is to ensure that the children and vulnerable person\'s welfare is safeguarded. It will be kept with the strictest confidence.')
  addSpacer(ctx, 12)
  
  const dec = data.declaration
  addKeyValue(ctx, 'Has any Social Service Department or Police Service ever conducted an enquiry or investigation into any allegations or concerns that you may pose an actual or potential risk to children or vulnerable adults?', dec?.socialServiceEnquiry)
  if (dec?.socialServiceDetails) addKeyValue(ctx, 'Details', dec.socialServiceDetails)
  addSpacer(ctx, 6)
  
  addKeyValue(ctx, 'Have you ever been convicted of any offence relating to children or vulnerable adults?', dec?.convictedOfOffence)
  if (dec?.convictedDetails) addKeyValue(ctx, 'Details', dec.convictedDetails)
  addSpacer(ctx, 6)
  
  addKeyValue(ctx, 'Have you ever been subject to any safeguarding investigation, criminal investigation or any investigations by previous employer?', dec?.safeguardingInvestigation)
  if (dec?.safeguardingDetails) addKeyValue(ctx, 'Details', dec.safeguardingDetails)
  addSpacer(ctx, 6)
  
  addKeyValue(ctx, 'Do you have any criminal convictions spent or unspent?', dec?.criminalConvictions)
  if (dec?.criminalDetails) addKeyValue(ctx, 'Details', dec.criminalDetails)
  addSpacer(ctx, 6)
  
  addKeyValue(ctx, 'Do you have any physical or mental health conditions which may hinder your ability to carry on or work for the purpose of care activities?', dec?.healthConditions)
  if (dec?.healthDetails) addKeyValue(ctx, 'Details', dec.healthDetails)
  addSpacer(ctx, 6)
  
  addKeyValue(ctx, 'Have you received cautions, reprimands or final warnings which are spent or unspent?', dec?.cautionsReprimands)
  if (dec?.cautionsDetails) addKeyValue(ctx, 'Details', dec.cautionsDetails)
  addSpacer(ctx, 8)
  
  drawText(ctx, 'I declare that to the best of my knowledge the above information, and that submitted in any accompanying documents, is correct, and')
  addSpacer(ctx, 4)
  drawText(ctx, 'I give permission for any enquiries that need to be made to confirm such matters as qualifications. Experience and dates of employment and for the release or check or any other organisations of such information as may be necessary for that purpose.')
  addSpacer(ctx, 4)
  drawText(ctx, 'I confirm that the above information given by me is correct and that I consent to my personal data being held/kept and kept by the receiving client agency in accordance with the Data Protection Act 1998.')

  // Terms & Policy
  // Calculate space needed for the entire Terms & Policy section
  const termsPolicySectionHeight = 
    ctx.lineHeight * 2 +  // Section title + underline + spacing
    ctx.lineHeight * 6 +  // 3 fields (each could wrap to 2 lines)
    50;                   // Extra buffer for safety

  // If not enough space, start on a new page
  if (ctx.y - termsPolicySectionHeight < ctx.margin) {
    addPage(ctx);
  }

  addSectionTitle(ctx, '8. Terms & Policy')
addKeyValue(ctx, 'Consent to Terms', data.termsPolicy?.consentToTerms ? 'Yes' : 'No')
  addKeyValue(ctx, 'Signature (name)', data.termsPolicy?.signature)
  addKeyValue(ctx, 'Date', formatDateDDMMYYYY(data.termsPolicy?.date))


  const bytes = await doc.save()
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)

  const name = (data.personalInfo?.fullName || 'Applicant').replace(/\s+/g, '_')
  const filename = `Job_Application_${name}_${formatDateDDMMYYYY(new Date().toISOString())}.pdf`

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
