// ─────────────────────────────────────────────────────────────────────────────
// Templated Surveillance Report — a multi-section PDF digest of the whole survey:
// cover + summary, regional participation, and per-section key-findings tables
// (the leading answer to each choice question, globally). Lazy-imported on click
// so jsPDF stays in its own chunk.
// ─────────────────────────────────────────────────────────────────────────────
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { extractQuestionsFromPage, type ExtractedQuestion } from '@/utils/surveyAnalytics'
import { completedOnly, wilsonCI, INVITED_COUNTRIES } from '@/utils/insightsAnalytics'
import { getRegion, resolveCountryToIso2 } from '@/utils/countryRegions'
import type { Region } from '@/utils/countryRegions'
import type { SubmissionRow } from '@/types'

const GREEN: [number, number, number] = [29, 119, 51]
const GRAY: [number, number, number] = [122, 138, 150]
const DARK: [number, number, number] = [13, 17, 23]
const WHITE: [number, number, number] = [255, 255, 255]
const ALT_ROW: [number, number, number] = [247, 249, 247]

// Shared with the XLS exporter so both report formats state identical numbers.
export const CHOICE_TYPES = new Set(['radiogroup', 'dropdown', 'boolean', 'checkbox', 'tagbox'])
export const REGION_ORDER: Region[] = ['Africa', 'Americas', 'Asia', 'Europe', 'Oceania', 'Unknown']

export function iso2Of(row: SubmissionRow): string {
  const c = (row.data?.['Country'] ?? row.country ?? row.profile?.country) as string | undefined
  return c ? (resolveCountryToIso2(c) ?? '').toUpperCase() : ''
}

function labelFor(q: ExtractedQuestion, value: string): string {
  if (q.type === 'boolean') return value === 'true' ? 'Yes' : 'No'
  return q.choices?.find((c) => c.value === value)?.text ?? value
}

