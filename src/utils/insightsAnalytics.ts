// ─────────────────────────────────────────────────────────────────────────────
// Insights analytics — cross-country prevalence, completion funnel, quality.
// Operates on full SubmissionRow[] (with `data`), unlike the status-only map.
// ─────────────────────────────────────────────────────────────────────────────
import { resolveCountryToIso2, iso2ToCountryName, getRegion, type Region } from '@/utils/countryRegions'
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

// Completion durations (minutes) from first save (created_at) to submitted_at,
// over submitted rows. Non-negative only.
function completionMinutes(submissions: SubmissionRow[]): number[] {
  return completedOnly(submissions)
    .map((s) =>
      s.submitted_at && s.created_at
        ? (new Date(s.submitted_at).getTime() - new Date(s.created_at).getTime()) / 60000
        : null
    )
    .filter((m): m is number => m !== null && m >= 0)
}

// Median minutes to complete.
export function medianCompletionMinutes(submissions: SubmissionRow[]): number | null {
  const mins = completionMinutes(submissions).sort((a, b) => a - b)
  if (mins.length === 0) return null
  const mid = Math.floor(mins.length / 2)
  return mins.length % 2 ? mins[mid] : (mins[mid - 1] + mins[mid]) / 2
}

// Mean minutes to complete.
export function averageCompletionMinutes(submissions: SubmissionRow[]): number | null {
  const mins = completionMinutes(submissions)
  if (mins.length === 0) return null
  return mins.reduce((s, m) => s + m, 0) / mins.length
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
// Contingency table of two questions over completed responses. Single-answer
// questions use their options directly. Multi-select questions (checkbox/tagbox)
// are binarized on one chosen option — "Selected X" vs "Did not select X" — so
// each respondent still lands in exactly one cell (a proper contingency).

export const CROSSTAB_TYPES = new Set(['radiogroup', 'dropdown', 'boolean'])
export const CROSSTAB_MULTI_TYPES = new Set(['checkbox', 'tagbox'])

export interface CrossTabSide {
  q: ExtractedQuestion
  // Required for multi-select questions: the option value to binarize on.
  option?: string
}

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

// The comparable cell value for one side of the cross-tab ('' = not counted).
function sideValue(side: CrossTabSide, data: Record<string, unknown> | undefined): string {
  const raw = data?.[side.q.name]
  if (side.option !== undefined) {
    // Binarized multi-select: only respondents who answered the question count.
    if (raw === undefined || raw === null || raw === '') return ''
    if (!Array.isArray(raw)) return ''
    return (raw as unknown[]).map(String).includes(side.option) ? 'selected' : 'not_selected'
  }
  return singleAnswerValue(side.q, raw)
}

function sideLabel(side: CrossTabSide, value: string): string {
  if (side.option !== undefined) {
    const optText = side.q.choices?.find((c) => c.value === side.option)?.text ?? side.option
    return value === 'selected' ? `Selected “${optText}”` : 'Not selected'
  }
  return labelFor(side.q, value)
}

function sideOrder(side: CrossTabSide, seen: Set<string>): string[] {
  if (side.option !== undefined) return ['selected', 'not_selected'].filter((v) => seen.has(v))
  return orderValues(side.q, seen)
}

export function crossTabulate(
  submissions: SubmissionRow[],
  sideA: CrossTabSide,
  sideB: CrossTabSide,
): CrossTab {
  const done = completedOnly(submissions)
  const cells = new Map<string, Map<string, number>>()
  const rowSeen = new Set<string>()
  const colSeen = new Set<string>()
  let total = 0

  for (const row of done) {
    const a = sideValue(sideA, row.data)
    const b = sideValue(sideB, row.data)
    if (!a || !b) continue
    rowSeen.add(a)
    colSeen.add(b)
    if (!cells.has(a)) cells.set(a, new Map())
    const rmap = cells.get(a)!
    rmap.set(b, (rmap.get(b) ?? 0) + 1)
    total += 1
  }

  const rowValues = sideOrder(sideA, rowSeen)
  const colValues = sideOrder(sideB, colSeen)
  const counts = rowValues.map((rv) => colValues.map((cv) => cells.get(rv)?.get(cv) ?? 0))
  const rowTotals = counts.map((r) => r.reduce((s, x) => s + x, 0))
  const colTotals = colValues.map((_, ci) => counts.reduce((s, r) => s + r[ci], 0))

  return {
    rowLabels: rowValues.map((v) => sideLabel(sideA, v)),
    colLabels: colValues.map((v) => sideLabel(sideB, v)),
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

// ─── Journal-grade statistics ───────────────────────────────────────────────────
// Denominator reporting, Wilson intervals, association tests, regional
// stratification, and numeric summaries — the additions a surveillance-report
// reviewer expects. All computed over completed responses.

// Sampling frame: countries invited to participate in the 2026 wave.
export const INVITED_COUNTRIES = 147

export interface WilsonCI { lo: number; hi: number }

// Wilson score interval (95% default). Well-behaved at small n; stays in [0,1].
export function wilsonCI(count: number, n: number, z = 1.96): WilsonCI {
  if (n <= 0) return { lo: 0, hi: 0 }
  const p = count / n
  const z2 = z * z
  const denom = 1 + z2 / n
  const centre = (p + z2 / (2 * n)) / denom
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom
  return { lo: Math.max(0, centre - half), hi: Math.min(1, centre + half) }
}

// Distinct countries among completed responses (the unit of analysis).
export function respondingCountryCount(submissions: SubmissionRow[]): number {
  const set = new Set<string>()
  for (const r of completedOnly(submissions)) {
    const iso = iso2Of(r)
    if (iso) set.add(iso)
  }
  return set.size
}

// ── Chi-square / Fisher machinery ──────────────────────────────────────────────

// Lanczos approximation of ln Γ(x); |error| < 2e-10 for x > 0.
function lnGamma(x: number): number {
  const c = [
    76.18009172947146, -86.50532032941678, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ]
  let y = x
  let tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (let j = 0; j < 6; j++) ser += c[j] / ++y
  return -tmp + Math.log((2.5066282746310007 * ser) / x)
}

// Regularized incomplete gamma: P(a,x) by series (x < a+1), Q(a,x) by
// continued fraction (x ≥ a+1) — the standard Numerical Recipes split.
function gammaPSeries(a: number, x: number): number {
  let ap = a
  let sum = 1 / a
  let del = sum
  for (let i = 0; i < 300; i++) {
    ap += 1
    del *= x / ap
    sum += del
    if (Math.abs(del) < Math.abs(sum) * 1e-12) break
  }
  return sum * Math.exp(-x + a * Math.log(x) - lnGamma(a))
}

function gammaQContinued(a: number, x: number): number {
  let b = x + 1 - a
  let c = 1e30
  let d = 1 / b
  let h = d
  for (let i = 1; i < 300; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < 1e-30) d = 1e-30
    c = b + an / c
    if (Math.abs(c) < 1e-30) c = 1e-30
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 1e-12) break
  }
  return Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h
}

// Upper-tail chi-square p-value: P(X² ≥ x) with k degrees of freedom.
function chiSquareUpperTail(x: number, k: number): number {
  if (x <= 0 || k <= 0) return 1
  const a = k / 2
  const xx = x / 2
  return xx < a + 1 ? 1 - gammaPSeries(a, xx) : gammaQContinued(a, xx)
}

function lnChoose(n: number, k: number): number {
  return lnGamma(n + 1) - lnGamma(k + 1) - lnGamma(n - k + 1)
}

// Two-sided Fisher's exact test for a 2×2 table: sum of all tables (with the
// same margins) whose probability ≤ that of the observed table.
function fisherExact2x2(a: number, b: number, c: number, d: number): number {
  const r1 = a + b
  const r2 = c + d
  const c1 = a + c
  const n = r1 + r2
  if (n === 0) return 1
  const lnP = (x: number) => lnChoose(r1, x) + lnChoose(r2, c1 - x) - lnChoose(n, c1)
  const pObs = lnP(a)
  let total = 0
  const lo = Math.max(0, c1 - r2)
  const hi = Math.min(r1, c1)
  for (let x = lo; x <= hi; x++) {
    const p = lnP(x)
    if (p <= pObs + 1e-9) total += Math.exp(p)
  }
  return Math.min(1, total)
}

export interface CrossTabStats {
  n: number
  chi2: number
  df: number
  p: number              // Fisher's exact p when fisherUsed, else chi-square p
  cramersV: number
  lowExpectedPct: number // share of cells with expected count < 5
  fisherUsed: boolean
}

// Association test for a contingency table. Uses Fisher's exact for sparse 2×2
// tables; chi-square otherwise (with a low-expected-count caution share).
export function crossTabStats(tab: CrossTab): CrossTabStats | null {
  const r = tab.counts.length
  const c = tab.counts[0]?.length ?? 0
  const n = tab.total
  if (r < 2 || c < 2 || n === 0) return null
  let chi2 = 0
  let lowExpected = 0
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {
      const expected = (tab.rowTotals[i] * tab.colTotals[j]) / n
      if (expected < 5) lowExpected += 1
      if (expected > 0) chi2 += ((tab.counts[i][j] - expected) ** 2) / expected
    }
  }
  const df = (r - 1) * (c - 1)
  const cramersV = Math.sqrt(chi2 / (n * Math.min(r - 1, c - 1)))
  const fisherUsed = r === 2 && c === 2 && lowExpected > 0
  const p = fisherUsed
    ? fisherExact2x2(tab.counts[0][0], tab.counts[0][1], tab.counts[1][0], tab.counts[1][1])
    : chiSquareUpperTail(chi2, df)
  return { n, chi2, df, p, cramersV, lowExpectedPct: lowExpected / (r * c), fisherUsed }
}

