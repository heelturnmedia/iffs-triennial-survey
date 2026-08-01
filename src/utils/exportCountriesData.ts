// ─────────────────────────────────────────────────────────────────────────────
// Countries Data exports — the per-country submissions table (PDF + XLS, with a
// "signed up — not started" list) and the country-wise answer report (PDF, with
// an optional globe snapshot). Lazy-loaded on click so jsPDF stays out of the
// main bundle.
// ─────────────────────────────────────────────────────────────────────────────
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { CountryCountRow, NotStartedUser } from '@/utils/countriesData'
import { countryTotals } from '@/utils/countriesData'
import type { CountryPrevalence } from '@/utils/insightsAnalytics'

const GREEN: [number, number, number] = [29, 119, 51]
const GRAY: [number, number, number] = [122, 138, 150]
const DARK: [number, number, number] = [13, 17, 23]
const WHITE: [number, number, number] = [255, 255, 255]
const ALT_ROW: [number, number, number] = [247, 249, 247]

const today = () => new Date().toISOString().slice(0, 10)
const day = (iso: string) => { try { return new Date(iso).toISOString().slice(0, 10) } catch { return '—' } }

function pdfFooter(doc: jsPDF): void {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const pageCount = doc.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRAY)
    doc.text('IFFS 2027 Biennial Survey — Confidential', 40, pageH - 20)
    doc.text(`Page ${p} of ${pageCount}`, pageW - 40, pageH - 20, { align: 'right' })
  }
}

function lastY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
}

// ── Section 1: country submissions table + not-started people ────────────────

export function exportCountriesTablePdf(tableRows: CountryCountRow[], notStarted: NotStartedUser[]): void {
  const totals = countryTotals(tableRows)
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 40
  const contentW = doc.internal.pageSize.getWidth() - margin * 2
  let y = margin

  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...DARK)
  doc.text('IFFS 2027 Biennial Survey', margin, y); y += 22
  doc.setFontSize(13); doc.setTextColor(...GREEN)
  doc.text('Submissions by Country', margin, y); y += 18
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRAY)
  doc.text(
    `${totals.countriesActive} countries with activity · ${totals.submitted} submitted · ` +
    `${totals.inProgress} in progress · ${totals.notStarted} not started · ${totals.total} signed-up users · ` +
    `Generated ${new Date().toUTCString()}`,
    margin, y,
  )
  y += 16

  autoTable(doc, {
    head: [['Country', 'Submitted', 'In Progress', 'Not Started', 'Total']],
    body: tableRows.map((r) => [r.country, String(r.submitted), String(r.inProgress), String(r.notStarted), String(r.total)]),
    foot: [['Total', String(totals.submitted), String(totals.inProgress), String(totals.notStarted), String(totals.total)]],
    startY: y,
    margin: { left: margin, right: margin },
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 4, textColor: DARK },
    headStyles: { fillColor: GREEN, textColor: WHITE, fontStyle: 'bold' },
    footStyles: { fillColor: ALT_ROW, textColor: DARK, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: ALT_ROW },
    columnStyles: { 0: { cellWidth: contentW * 0.44 }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    tableWidth: contentW,
  })
  y = lastY(doc) + 22

  // ── Signed up — not started ────────────────────────────────────────────────
  if (y + 60 > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); y = margin }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...GREEN)
  doc.text(`Signed Up — Not Started (${notStarted.length})`, margin, y); y += 14
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRAY)
  doc.text('Users who created an account but have no submitted or in-progress response.', margin, y); y += 12

  autoTable(doc, {
    head: [['Name', 'Email', 'Country', 'Signed up', 'Opened survey?']],
    body: notStarted.length
      ? notStarted.map((u) => [u.name, u.email, u.country, day(u.signedUp), u.opened ? 'Opened (page 0)' : 'Never opened'])
      : [['—', 'No users have signed up without starting.', '', '', '']],
    startY: y,
    margin: { left: margin, right: margin },
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 4, textColor: DARK },
    headStyles: { fillColor: GREEN, textColor: WHITE, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: ALT_ROW },
    columnStyles: { 1: { cellWidth: contentW * 0.3 } },
    tableWidth: contentW,
  })

  pdfFooter(doc)
  doc.save(`iffs-countries-submissions-${today()}.pdf`)
}

// ── SpreadsheetML helpers ────────────────────────────────────────────────────

