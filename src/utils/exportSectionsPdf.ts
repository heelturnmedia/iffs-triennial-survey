// ─────────────────────────────────────────────────────────────────────────────
// Export the aggregated Section Responses (all sections) as a readable PDF
// report. Reuses the same aggregation as the on-screen Section Responses tab so
// the numbers match exactly.
// ─────────────────────────────────────────────────────────────────────────────
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  extractQuestionsFromPage,
  aggregateSection,
  sortedChoiceCounts,
  type ExtractedQuestion,
} from '@/utils/surveyAnalytics'
import type { SubmissionRow } from '@/types'

const GREEN: [number, number, number] = [29, 119, 51]
const GRAY: [number, number, number] = [122, 138, 150]
const DARK: [number, number, number] = [13, 17, 23]
const WHITE: [number, number, number] = [255, 255, 255]
const ALT_ROW: [number, number, number] = [247, 249, 247]

const TYPE_LABEL: Record<string, string> = {
  radiogroup: 'Single choice',
  dropdown: 'Dropdown',
  checkbox: 'Multi-choice',
  tagbox: 'Multi-choice',
  text: 'Text',
  comment: 'Long text',
  matrix: 'Matrix',
  matrixdropdown: 'Matrix',
  multipletext: 'Multi-field',
  boolean: 'Yes/No',
  rating: 'Rating',
  paneldynamic: 'Dynamic list',
}

function choiceLabel(q: ExtractedQuestion, key: string): string {
  for (const c of q.choices ?? []) if (c.value === key) return c.text
  for (const r of q.rows ?? []) if (r.value === key) return r.text
  if (key === 'true') return 'Yes'
  if (key === 'false') return 'No'
  return key
}

export function exportAllSectionsAsPdf(
  submissions: SubmissionRow[],
  pages: unknown[],
  sectionNames: string[],
  sectionDescriptions: string[] = [],
): void {
  const doc = buildSectionsPdfDoc(submissions, pages, sectionNames, sectionDescriptions)
  doc.save(`iffs-survey-section-responses-${new Date().toISOString().slice(0, 10)}.pdf`)
}

