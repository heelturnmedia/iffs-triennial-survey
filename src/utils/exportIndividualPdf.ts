// ─────────────────────────────────────────────────────────────────────────────
// Individual response PDF — one participant's full survey, question by question,
// IFFS-branded. Lazy-imported on click so jsPDF stays in its own chunk.
// ─────────────────────────────────────────────────────────────────────────────
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  buildIndividualMeta,
  buildIndividualQA,
  safeFileStem,
} from '@/utils/exportIndividualResponse'
import type { SubmissionRow } from '@/types'

const GREEN: [number, number, number] = [29, 119, 51]
const GRAY: [number, number, number] = [122, 138, 150]
const DARK: [number, number, number] = [13, 17, 23]
const WHITE: [number, number, number] = [255, 255, 255]
const ALT_ROW: [number, number, number] = [247, 249, 247]

export function buildIndividualPdfDoc(
  row: SubmissionRow,
  pages: unknown[],
  sectionNames: string[]
): jsPDF {
  const meta = buildIndividualMeta(row)
  const qa = buildIndividualQA(row, pages, sectionNames)

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 40
  const contentW = pageW - margin * 2
  let y = margin

  // ── Title block ──────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...DARK)
  doc.text('IFFS 2027 Biennial Survey', margin, y)
  y += 22
  doc.setFontSize(13)
  doc.setTextColor(...GREEN)
  doc.text('Individual Survey Response', margin, y)
  y += 20

  // ── Participant meta table ───────────────────────────────────────────────
  autoTable(doc, {
    body: [
      ['Name', meta.name, 'Email', meta.email],
      ['Country', meta.country || '—', 'Institution', meta.institution || '—'],
      ['Reference', meta.reference || '—', 'Status', meta.status],
      ['Submitted', meta.submittedAt || '—', 'Exported', new Date().toUTCString()],
    ],
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 4, textColor: DARK },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: GRAY, cellWidth: 70 },
      2: { fontStyle: 'bold', textColor: GRAY, cellWidth: 70 },
    },
    tableWidth: contentW,
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16

  // ── Per-section Q/A tables ───────────────────────────────────────────────
  let currentSection = ''
  let body: string[][] = []

  const flush = () => {
    if (!currentSection || body.length === 0) return
    if (y + 60 > pageH - margin) {
      doc.addPage()
      y = margin
    }
    doc.setFillColor(...GREEN)
    doc.rect(margin, y, contentW, 20, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...WHITE)
    doc.text(currentSection, margin + 8, y + 14)
    y += 26
    autoTable(doc, {
      head: [['#', 'Question', 'Answer']],
      body,
      startY: y,
      margin: { left: margin, right: margin },
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 4, textColor: DARK },
      headStyles: { fillColor: GREEN, textColor: WHITE, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: ALT_ROW },
      columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: contentW * 0.45 } },
      tableWidth: contentW,
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14
    body = []
  }

  for (const r of qa) {
    if (r.section !== currentSection) {
      flush()
      currentSection = r.section
    }
    body.push([String(r.number), r.question, r.answer || '—'])
  }
  flush()

  // ── Footer on every page ─────────────────────────────────────────────────
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

export function exportIndividualPdf(
  row: SubmissionRow,
  pages: unknown[],
  sectionNames: string[]
): void {
  const doc = buildIndividualPdfDoc(row, pages, sectionNames)
  doc.save(`${safeFileStem(row)}.pdf`)
}
