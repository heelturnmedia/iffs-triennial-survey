// ─────────────────────────────────────────────────────────────────────────────
// Individual response export — one participant's answers, question by question.
// CSV lives here (no heavy deps); the PDF variant is in exportIndividualPdf.ts
// so jsPDF stays out of the dashboard bundle until an admin clicks Export.
// ─────────────────────────────────────────────────────────────────────────────
import { extractQuestionsFromPage, type ExtractedQuestion } from '@/utils/surveyAnalytics'
import type { SubmissionRow } from '@/types'

export interface IndividualMeta {
  name: string
  email: string
  country: string
  institution: string
  reference: string
  status: string
  submittedAt: string
}

export interface IndividualQA {
  section: string
  number: number
  question: string
  answer: string
}

// Human-readable answer for any SurveyJS question type (labels, not raw values).
export function formatAnswerText(q: ExtractedQuestion, value: unknown): string {
  if (value === undefined || value === null || value === '') return ''

  switch (q.type) {
    case 'boolean':
      return value === true || value === 'true' ? 'Yes' : 'No'

    case 'checkbox':
    case 'tagbox': {
      if (!Array.isArray(value)) return String(value)
      const labelMap: Record<string, string> = {}
      for (const c of q.choices ?? []) labelMap[c.value] = c.text
      return (value as unknown[]).map((v) => labelMap[String(v)] || String(v)).join('; ')
    }

    case 'radiogroup':
    case 'dropdown': {
      if (typeof value === 'object') {
        const obj = value as Record<string, unknown>
        return String(obj['name'] ?? obj['cca2'] ?? JSON.stringify(value))
      }
      const labelMap: Record<string, string> = {}
      for (const c of q.choices ?? []) labelMap[c.value] = c.text
      return labelMap[String(value)] || String(value)
    }

    case 'matrix':
    case 'matrixdropdown': {
      if (typeof value !== 'object' || !value) return ''
      const rowLabelMap: Record<string, string> = {}
      const colLabelMap: Record<string, string> = {}
      for (const r of q.rows ?? []) rowLabelMap[r.value] = r.text
      for (const c of q.columns ?? []) colLabelMap[c.value] = c.text
      return Object.entries(value as Record<string, unknown>)
        .map(([rk, cv]) => `${rowLabelMap[rk] || rk}: ${colLabelMap[String(cv)] || String(cv)}`)
        .join('; ')
    }

    case 'multipletext': {
      if (typeof value !== 'object' || !value) return ''
      const itemLabelMap: Record<string, string> = {}
      for (const it of q.items ?? []) itemLabelMap[it.name] = it.title
      return Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${itemLabelMap[k] || k}: ${String(v)}`)
        .join('; ')
    }

    default: {
      if (typeof value === 'object') {
        const obj = value as Record<string, unknown>
        return String(obj['name'] ?? obj['cca2'] ?? JSON.stringify(value))
      }
      return String(value)
    }
  }
}

export function buildIndividualMeta(row: SubmissionRow): IndividualMeta {
  const name =
    `${row.first_name ?? row.profile?.first_name ?? ''} ${row.last_name ?? row.profile?.last_name ?? ''}`.trim() ||
    'Unknown'
  return {
    name,
    email: row.email ?? row.profile?.email ?? '',
    country: String(row.data?.['Country'] ?? row.country ?? row.profile?.country ?? ''),
    institution: row.institution ?? row.profile?.institution ?? '',
    reference: row.reference_no ?? '',
    status: row.status,
    submittedAt: row.submitted_at ? new Date(row.submitted_at).toUTCString() : '',
  }
}

// Flatten every question in every section with this participant's answer.
export function buildIndividualQA(
  row: SubmissionRow,
  pages: unknown[],
  sectionNames: string[]
): IndividualQA[] {
  const data = row.data ?? {}
  const out: IndividualQA[] = []
  let n = 0
  for (let i = 0; i < pages.length; i++) {
    const section = `${i + 1}. ${sectionNames[i] ?? `Section ${i + 1}`}`
    for (const q of extractQuestionsFromPage(pages[i])) {
      n += 1
      out.push({
        section,
        number: n,
        question: q.title || q.name,
        answer: formatAnswerText(q, data[q.name]),
      })
    }
  }
  return out
}

function escapeCsv(val: string): string {
  if (val.includes('"') || val.includes(',') || val.includes('\n') || val.includes('\r')) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}

export function safeFileStem(row: SubmissionRow): string {
  const meta = buildIndividualMeta(row)
  const who = (meta.reference || meta.name || meta.email || 'response')
    .replace(/[^A-Za-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `iffs-survey-response-${who}`.toLowerCase()
}

export function exportIndividualCsv(
  row: SubmissionRow,
  pages: unknown[],
  sectionNames: string[]
): void {
  const meta = buildIndividualMeta(row)
  const qa = buildIndividualQA(row, pages, sectionNames)

  const metaLines = [
    ['Name', meta.name],
    ['Email', meta.email],
    ['Country', meta.country],
    ['Institution', meta.institution],
    ['Reference', meta.reference],
    ['Status', meta.status],
    ['Submitted', meta.submittedAt],
  ].map(([k, v]) => `${escapeCsv(k)},${escapeCsv(v)}`)

  const header = ['Section', 'Q#', 'Question', 'Answer'].map(escapeCsv).join(',')
  const rows = qa.map((r) =>
    [r.section, String(r.number), r.question, r.answer].map(escapeCsv).join(',')
  )

  const csv = [...metaLines, '', header, ...rows].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeFileStem(row)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