// ── Answer distribution ────────────────────────────────────────────────────────

export interface AnswerShare { value: string; text: string; count: number; share: number }

// Global distribution of answers to a choice question over completed responses.
// For multi-select questions each option's share is the share of respondents who
// selected it (shares may total more than 100%).
export function answerDistribution(
  submissions: SubmissionRow[],
  q: ExtractedQuestion,
): { shares: AnswerShare[]; n: number; multi: boolean } {
  const done = completedOnly(submissions)
  const counts = new Map<string, number>()
  let n = 0
  const multi = CROSSTAB_MULTI_TYPES.has(q.type)
  for (const row of done) {
    const raw = row.data?.[q.name]
    if (raw === undefined || raw === null || raw === '') continue
    n += 1
    if (Array.isArray(raw)) {
      for (const v of raw as unknown[]) counts.set(String(v), (counts.get(String(v)) ?? 0) + 1)
    } else {
      const key = q.type === 'boolean' ? (raw === true || raw === 'true' ? 'true' : 'false') : String(raw)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  const opts =
    q.type === 'boolean'
      ? [{ value: 'true', text: 'Yes' }, { value: 'false', text: 'No' }]
      : (q.choices ?? [])
  const seen = new Set(counts.keys())
  const ordered = [
    ...opts.filter((o) => seen.has(o.value)),
    ...[...seen]
      .filter((v) => !opts.some((o) => o.value === v))
      .sort()
      .map((v) => ({ value: v, text: v })),
  ]
  return {
    n,
    multi,
    shares: ordered.map((o) => ({
      value: o.value,
      text: o.text,
      count: counts.get(o.value) ?? 0,
      share: n > 0 ? (counts.get(o.value) ?? 0) / n : 0,
    })),
  }
}

// ── Regional stratification ────────────────────────────────────────────────────

export interface RegionalPrevalence {
  region: Region
  n: number
  count: number
  prevalence: number
  ci: WilsonCI
}

// Share choosing `answerValue` per region, with Wilson CIs.
export function regionalPrevalence(
  submissions: SubmissionRow[],
  q: ExtractedQuestion,
  answerValue: string,
): RegionalPrevalence[] {
  const done = completedOnly(submissions)
  const per = new Map<Region, { n: number; count: number }>()
  for (const row of done) {
    const value = row.data?.[q.name]
    if (value === undefined || value === null || value === '') continue
    const iso = iso2Of(row)
    if (!iso) continue
    const region = getRegion(iso)
    const rec = per.get(region) ?? { n: 0, count: 0 }
    rec.n += 1
    if (answered(q, value, answerValue)) rec.count += 1
    per.set(region, rec)
  }
  const ORDER: Region[] = ['Africa', 'Americas', 'Asia', 'Europe', 'Oceania', 'Unknown']
  return ORDER.filter((r) => per.has(r)).map((region) => {
    const { n, count } = per.get(region)!
    return { region, n, count, prevalence: n > 0 ? count / n : 0, ci: wilsonCI(count, n) }
  })
}

// ── Numeric summaries ──────────────────────────────────────────────────────────

export interface NumericSummary {
  section: string
  question: string
  n: number
  median: number
  q1: number
  q3: number
  min: number
  max: number
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

// Median (IQR) and range for numeric free-text questions with at least minN
// parseable values — the survey's numeric data is otherwise invisible.
export function numericSummaries(
  submissions: SubmissionRow[],
  pages: unknown[],
  sectionNames: string[],
  minN = 3,
): NumericSummary[] {
  const done = completedOnly(submissions)
  const out: NumericSummary[] = []
  pages.forEach((p, i) => {
    const section = sectionNames[i] ?? `Section ${i + 1}`
    for (const q of extractQuestionsFromPage(p)) {
      if (NON_NUMERIC_TYPES.has(q.type)) continue
      const vals: number[] = []
      for (const s of done) {
        const v = parseNumeric(s.data?.[q.name])
        if (v !== null) vals.push(v)
      }
      if (vals.length < minN) continue
      vals.sort((a, b) => a - b)
      out.push({
        section,
        question: q.title || q.name,
        n: vals.length,
        median: quantile(vals, 0.5),
        q1: quantile(vals, 0.25),
        q3: quantile(vals, 0.75),
        min: vals[0],
        max: vals[vals.length - 1],
      })
    }
  })
  return out.sort((a, b) => b.n - a.n)
}
