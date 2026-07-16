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

// ─── Cross-tabulation ───────────────────────────────────────────────────────────
// Contingency table of one single-answer question against another, over completed
// responses. Multi-select questions are excluded so each respondent lands in exactly
// one cell (a proper contingency).

export const CROSSTAB_TYPES = new Set(['radiogroup', 'dropdown', 'boolean'])

// The single answer value a respondent gave, as a comparable string ('' = none).
function singleAnswerValue(q: ExtractedQuestion, value: unknown): string {
  if (value === undefined || value === null || value === '' || Array.isArray(value)) return ''
  if (q.type === 'boolean') return value === true || value === 'true' ? 'true' : 'false'
  return String(value)
}

function labelFor(q: ExtractedQuestion, value: string): string {
  if (q.type === 'boolean') return value === 'true' ? 'Yes' : 'No'
  return q.choices?.find((c) => c.value === value)?.text ?? value
}

// Order the observed values by the question's declared option order, appending any
// unexpected values (free-text codes etc.) at the end.
function orderValues(q: ExtractedQuestion, seen: Set<string>): string[] {
  const opts =
    q.type === 'boolean'
      ? ['true', 'false']
      : (q.choices ?? []).map((c) => c.value)
  const ordered = opts.filter((v) => seen.has(v))
  const extras = [...seen].filter((v) => !opts.includes(v)).sort()
  return [...ordered, ...extras]
}

export interface CrossTab {
  rowLabels: string[]
  colLabels: string[]
  counts: number[][]   // [row][col]
  rowTotals: number[]
  colTotals: number[]
  total: number
}

export function crossTabulate(
  submissions: SubmissionRow[],
  qA: ExtractedQuestion,
  qB: ExtractedQuestion,
): CrossTab {
  const done = completedOnly(submissions)
  const cells = new Map<string, Map<string, number>>()
  const rowSeen = new Set<string>()
  const colSeen = new Set<string>()
  let total = 0

  for (const row of done) {
    const a = singleAnswerValue(qA, row.data?.[qA.name])
    const b = singleAnswerValue(qB, row.data?.[qB.name])
    if (!a || !b) continue
    rowSeen.add(a)
    colSeen.add(b)
    if (!cells.has(a)) cells.set(a, new Map())
    const rmap = cells.get(a)!
    rmap.set(b, (rmap.get(b) ?? 0) + 1)
    total += 1
  }

  const rowValues = orderValues(qA, rowSeen)
  const colValues = orderValues(qB, colSeen)
  const counts = rowValues.map((rv) => colValues.map((cv) => cells.get(rv)?.get(cv) ?? 0))
  const rowTotals = counts.map((r) => r.reduce((s, x) => s + x, 0))
  const colTotals = colValues.map((_, ci) => counts.reduce((s, r) => s + r[ci], 0))

  return {
    rowLabels: rowValues.map((v) => labelFor(qA, v)),
    colLabels: colValues.map((v) => labelFor(qB, v)),
    counts,
    rowTotals,
    colTotals,
    total,
  }
}

// ─── Data-quality flags ─────────────────────────────────────────────────────────

export interface QualityFlag {
  kind: 'duplicate_country' | 'numeric_outlier' | 'rushed'
  severity: 'warn' | 'info'
  title: string
  detail: string
  refs: string[]
}

// Skip question types that can't hold a single scalar number.
const NON_NUMERIC_TYPES = new Set([
  'radiogroup', 'dropdown', 'boolean', 'checkbox', 'tagbox',
  'matrix', 'matrixdropdown', 'multipletext', 'file', 'paneldynamic', 'comment',
])

function parseNumeric(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v !== 'string') return null
  const s = v.trim().replace(/,/g, '')
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function medianOf(nums: number[]): number {
  if (nums.length === 0) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

// Admin-facing data-quality signals over completed responses: multiple responses
// per country, numeric outliers (robust median/MAD), and suspiciously fast finishes.
export function dataQualityFlags(
  submissions: SubmissionRow[],
  pages: unknown[],
): QualityFlag[] {
  const done = completedOnly(submissions)
  const flags: QualityFlag[] = []

  // 1) More than one completed response for the same country.
  const byCountry = new Map<string, SubmissionRow[]>()
  for (const r of done) {
    const iso = iso2Of(r)
    if (!iso) continue
    const list = byCountry.get(iso) ?? []
    list.push(r)
    byCountry.set(iso, list)
  }
  byCountry.forEach((rows, iso) => {
    if (rows.length > 1) {
      flags.push({
        kind: 'duplicate_country',
        severity: 'warn',
        title: `${iso2ToCountryName(iso)} — ${rows.length} completed responses`,
        detail: 'More than one completed response for this country. Confirm these are distinct institutions rather than duplicate submissions.',
        refs: rows.map((r) => r.reference_no || r.email || '').filter(Boolean),
      })
    }
  })

  // 2) Numeric outliers per question (median ± MAD; robust to skew).
  const questions = pages.flatMap((p) => extractQuestionsFromPage(p))
  for (const q of questions) {
    if (NON_NUMERIC_TYPES.has(q.type)) continue
    const vals: Array<{ iso: string; ref: string; n: number }> = []
    for (const r of done) {
      const n = parseNumeric(r.data?.[q.name])
      if (n === null) continue
      vals.push({ iso: iso2Of(r), ref: r.reference_no || r.email || '', n })
    }
    if (vals.length < 4) continue // need a distribution to judge
    const nums = vals.map((v) => v.n)
    const med = medianOf(nums)
    const mad = medianOf(nums.map((n) => Math.abs(n - med)))
    for (const v of vals) {
      const isOutlier = mad > 0 ? Math.abs(v.n - med) / mad > 6 : med > 0 && v.n > med * 10
      if (isOutlier && v.n > 0) {
        flags.push({
          kind: 'numeric_outlier',
          severity: 'info',
          title: `${iso2ToCountryName(v.iso) || 'A response'} — unusual value for “${q.title || q.name}”`,
          detail: `Reported ${v.n.toLocaleString()} against a median of ${med.toLocaleString()} across ${vals.length} responses.`,
          refs: v.ref ? [v.ref] : [],
        })
      }
    }
  }

  // 3) Suspiciously fast completions (< 3 minutes end-to-end).
  for (const r of done) {
    if (!r.submitted_at || !r.created_at) continue
    const mins = (new Date(r.submitted_at).getTime() - new Date(r.created_at).getTime()) / 60000
    if (mins >= 0 && mins < 3) {
      flags.push({
        kind: 'rushed',
        severity: 'info',
        title: `${iso2ToCountryName(iso2Of(r)) || 'A response'} — completed in ${mins.toFixed(1)} min`,
        detail: 'Unusually fast completion; responses may be low-effort. Worth a spot-check.',
        refs: r.reference_no ? [r.reference_no] : [],
      })
    }
  }

  return flags
}