// Builds the report document. Separated from save() so it can be unit-tested
// (and reused, e.g. to email or preview the report) without a browser.
export function buildSectionsPdfDoc(
  submissions: SubmissionRow[],
  pages: unknown[],
  sectionNames: string[],
  sectionDescriptions: string[] = [],
): jsPDF {
  const totalSubmitted = submissions.filter(
    (s) => s.status === 'submitted' || s.status === 'reviewed'
  ).length

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 40
  const contentW = pageW - margin * 2
  let y = margin

  // Add a page if the next `needed` points won't fit in the current one.
  const ensure = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage()
      y = margin
    }
  }

  // Render an autoTable starting at the cursor and advance the cursor to below it.
  const table = (head: string[][], body: (string | number)[][]) => {
    autoTable(doc, {
      head,
      body,
      startY: y,
      margin: { left: margin, right: margin },
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 4, textColor: DARK },
      headStyles: { fillColor: GREEN, textColor: WHITE, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: ALT_ROW },
      tableWidth: contentW,
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12
  }

  // ── Title block ──────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...DARK)
  doc.text('IFFS 2027 Biennial Survey', margin, y)
  y += 22
  doc.setFontSize(13)
  doc.setTextColor(...GREEN)
  doc.text('Section Responses Report', margin, y)
  y += 18
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  const generated = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  doc.text(
    `Generated ${generated}  ·  ${totalSubmitted} submitted ${totalSubmitted === 1 ? 'response' : 'responses'}`,
    margin,
    y
  )
  y += 26

  // ── Sections ─────────────────────────────────────────────────────────────
  for (let i = 0; i < pages.length; i++) {
    const questions = extractQuestionsFromPage(pages[i])
    const aggregated = aggregateSection(questions, submissions)
    const sectionName = sectionNames[i] ?? `Section ${i + 1}`

    ensure(60)
    // Section heading bar
    doc.setFillColor(...GREEN)
    doc.rect(margin, y, contentW, 22, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(255, 255, 255)
    doc.text(`${i + 1}. ${sectionName}`, margin + 8, y + 15)
    y += 30

    const desc = sectionDescriptions[i]
    if (desc) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...GRAY)
      const lines = doc.splitTextToSize(desc, contentW) as string[]
      ensure(lines.length * 11 + 6)
      doc.text(lines, margin, y)
      y += lines.length * 11 + 10
    }

    if (aggregated.length === 0) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(9)
      doc.setTextColor(...GRAY)
      ensure(16)
      doc.text('No questions in this section.', margin, y)
      y += 20
      continue
    }

    for (const agg of aggregated) {
      const { question: q, totalAnswered } = agg

      // Question title + meta line
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      doc.setTextColor(...DARK)
      const titleLines = doc.splitTextToSize(q.title || q.name, contentW) as string[]
      ensure(titleLines.length * 12 + 26)
      doc.text(titleLines, margin, y)
      y += titleLines.length * 12 + 2

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...GRAY)
      doc.text(
        `${TYPE_LABEL[q.type] ?? q.type}  ·  ${totalAnswered}/${totalSubmitted} responded`,
        margin,
        y
      )
      y += 12

      if (totalAnswered === 0) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(8.5)
        doc.setTextColor(...GRAY)
        doc.text('No responses yet.', margin, y)
        y += 18
        continue
      }

      // Choice questions → Option / Count / %
      if (agg.choiceCounts) {
        const sorted = sortedChoiceCounts(agg.choiceCounts)
        const body = sorted.map(({ label, count }) => [
          choiceLabel(q, label),
          count,
          totalAnswered > 0 ? `${Math.round((count / totalAnswered) * 100)}%` : '0%',
        ])
        table([['Option', 'Count', '%']], body)
        continue
      }

      // Text questions → one row per response
      if (agg.textResponses) {
        const body = agg.textResponses.map((r) => [r])
        table([[`Responses (${agg.textResponses.length})`]], body)
        continue
      }

      // Matrix questions → row label + per-column counts
      if (agg.matrixCounts) {
        const colDefs = q.columns ?? []
        const rowDefs = q.rows ?? []
        const colKeys = colDefs.length
          ? colDefs.map((c) => c.value)
          : Array.from(new Set(Object.values(agg.matrixCounts).flatMap((c) => Object.keys(c))))
        const rowKeys = rowDefs.length ? rowDefs.map((r) => r.value) : Object.keys(agg.matrixCounts)
        const head = [['', ...colKeys.map((ck) => colDefs.find((c) => c.value === ck)?.text || ck)]]
        const body = rowKeys.map((rk) => {
          const rowData = agg.matrixCounts![rk] ?? {}
          return [
            rowDefs.find((r) => r.value === rk)?.text || rk,
            ...colKeys.map((ck) => (rowData[ck] ? String(rowData[ck]) : '—')),
          ]
        })
        table(head, body)
        continue
      }

      // Multi-field questions → label + count of responses per field, then values
      if (agg.multitextAnswers) {
        const items = q.items ?? []
        const body: string[][] = []
        for (const item of items) {
          const vals = agg.multitextAnswers[item.name] ?? []
          body.push([item.title || item.name, vals.length ? vals.join('  |  ') : '—'])
        }
        table([['Field', 'Responses']], body)
        continue
      }

      // paneldynamic / unsupported → note
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8.5)
      doc.setTextColor(...GRAY)
      ensure(16)
      doc.text('Per-respondent data — see CSV export.', margin, y)
      y += 18
    }

    y += 6
  }

  // ── Footer (page numbers) on every page ──────────────────────────────────
  const pageCount = doc.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...GRAY)
    doc.text('IFFS 2027 Biennial Survey — Confidential', margin, pageH - 20)
    doc.text(`Page ${p} of ${pageCount}`, pageW - margin, pageH - 20, { align: 'right' })
  }

  return doc
}
