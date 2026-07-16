// ─────────────────────────────────────────────────────────────────────────────
// Insights analytics — cross-country prevalence, completion funnel, quality.
// Operates on full SubmissionRow[] (with `data`), unlike the status-only map.
// ─────────────────────────────────────────────────────────────────────────────
import { resolveCountryToIso2, iso2ToCountryName } from '@/utils/countryRegions'
import { extractQuestionsFromPage, type ExtractedQuestion } from '@/utils/surveyAnalytics'
import type { SubmissionRow } from '@/types'

// Only completed responses feed cross-country analysis (drafts are noise).
export function completedOnly(subs: SubmissionRow[]): SubmissionRow[] {
  return subs.filter((s) => s.status === 'submitted' || s.status === 'reviewed')
}

function iso2Of(row: SubmissionRow): string {
  const c = (row.data?.['Country'] ?? row.country ?? row.profile?.country) as string | undefined
  return c ? (resolveCountryToIso2(c) ?? '').toUpperCase() : ''
}

// Did this respondent select `answerValue` for question `q`?
function answered(q: ExtractedQuestion, value: unknown, answerValue: string): boolean {
  if (value === undefined || value === null || value === '') return false
  if (Array.isArray(value)) return (value as unknown[]).map(String).includes(answerValue)
  if (q.type === 'boolean') return (value === true || value === 'true' ? 'true' : 'false') === answerValue
  return String(value) === answerValue
}

export interface CountryPrevalence {
  iso2: string
  name: string
  n: number          // respondents in that country who answered the question
  count: number      // of those, how many chose answerValue
  prevalence: number // count / n  (0..1)
}

export interface PrevalenceResult {
  byCountry: CountryPrevalence[]        // sorted desc by prevalence
  isoValue: Map<string, number>         // iso2Upper → prevalence (for the map)
  globalN: number
  globalCount: number
  globalPrevalence: number
}

// For a single choice question + one of its answer options, the share of each
// country's respondents who selected it — plus the global share.
export function choicePrevalenceByCountry(
  submissions: SubmissionRow[],
  q: ExtractedQuestion,
  answerValue: string
): PrevalenceResult {
  const done = completedOnly(submissions)
  const per = new Map<string, { n: number; count: number }>()
  let globalN = 0
  let globalCount = 0

  for (const row of done) {
    const value = row.data?.[q.name]
    if (value === undefined || value === null || value === '') continue // didn't answer
    const iso = iso2Of(row)
    if (!iso) continue
    globalN += 1
    const hit = answered(q, value, answerValue)
    if (hit) globalCount += 1
    const rec = per.get(iso) ?? { n: 0, count: 0 }
    rec.n += 1
    if (hit) rec.count += 1
    per.set(iso, rec)
  }

  const byCountry: CountryPrevalence[] = []
  const isoValue = new Map<string, number>()
  per.forEach((v, iso) => {
    const prevalence = v.n > 0 ? v.count / v.n : 0
    isoValue.set(iso, prevalence)
    byCountry.push({ iso2: iso, name: iso2ToCountryName(iso) || iso, n: v.n, count: v.count, prevalence })
  })
  byCountry.sort((a, b) => b.prevalence - a.prevalence || b.n - a.n)

  return {
    byCountry,
    isoValue,
    globalN,
    globalCount,
    globalPrevalence: globalN > 0 ? globalCount / globalN : 0,
  }
}

// ─── Completion funnel & quality ───────────────────────────────────────────────

export interface FunnelStep {
  section: string
  index: number
  reached: number  // respondents who answered ≥1 question in this section
  pct: number      // reached / totalWithData
}

// A section is "reached" if the respondent answered at least one of its questions.
export function completionFunnel(
  submissions: SubmissionRow[],
  pages: unknown[],
  sectionNames: string[]
): { steps: FunnelStep[]; totalWithData: number } {
  const withData = submissions.filter((s) => Object.keys(s.data ?? {}).length > 0)
  const total = withData.length
  const sectionQuestionNames = pages.map((p) => extractQuestionsFromPage(p).map((q) => q.name))

  const steps: FunnelStep[] = sectionQuestionNames.map((names, i) => {
    let reached = 0
    for (const s of withData) {
      const d = s.data ?? {}
      if (names.some((n) => d[n] !== undefined && d[n] !== null && d[n] !== '')) reached += 1
    }
    return {
      section: sectionNames[i] ?? `Section ${i + 1}`,
      index: i + 1,
      reached,
      pct: total > 0 ? reached / total : 0,
    }
  })
  return { steps, totalWithData: total }
}

// Median minutes from first save (created_at) to submitted_at, over submitted rows.
export function medianCompletionMinutes(submissions: SubmissionRow[]): number | null {
  const mins = completedOnly(submissions)
    .map((s) =>
      s.submitted_at && s.created_at
        ? (new Date(s.submitted_at).getTime() - new Date(s.created_at).getTime()) / 60000
        : null
    )
    .filter((m): m is number => m !== null && m >= 0)
    .sort((a, b) => a - b)
  if (mins.length === 0) return null
  const mid = Math.floor(mins.length / 2)
  return mins.length % 2 ? mins[mid] : (mins[mid - 1] + mins[mid]) / 2
}

export interface BlankQuestion {
  section: string
  question: string
  blankPct: number
  answered: number
  total: number
}

// Questions most often left blank / "unknown" among completed responses — a
// signal that the question is confusing or hard to answer.
export function mostBlankQuestions(
  submissions: SubmissionRow[],
  pages: unknown[],
  sectionNames: string[],
  topN = 12
): BlankQuestion[] {
  const done = completedOnly(submissions)
  const total = done.length
  if (total === 0) return []
  const out: BlankQuestion[] = []

  const isBlankOrUnknown = (v: unknown): boolean => {
    if (v === undefined || v === null || v === '') return true
    if (typeof v === 'string') return v.trim().toLowerCase() === 'unknown'
    if (Array.isArray(v)) return v.length === 0
    return false
  }

  for (let i = 0; i < pages.length; i++) {
    const section = sectionNames[i] ?? `Section ${i + 1}`
    for (const q of extractQuestionsFromPage(pages[i])) {
      let answeredCount = 0
      for (const s of done) if (!isBlankOrUnknown(s.data?.[q.name])) answeredCount += 1
      const blankPct = (total - answeredCount) / total
      out.push({ section, question: q.title || q.name, blankPct, answered: answeredCount, total })
    }
  }
  return out.sort((a, b) => b.blankPct - a.blankPct).slice(0, topN)
}