// The most common answer to a choice question among completed responses.
export function leadingAnswer(
  q: ExtractedQuestion,
  done: SubmissionRow[],
): { label: string; pct: number; n: number; count: number } | null {
  const counts = new Map<string, number>()
  let n = 0
  for (const r of done) {
    const v = r.data?.[q.name]
    if (v === undefined || v === null || v === '') continue
    n += 1
    if (Array.isArray(v)) {
      for (const item of v as unknown[]) {
        const key = q.type === 'boolean' ? String(item) : String(item)
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
    } else {
      const key = q.type === 'boolean' ? (v === true || v === 'true' ? 'true' : 'false') : String(v)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  if (n === 0 || counts.size === 0) return null
  let topVal = ''
  let topCount = -1
  counts.forEach((c, val) => {
    if (c > topCount) { topCount = c; topVal = val }
  })
  return { label: labelFor(q, topVal), pct: topCount / n, n, count: topCount }
}

const pctStr = (v: number) => `${Math.round(v * 100)}%`

export function buildSurveyReportDoc(
  submissions: SubmissionRow[],
  pages: unknown[],
  sectionNames: string[],
): jsPDF {
  const done = completedOnly(submissions)
  const withData = submissions.filter((s) => Object.keys(s.data ?? {}).length > 0)

  // ── Participation by region ────────────────────────────────────────────────
  const regionCountries = new Map<Region, Set<string>>()
  const regionResponses = new Map<Region, number>()
  const allCountries = new Set<string>()
  for (const r of done) {
    const iso = iso2Of(r)
    if (!iso) continue
    allCountries.add(iso)
    const region = getRegion(iso)
    if (!regionCountries.has(region)) regionCountries.set(region, new Set())
    regionCountries.get(region)!.add(iso)
    regionResponses.set(region, (regionResponses.get(region) ?? 0) + 1)
  }

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 40
  const contentW = pageW - margin * 2
  let y = margin

  // ── Cover ──────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...DARK)
  doc.text('IFFS 2026 Biennial Survey', margin, y + 6)
  y += 30
  doc.setFontSize(15)
  doc.setTextColor(...GREEN)
  doc.text('Surveillance Report', margin, y)
  y += 18
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  doc.text(`Generated ${new Date().toUTCString()}`, margin, y)
  y += 24

  // ── Summary stats ──────────────────────────────────────────────────────────
  autoTable(doc, {
    head: [['Summary', '']],
    body: [
      ['Responses started', String(withData.length)],
      ['Responses completed', String(done.length)],
      ['Countries represented', `${allCountries.size} of ${INVITED_COUNTRIES} invited (${Math.round((allCountries.size / INVITED_COUNTRIES) * 100)}%)`],
      ['Regions represented', String([...regionResponses.keys()].filter((r) => r !== 'Unknown').length)],
    ],
    startY: y,
    margin: { left: margin, right: margin },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 5, textColor: DARK },
    headStyles: { fillColor: GREEN, textColor: WHITE, fontStyle: 'bold' },
    columnStyles: { 0: { fontStyle: 'bold', textColor: GRAY, cellWidth: 200 } },
    tableWidth: contentW,
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14

  // ── Methods paragraph — journal-style reporting disclosure ─────────────────
  const timestamps = done
    .flatMap((r) => [r.created_at, r.submitted_at])
    .filter((t): t is string => !!t)
    .map((t) => new Date(t).getTime())
    .filter((t) => Number.isFinite(t))
  const windowFrom = timestamps.length ? new Date(Math.min(...timestamps)).toUTCString().slice(5, 16) : '—'
  const windowTo = timestamps.length ? new Date(Math.max(...timestamps)).toUTCString().slice(5, 16) : '—'
  const methods =
    `Methods: ${INVITED_COUNTRIES} countries were invited to participate in the IFFS 2026 Biennial Survey. ` +
    `Completed responses were collected between ${windowFrom} and ${windowTo}. The unit of analysis is the ` +
    `country; where a country submitted more than one completed response, all are included and duplicates are ` +
    `flagged in the platform's data-quality review. Analyses are unweighted. Percentages are reported with ` +
    `numerators, denominators, and 95% Wilson confidence intervals. Free-text responses are excluded from ` +
    `tabulation. Data snapshot: ${new Date().toISOString().slice(0, 10)}.`
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...GRAY)
  const methodsLines = doc.splitTextToSize(methods, contentW)
  if (y + methodsLines.length * 11 > pageH - margin) { doc.addPage(); y = margin }
  doc.text(methodsLines, margin, y)
  y += methodsLines.length * 11 + 14

  // ── Participation by region ────────────────────────────────────────────────
  const regionBody = REGION_ORDER
    .filter((r) => regionResponses.has(r))
    .map((r) => [
      r,
      String(regionCountries.get(r)?.size ?? 0),
      String(regionResponses.get(r) ?? 0),
    ])
  autoTable(doc, {
    head: [['Region', 'Countries', 'Responses']],
    body: regionBody.length > 0 ? regionBody : [['—', '0', '0']],
    startY: y,
    margin: { left: margin, right: margin },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 5, textColor: DARK },
    headStyles: { fillColor: GREEN, textColor: WHITE, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: ALT_ROW },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
    tableWidth: contentW,
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20

  // ── Key findings per section ───────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...DARK)
  if (y + 40 > pageH - margin) { doc.addPage(); y = margin }
  doc.text('Key Findings by Section', margin, y)
  y += 8

  pages.forEach((page, i) => {
    const section = sectionNames[i] ?? `Section ${i + 1}`
    const choiceQs = extractQuestionsFromPage(page).filter((q) => CHOICE_TYPES.has(q.type))
    const body: string[][] = []
    for (const q of choiceQs) {
      const lead = leadingAnswer(q, done)
      if (!lead) continue
      const ci = wilsonCI(lead.count, lead.n)
      body.push([
        q.title || q.name,
        lead.label,
        `${pctStr(lead.pct)} (${Math.round(ci.lo * 100)}–${Math.round(ci.hi * 100)})`,
        `${lead.count}/${lead.n}`,
      ])
    }
    if (body.length === 0) return

    if (y + 60 > pageH - margin) { doc.addPage(); y = margin }
    y += 14
    doc.setFillColor(...GREEN)
    doc.rect(margin, y, contentW, 20, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...WHITE)
    doc.text(`${i + 1}. ${section}`, margin + 8, y + 14)
    y += 26

    autoTable(doc, {
      head: [['Question', 'Leading answer', '% (95% CI)', 'n/N']],
      body,
      startY: y,
      margin: { left: margin, right: margin },
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 4, textColor: DARK, overflow: 'linebreak' },
      headStyles: { fillColor: GREEN, textColor: WHITE, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: ALT_ROW },
      columnStyles: {
        0: { cellWidth: contentW * 0.44 },
        2: { halign: 'right', cellWidth: 82 },
        3: { halign: 'right', cellWidth: 48 },
      },
      tableWidth: contentW,
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  })

  // ── Footer ─────────────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...GRAY)
    doc.text('IFFS 2026 Biennial Survey — Surveillance Report — Confidential', margin, pageH - 20)
    doc.text(`Page ${p} of ${pageCount}`, pageW - margin, pageH - 20, { align: 'right' })
  }

  return doc
}

export function exportSurveyReport(
  submissions: SubmissionRow[],
  pages: unknown[],
  sectionNames: string[],
): void {
  const doc = buildSurveyReportDoc(submissions, pages, sectionNames)
  doc.save(`iffs-surveillance-report-${new Date().toISOString().slice(0, 10)}.pdf`)
}