function xmlEsc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
function xlsCell(v: string | number, head = false): string {
  const style = head ? ' ss:StyleID="head"' : ''
  const type = typeof v === 'number' ? 'Number' : 'String'
  const value = typeof v === 'number' ? String(v) : xmlEsc(v)
  return `<Cell${style}><Data ss:Type="${type}">${value}</Data></Cell>`
}
function xlsRow(cells: Array<string | number>, head = false): string {
  return `<Row>${cells.map((c) => xlsCell(c, head)).join('')}</Row>`
}
interface Sheet { name: string; rows: string[]; colWidths: number[] }
function workbook(sheets: Sheet[]): string {
  const body = sheets.map((s) => {
    const cols = s.colWidths.map((w) => `<Column ss:Width="${w}"/>`).join('')
    return `<Worksheet ss:Name="${xmlEsc(s.name)}"><Table>${cols}${s.rows.join('')}</Table></Worksheet>`
  }).join('')
  return (
    `<?xml version="1.0"?>` +
    `<?mso-application progid="Excel.Sheet"?>` +
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"` +
    ` xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">` +
    `<Styles><Style ss:ID="head"><Font ss:Bold="1" ss:Color="#FFFFFF"/>` +
    `<Interior ss:Color="#1D7733" ss:Pattern="Solid"/></Style></Styles>` +
    body +
    `</Workbook>`
  )
}
function downloadBlob(content: string, type: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportCountriesTableXls(tableRows: CountryCountRow[], notStarted: NotStartedUser[]): void {
  const totals = countryTotals(tableRows)
  const countrySheet: Sheet = {
    name: 'Submissions by Country',
    rows: [
      xlsRow(['Country', 'Submitted', 'In Progress', 'Not Started', 'Total'], true),
      ...tableRows.map((r) => xlsRow([r.country, r.submitted, r.inProgress, r.notStarted, r.total])),
      xlsRow(['Total', totals.submitted, totals.inProgress, totals.notStarted, totals.total], true),
    ],
    colWidths: [200, 80, 90, 90, 70],
  }
  const notStartedSheet: Sheet = {
    name: 'Signed Up - Not Started',
    rows: [
      xlsRow(['Name', 'Email', 'Country', 'Signed up', 'Opened survey?'], true),
      ...notStarted.map((u) => xlsRow([u.name, u.email, u.country, day(u.signedUp), u.opened ? 'Opened (page 0)' : 'Never opened'])),
    ],
    colWidths: [180, 240, 130, 90, 130],
  }
  downloadBlob(workbook([countrySheet, notStartedSheet]), 'application/vnd.ms-excel', `iffs-countries-submissions-${today()}.xls`)
}

// ── Section 2: country-wise answer report (PDF) ──────────────────────────────

export interface CountryAnswerReport {
  questionTitle: string
  sectionName: string
  answerLabel: string
  global: { n: number; count: number; prevalence: number }
  byCountry: CountryPrevalence[]
  mapImage?: { dataUrl: string; width: number; height: number }
}

export function exportCountryAnswerPdf(r: CountryAnswerReport): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 40
  const contentW = doc.internal.pageSize.getWidth() - margin * 2
  let y = margin

  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...DARK)
  doc.text('IFFS 2027 Biennial Survey', margin, y); y += 22
  doc.setFontSize(13); doc.setTextColor(...GREEN)
  doc.text('Answers by Country', margin, y); y += 20

  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...DARK)
  const qLines = doc.splitTextToSize(`${r.sectionName} — ${r.questionTitle}`, contentW)
  doc.text(qLines, margin, y); y += qLines.length * 13 + 2
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...GRAY)
  doc.text(
    `Answer mapped: "${r.answerLabel}"  ·  Global: ${Math.round(r.global.prevalence * 100)}% ` +
    `(${r.global.count} of ${r.global.n} respondents)`,
    margin, y,
  )
  y += 16

  if (r.mapImage && r.mapImage.width > 0) {
    const w = contentW
    const h = Math.min(w * (r.mapImage.height / r.mapImage.width), 300)
    try { doc.addImage(r.mapImage.dataUrl, 'PNG', margin, y, w, h); y += h + 14 } catch { /* skip on capture failure */ }
  }

  autoTable(doc, {
    head: [['Country', 'Respondents', `Chose "${r.answerLabel}"`, '%']],
    body: r.byCountry.map((c) => [c.name, String(c.n), String(c.count), `${Math.round(c.prevalence * 100)}%`]),
    startY: y,
    margin: { left: margin, right: margin },
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 4, textColor: DARK },
    headStyles: { fillColor: GREEN, textColor: WHITE, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: ALT_ROW },
    columnStyles: { 0: { cellWidth: contentW * 0.4 }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    tableWidth: contentW,
  })

  pdfFooter(doc)
  const stem = r.questionTitle.replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).toLowerCase()
  doc.save(`iffs-country-answers-${stem || 'question'}-${today()}.pdf`)
}
