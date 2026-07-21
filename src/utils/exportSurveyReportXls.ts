// ─────────────────────────────────────────────────────────────────────────────
// Surveillance Report — Excel (.xls) edition. Same aggregation as the PDF
// (shared helpers from exportSurveyReport), emitted as SpreadsheetML 2003 —
// Excel's native XML workbook format — so no spreadsheet dependency is needed.
// Three sheets: Summary (+methods), Regional Participation, Key Findings
// (flat, analyzable rows with numeric cells). Lazy-imported on click.
// ─────────────────────────────────────────────────────────────────────────────
import { extractQuestionsFromPage } from '@/utils/surveyAnalytics'
import { completedOnly, wilsonCI, INVITED_COUNTRIES } from '@/utils/insightsAnalytics'
import { getRegion } from '@/utils/countryRegions'
import type { Region } from '@/utils/countryRegions'
import { CHOICE_TYPES, REGION_ORDER, iso2Of, leadingAnswer } from '@/utils/exportSurveyReport'
import type { SubmissionRow } from '@/types'

// XML-escape a cell value.
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

type Cell = { v: string | number; style?: 'head' | 'label' | 'title' }

function cellXml(c: Cell): string {
  const style = c.style ? ` ss:StyleID="${c.style}"` : ''
  const type = typeof c.v === 'number' ? 'Number' : 'String'
  const value = typeof c.v === 'number' ? String(c.v) : esc(c.v)
  return `<Cell${style}><Data ss:Type="${type}">${value}</Data></Cell>`
}

function rowXml(cells: Cell[]): string {
  return `<Row>${cells.map(cellXml).join('')}</Row>`
}

function sheetXml(name: string, rows: string[], colWidths: number[] = []): string {
  const cols = colWidths.map((w) => `<Column ss:Width="${w}"/>`).join('')
  return (
    `<Worksheet ss:Name="${esc(name)}"><Table>${cols}${rows.join('')}</Table></Worksheet>`
  )
}

export function buildSurveyReportXml(
  submissions: SubmissionRow[],
  pages: unknown[],
  sectionNames: string[],
): string {
  const done = completedOnly(submissions)
  const withData = submissions.filter((s) => Object.keys(s.data ?? {}).length > 0)

  // Participation by region (same tallies as the PDF).
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

  // Methods disclosure (mirrors the PDF paragraph).
  const timestamps = done
    .flatMap((r) => [r.created_at, r.submitted_at])
    .filter((t): t is string => !!t)
    .map((t) => new Date(t).getTime())
    .filter((t) => Number.isFinite(t))
  const windowFrom = timestamps.length ? new Date(Math.min(...timestamps)).toUTCString().slice(5, 16) : '—'
  const windowTo = timestamps.length ? new Date(Math.max(...timestamps)).toUTCString().slice(5, 16) : '—'

  // ── Sheet 1: Summary ────────────────────────────────────────────────────────
  const summaryRows = [
    rowXml([{ v: 'IFFS 2027 Biennial Survey — Surveillance Report', style: 'title' }]),
    rowXml([{ v: `Generated ${new Date().toUTCString()}`, style: 'label' }]),
    rowXml([]),
    rowXml([{ v: 'Summary', style: 'head' }, { v: '', style: 'head' }]),
    rowXml([{ v: 'Responses started', style: 'label' }, { v: withData.length }]),
    rowXml([{ v: 'Responses completed', style: 'label' }, { v: done.length }]),
    rowXml([{ v: 'Countries represented', style: 'label' }, { v: allCountries.size }]),
    rowXml([{ v: 'Countries invited', style: 'label' }, { v: INVITED_COUNTRIES }]),
    rowXml([
      { v: 'Country response rate (%)', style: 'label' },
      { v: Math.round((allCountries.size / INVITED_COUNTRIES) * 1000) / 10 },
    ]),
    rowXml([]),
    rowXml([{ v: 'Methods', style: 'head' }]),
    rowXml([{
      v:
        `${INVITED_COUNTRIES} countries were invited to participate in the IFFS 2027 Biennial Survey. ` +
        `Completed responses were collected between ${windowFrom} and ${windowTo}. The unit of analysis is ` +
        `the country; where a country submitted more than one completed response, all are included and ` +
        `duplicates are flagged in the platform's data-quality review. Analyses are unweighted. Percentages ` +
        `are reported with numerators, denominators, and 95% Wilson confidence intervals. Free-text ` +
        `responses are excluded from tabulation. Data snapshot: ${new Date().toISOString().slice(0, 10)}.`,
    }]),
  ]

  // ── Sheet 2: Regional participation ────────────────────────────────────────
  const regionalRows = [
    rowXml([
      { v: 'Region', style: 'head' },
      { v: 'Countries', style: 'head' },
      { v: 'Responses', style: 'head' },
    ]),
    ...REGION_ORDER.filter((r) => regionResponses.has(r)).map((r) =>
      rowXml([
        { v: r as string },
        { v: regionCountries.get(r)?.size ?? 0 },
        { v: regionResponses.get(r) ?? 0 },
      ]),
    ),
  ]

  // ── Sheet 3: Key findings (flat, analyzable) ───────────────────────────────
  const findingRows: string[] = [
    rowXml([
      { v: 'Section', style: 'head' },
      { v: 'Question', style: 'head' },
      { v: 'Leading answer', style: 'head' },
      { v: 'Share (%)', style: 'head' },
      { v: 'CI low (%)', style: 'head' },
      { v: 'CI high (%)', style: 'head' },
      { v: 'n', style: 'head' },
      { v: 'N', style: 'head' },
    ]),
  ]
  pages.forEach((page, i) => {
    const section = `${i + 1}. ${sectionNames[i] ?? `Section ${i + 1}`}`
    for (const q of extractQuestionsFromPage(page)) {
      if (!CHOICE_TYPES.has(q.type)) continue
      const lead = leadingAnswer(q, done)
      if (!lead) continue
      const ci = wilsonCI(lead.count, lead.n)
      findingRows.push(
        rowXml([
          { v: section },
          { v: q.title || q.name },
          { v: lead.label },
          { v: Math.round(lead.pct * 1000) / 10 },
          { v: Math.round(ci.lo * 1000) / 10 },
          { v: Math.round(ci.hi * 1000) / 10 },
          { v: lead.count },
          { v: lead.n },
        ]),
      )
    }
  })

  return (
    `<?xml version="1.0"?>` +
    `<?mso-application progid="Excel.Sheet"?>` +
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"` +
    ` xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">` +
    `<Styles>` +
    `<Style ss:ID="title"><Font ss:Bold="1" ss:Size="14"/></Style>` +
    `<Style ss:ID="head"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1D7733" ss:Pattern="Solid"/></Style>` +
    `<Style ss:ID="label"><Font ss:Color="#7A8A96"/></Style>` +
    `</Styles>` +
    sheetXml('Summary', summaryRows, [180, 460]) +
    sheetXml('Regional Participation', regionalRows, [110, 80, 80]) +
    sheetXml('Key Findings', findingRows, [150, 340, 200, 70, 70, 70, 40, 40]) +
    `</Workbook>`
  )
}

export function exportSurveyReportXls(
  submissions: SubmissionRow[],
  pages: unknown[],
  sectionNames: string[],
): void {
  const xml = buildSurveyReportXml(submissions, pages, sectionNames)
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `iffs-surveillance-report-${new Date().toISOString().slice(0, 10)}.xls`
  a.click()
  URL.revokeObjectURL(url)
}
