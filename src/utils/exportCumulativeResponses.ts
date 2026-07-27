// ─────────────────────────────────────────────────────────────────────────────
// Cumulative responses export — a wide CSV matrix of EVERY question against
// EVERY user's answer. One row per participant; meta columns first, then one
// column per survey question (human-readable answers via formatAnswerText, so
// every question type is handled). This is the raw analysable dataset admins
// need for Excel/SPSS/R — distinct from the roster CSV (meta only) and the
// aggregated Surveillance Report. Lazy-imported on click.
// ─────────────────────────────────────────────────────────────────────────────
import { extractQuestionsFromPage } from '@/utils/surveyAnalytics'
import { buildIndividualMeta, formatAnswerText } from '@/utils/exportIndividualResponse'
import type { SubmissionRow } from '@/types'

// Quote a CSV field only when needed (comma, quote, or newline), doubling any
// embedded quotes — RFC 4180.
function csvField(val: string): string {
  if (/[",\r\n]/.test(val)) return `"${val.replace(/"/g, '""')}"`
  return val
}

// Flatten every question across all pages, preserving survey order and giving
// each a unique, traceable column header ("<global#>. <title>  [<section>]").
function buildQuestionColumns(pages: unknown[], sectionNames: string[]) {
  const cols: { name: string; header: string; q: ReturnType<typeof extractQuestionsFromPage>[number] }[] = []
  let n = 0
  for (let i = 0; i < pages.length; i++) {
    const section = sectionNames[i] ?? `Section ${i + 1}`
    for (const q of extractQuestionsFromPage(pages[i])) {
      n += 1
      cols.push({ name: q.name, header: `${n}. ${q.title || q.name}  [${i + 1}. ${section}]`, q })
    }
  }
  return cols
}

export function buildCumulativeCsv(
  submissions: SubmissionRow[],
  pages: unknown[],
  sectionNames: string[],
): string {
  const questionCols = buildQuestionColumns(pages, sectionNames)

  const metaHeaders = ['Reference', 'Name', 'Email', 'Country', 'Institution', 'Status', 'Submitted At']
  const header = [...metaHeaders, ...questionCols.map((c) => c.header)]

  const lines = submissions.map((sub) => {
    const meta = buildIndividualMeta(sub)
    const data = sub.data ?? {}
    const cells = [
      meta.reference,
      meta.name,
      meta.email,
      meta.country,
      meta.institution,
      meta.status,
      meta.submittedAt,
      ...questionCols.map((c) => formatAnswerText(c.q, data[c.name])),
    ]
    return cells.map((v) => csvField(String(v ?? ''))).join(',')
  })

  // Prepend a UTF-8 BOM so Excel renders accented names/answers correctly.
  return '﻿' + [header.map(csvField).join(','), ...lines].join('\r\n')
}

export function exportCumulativeCsv(
  submissions: SubmissionRow[],
  pages: unknown[],
  sectionNames: string[],
): void {
  const csv = buildCumulativeCsv(submissions, pages, sectionNames)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `iffs-cumulative-responses-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
