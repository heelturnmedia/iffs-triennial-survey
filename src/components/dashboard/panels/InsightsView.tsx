// ─────────────────────────────────────────────────────────────────────────────
// Insights — cross-country answer prevalence (choropleth + country-vs-global),
// plus a completion funnel and data-quality signals. Reads full SubmissionRow[].
// Charts follow the data-viz method: form first, single-hue magnitude, thin
// marks, direct labels, one reference line for the global benchmark.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react'
import { AnswerChoroplethMap } from '@/components/map/AnswerChoroplethMap'
import { extractQuestionsFromPage, type ExtractedQuestion } from '@/utils/surveyAnalytics'
import {
  choicePrevalenceByCountry,
  completionFunnel,
  medianCompletionMinutes,
  averageCompletionMinutes,
  mostBlankQuestions,
  completedOnly,
  crossTabulate,
  crossTabStats,
  CROSSTAB_TYPES,
  CROSSTAB_MULTI_TYPES,
  wilsonCI,
  answerDistribution,
  regionalPrevalence,
  numericSummaries,
  respondingCountryCount,
  INVITED_COUNTRIES,
} from '@/utils/insightsAnalytics'
import type { SubmissionRow } from '@/types'

// Brand tokens (kept literal so the charts read as one system with the app).
const GREEN = '#1d7733'
const INK = '#0d1117'
const MUTED = '#7a8a96'
const SLATE = '#94a3b8'

interface AnswerOption { value: string; text: string }

// Only choice-style questions can drive an answer-prevalence map.
const CHOICE_TYPES = new Set(['radiogroup', 'dropdown', 'checkbox', 'tagbox', 'boolean'])

function answerOptionsFor(q: ExtractedQuestion): AnswerOption[] {
  if (q.type === 'boolean') return [{ value: 'true', text: 'Yes' }, { value: 'false', text: 'No' }]
  return q.choices ?? []
}

const pct = (v: number) => `${Math.round(v * 100)}%`

// Journal-style formatting: p-values and Wilson CI ranges.
const fmtP = (p: number) => (p < 0.001 ? 'p < 0.001' : `p = ${p.toFixed(3)}`)
const ciText = (count: number, n: number) => {
  const ci = wilsonCI(count, n)
  return `${Math.round(ci.lo * 100)}–${Math.round(ci.hi * 100)}%`
}

// ─── Small building blocks ─────────────────────────────────────────────────────

function StatTile({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl p-4 flex flex-col gap-1"
      style={{ border: '1px solid var(--bd)', boxShadow: 'var(--shadow-sm)' }}>
      <span className="font-display font-bold tabular-nums leading-none" style={{ fontSize: 26, color: INK }}>
        {value}
      </span>
      <span className="font-body font-medium" style={{ fontSize: 11, color: MUTED }}>{label}</span>
      {sub && <span className="font-body" style={{ fontSize: 10, color: '#b0bec5' }}>{sub}</span>}
    </div>
  )
}

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <h3 className="font-display font-bold" style={{ fontSize: 14, color: INK }}>{children}</h3>
      {hint && <p className="font-body mt-0.5" style={{ fontSize: 12, color: MUTED }}>{hint}</p>}
    </div>
  )
}

// ─── Country-vs-global comparison ───────────────────────────────────────────────
// Single-series horizontal bars (magnitude) with one dashed global reference line.
function CountryComparison({
  rows, globalPrevalence, globalCount, globalN, answerLabel, topN = 12,
}: {
  rows: Array<{ iso2: string; name: string; n: number; count: number; prevalence: number }>
  globalPrevalence: number
  globalCount: number
  globalN: number
  answerLabel: string
  topN?: number
}) {
  const shown = rows.slice(0, topN)

  if (shown.length === 0) {
    return <p className="font-body" style={{ fontSize: 12, color: '#b0bec5' }}>No country data yet for this answer.</p>
  }

  return (
    <div>
      {/* Global benchmark callout — journal style: % (n/N · 95% CI) */}
      <div className="flex items-baseline gap-2 mb-3 flex-wrap">
        <span className="font-display font-bold tabular-nums" style={{ fontSize: 22, color: GREEN }}>
          {pct(globalPrevalence)}
        </span>
        <span className="font-body" style={{ fontSize: 12, color: MUTED }}>
          chose “{answerLabel}” globally
        </span>
        {globalN > 0 && (
          <span className="font-body tabular-nums" style={{ fontSize: 11, color: '#b0bec5' }}>
            ({globalCount}/{globalN} · 95% CI {ciText(globalCount, globalN)})
          </span>
        )}
      </div>

      {/* Bars with a global reference line spanning the plot */}
      <div style={{ position: 'relative' }}>
        {/* Global reference line */}
        <div aria-hidden="true" style={{
          position: 'absolute', top: 0, bottom: 18, left: `calc(140px + (100% - 140px) * ${globalPrevalence})`,
          width: 0, borderLeft: `1.5px dashed ${MUTED}`, zIndex: 1, pointerEvents: 'none',
        }} />
        <div className="flex flex-col gap-1.5">
          {shown.map((c) => {
            const lowBase = c.n < 3
            const barW = Math.max(1.5, c.prevalence * 100)
            // High bars would push an outside label off the right edge — place it
            // inside the bar instead (contrast-aware: dark on the light low-base fill).
            const inside = c.prevalence >= 0.78
            const labelColor = inside ? (lowBase ? '#3d4a52' : '#fff') : MUTED
            const countColor = inside ? (lowBase ? '#8595a1' : 'rgba(255,255,255,0.8)') : '#b0bec5'
            return (
              <div key={c.iso2} className="flex items-center gap-2" title={`${c.count} of ${c.n} respondents · 95% CI ${ciText(c.count, c.n)}`}>
                <span className="font-body truncate text-right" style={{ width: 132, fontSize: 12, color: INK, flexShrink: 0 }}>
                  {c.name}
                </span>
                <div style={{ position: 'relative', flex: 1, height: 18 }}>
                  <div style={{
                    position: 'absolute', left: 0, top: 3, height: 12,
                    width: `${barW}%`,
                    background: lowBase ? SLATE : GREEN,
                    borderRadius: 4, opacity: lowBase ? 0.55 : 1,
                  }} />
                  <span className="font-body tabular-nums" style={{
                    position: 'absolute', top: 1, fontSize: 11, whiteSpace: 'nowrap', color: labelColor,
                    ...(inside
                      ? { right: `calc(${100 - barW}% + 6px)` }
                      : { left: `calc(${barW}% + 6px)` }),
                  }}>
                    {pct(c.prevalence)} <span style={{ color: countColor }}>({c.n})</span>
                  </span>
                </div>
              </div>
            )
          })}
        </div>
        {/* Global line legend */}
        <div className="flex items-center gap-1.5 mt-2" style={{ paddingLeft: 140 }}>
          <span aria-hidden="true" style={{ display: 'inline-block', width: 16, height: 0, borderTop: `1.5px dashed ${MUTED}` }} />
          <span className="font-body" style={{ fontSize: 10, color: MUTED }}>Global average ({pct(globalPrevalence)})</span>
        </div>
      </div>
      {shown.some((c) => c.n < 3) && (
        <p className="font-body mt-2" style={{ fontSize: 10, color: '#b0bec5' }}>
          Grey bars have fewer than 3 respondents — interpret with caution.
        </p>
      )}
    </div>
  )
}

// ─── Answer distribution — the "pie replacement" ───────────────────────────────
// One 100%-stacked bar for single-answer questions (the selected answer in green,
// the rest de-emphasised in neutral shades); a per-option bar list for
// multi-select (whose shares don't sum to 100%). The legend carries identity;
// colour only emphasises the current selection.
const NEUTRAL_RAMP = ['#cbd5e1', '#aebecb', '#94a3b8', '#7c8ea0', '#64748b', '#526078']

function AnswerDistributionBar({
  shares, n, multi, selectedValue,
}: {
  shares: Array<{ value: string; text: string; count: number; share: number }>
  n: number
  multi: boolean
  selectedValue: string
}) {
  if (n === 0 || shares.length === 0) return null
  const colorFor = (value: string, i: number) =>
    value === selectedValue ? GREEN : NEUTRAL_RAMP[Math.min(i, NEUTRAL_RAMP.length - 1)]

  return (
    <div className="mb-4">
      <p className="font-body mb-1.5" style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>
        Global answer distribution{' '}
        <span style={{ color: '#b0bec5', fontWeight: 400 }}>({n} respondent{n !== 1 ? 's' : ''})</span>
      </p>
      {multi ? (
        <div className="flex flex-col gap-1">
          {shares.map((s, i) => (
            <div key={s.value} className="flex items-center gap-2" title={`${s.count} of ${n} selected`}>
              <span className="font-body truncate text-right" style={{ width: 180, fontSize: 11, color: INK, flexShrink: 0 }}>
                {s.text}
              </span>
              <div style={{ position: 'relative', flex: 1, height: 12 }}>
                <div style={{ position: 'absolute', inset: 0, background: '#f0f4f1', borderRadius: 3 }} />
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${Math.max(1, s.share * 100)}%`,
                  background: colorFor(s.value, i), borderRadius: 3,
                }} />
              </div>
              <span className="font-body tabular-nums" style={{ width: 76, fontSize: 11, color: MUTED, flexShrink: 0 }}>
                {pct(s.share)} ({s.count})
              </span>
            </div>
          ))}
          <p className="font-body mt-0.5" style={{ fontSize: 9, color: '#b0bec5' }}>
            Multi-select — shares may total more than 100%.
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', height: 14, borderRadius: 4, overflow: 'hidden', gap: 2 }}>
            {shares.filter((s) => s.count > 0).map((s, i) => (
              <div key={s.value} title={`${s.text}: ${pct(s.share)} (${s.count})`}
                style={{ width: `${s.share * 100}%`, background: colorFor(s.value, i), minWidth: 2 }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
            {shares.filter((s) => s.count > 0).map((s, i) => (
              <span key={s.value} className="font-body inline-flex items-center gap-1"
                style={{ fontSize: 10, color: s.value === selectedValue ? INK : MUTED }}>
                <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, background: colorFor(s.value, i), display: 'inline-block' }} />
                {s.text} <span className="tabular-nums" style={{ color: '#b0bec5' }}>{pct(s.share)} ({s.count})</span>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Completion funnel ──────────────────────────────────────────────────────────
function CompletionFunnel({
  steps, total,
}: {
  steps: Array<{ section: string; index: number; reached: number; pct: number }>
  total: number
}) {
  if (total === 0) {
    return <p className="font-body" style={{ fontSize: 12, color: '#b0bec5' }}>No responses with data yet.</p>
  }
  return (
    <div className="flex flex-col gap-1.5">
      {steps.map((s) => (
        <div key={s.index} className="flex items-center gap-2" title={`${s.reached} of ${total} reached ${s.section}`}>
          <span className="font-body truncate text-right" style={{ width: 150, fontSize: 11, color: INK, flexShrink: 0 }}>
            <span style={{ color: MUTED }}>{s.index}.</span> {s.section}
          </span>
          <div style={{ position: 'relative', flex: 1, height: 16 }}>
            <div style={{ position: 'absolute', inset: 0, background: '#f0f4f1', borderRadius: 4 }} />
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${Math.max(1.5, s.pct * 100)}%`, background: GREEN, borderRadius: 4,
            }} />
          </div>
          <span className="font-body tabular-nums" style={{ width: 68, fontSize: 11, color: MUTED, flexShrink: 0 }}>
            {pct(s.pct)} <span style={{ color: '#b0bec5' }}>({s.reached})</span>
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Most-blank questions ───────────────────────────────────────────────────────
function BlankQuestions({
  items,
}: {
  items: Array<{ section: string; question: string; blankPct: number; answered: number; total: number }>
}) {
  if (items.length === 0) {
    return <p className="font-body" style={{ fontSize: 12, color: '#b0bec5' }}>No completed responses yet.</p>
  }
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((q, i) => (
        <div key={i} className="flex items-center gap-2" title={`${q.section} — ${q.answered} of ${q.total} answered`}>
          <span className="font-body truncate" style={{ flex: 1, fontSize: 11, color: INK }}>
            {q.question}
            <span style={{ color: '#b0bec5' }}> · {q.section}</span>
          </span>
          <div style={{ position: 'relative', width: 96, height: 14, flexShrink: 0 }}>
            <div style={{ position: 'absolute', inset: 0, background: '#f0f4f1', borderRadius: 4 }} />
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${Math.max(1.5, q.blankPct * 100)}%`, background: SLATE, borderRadius: 4,
            }} />
          </div>
          <span className="font-body tabular-nums text-right" style={{ width: 40, fontSize: 11, color: MUTED, flexShrink: 0 }}>
            {pct(q.blankPct)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Cross-tabulation ───────────────────────────────────────────────────────────
// Contingency table of two questions. Single-answer questions use their options
// directly; multi-select questions are binarized on one chosen option ("Selected
// X" vs "Not selected"), so every choice-based question in the survey is
// cross-tabulatable. Cells shade sequentially — a heatmap, per the data-viz method.
function CrossTabCard({
  questions, submissions, sectionNames, omittedNote,
}: {
  questions: Array<{ q: ExtractedQuestion; section: string }>
  submissions: SubmissionRow[]
  sectionNames: string[]
  omittedNote: (section: string) => string
}) {
  const eligible = useMemo(
    () => questions.filter((c) => CROSSTAB_TYPES.has(c.q.type) || CROSSTAB_MULTI_TYPES.has(c.q.type)),
    [questions],
  )
  const isMulti = (q: ExtractedQuestion | undefined) => !!q && CROSSTAB_MULTI_TYPES.has(q.type)

  // Sections that contain cross-tabulatable questions, tagged with their true number.
  const sectionOptions = useMemo(() => {
    const seen = new Set<string>()
    const out: Array<{ name: string; number: number }> = []
    eligible.forEach((c) => {
      if (seen.has(c.section)) return
      seen.add(c.section)
      const idx = sectionNames.indexOf(c.section)
      out.push({ name: c.section, number: idx >= 0 ? idx + 1 : out.length + 1 })
    })
    return out
  }, [eligible, sectionNames])

  const [sectionFilter, setSectionFilter] = useState<string>('All')
  const visible = useMemo(
    () => (sectionFilter === 'All' ? eligible : eligible.filter((c) => c.section === sectionFilter)),
    [eligible, sectionFilter],
  )

  const [rowName, setRowName] = useState(() => eligible[0]?.q.name ?? '')
  const [colName, setColName] = useState(() => eligible[1]?.q.name ?? eligible[0]?.q.name ?? '')
  const [rowOption, setRowOption] = useState<string>('')
  const [colOption, setColOption] = useState<string>('')
  const [mode, setMode] = useState<'count' | 'rowpct'>('count')

  const qA = visible.find((c) => c.q.name === rowName)?.q ?? visible[0]?.q
  const qB = visible.find((c) => c.q.name === colName)?.q ?? visible[1]?.q ?? visible[0]?.q

  // For multi-select sides, resolve the binarize option (fall back to the first choice).
  const effRowOption = isMulti(qA)
    ? (qA!.choices?.some((c) => c.value === rowOption) ? rowOption : (qA!.choices?.[0]?.value ?? ''))
    : undefined
  const effColOption = isMulti(qB)
    ? (qB!.choices?.some((c) => c.value === colOption) ? colOption : (qB!.choices?.[0]?.value ?? ''))
    : undefined

  const tab = useMemo(
    () => (qA && qB
      ? crossTabulate(submissions, { q: qA, option: effRowOption }, { q: qB, option: effColOption })
      : null),
    [submissions, qA, qB, effRowOption, effColOption],
  )

  const selectCls =
    'font-body text-[12px] font-medium text-[#3d4a52] border border-[#e2ebe4] rounded-lg px-3 py-1.5 bg-white hover:border-[#1d7733] focus:outline-none focus:border-[#1d7733] transition-colors cursor-pointer'

  const maxCell = tab ? Math.max(1, ...tab.counts.flat()) : 1

  // Sequential white→green cell fill by intensity 0..1.
  const cellFill = (intensity: number) => {
    const t = Math.max(0, Math.min(1, intensity))
    // interpolate #ffffff → #1d7733
    const r = Math.round(255 + (29 - 255) * t)
    const g = Math.round(255 + (119 - 255) * t)
    const b = Math.round(255 + (51 - 255) * t)
    return `rgb(${r},${g},${b})`
  }

  return (
    <div className="bg-white rounded-2xl p-5" style={{ border: '1px solid var(--bd)', boxShadow: 'var(--shadow-sm)' }}>
      <SectionTitle hint="Cross-tabulate any two choice-based questions to answer “of those who said X, how many also said Y?” Multi-select questions compare one chosen option (selected vs not).">
        Cross-tabulation
      </SectionTitle>

      {eligible.length < 2 ? (
        <p className="font-body" style={{ fontSize: 12, color: '#b0bec5' }}>
          Need at least two choice-based questions to cross-tabulate.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="font-body font-medium" style={{ fontSize: 11, color: MUTED }}>Section</span>
              <select className={selectCls} value={sectionFilter}
                onChange={(e) => {
                  const sec = e.target.value
                  setSectionFilter(sec)
                  const list = sec === 'All' ? eligible : eligible.filter((c) => c.section === sec)
                  setRowName(list[0]?.q.name ?? '')
                  setColName(list[1]?.q.name ?? list[0]?.q.name ?? '')
                  setRowOption('')
                  setColOption('')
                }}
                aria-label="Filter cross-tab questions by section" style={{ maxWidth: 240 }}>
                <option value="All">All sections</option>
                {sectionOptions.map((s) => <option key={s.name} value={s.name}>{s.number}. {s.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-body font-medium" style={{ fontSize: 11, color: MUTED }}>Rows</span>
              <select className={selectCls} value={qA?.name ?? ''}
                onChange={(e) => { setRowName(e.target.value); setRowOption('') }}
                aria-label="Cross-tab row question" style={{ maxWidth: 280 }}>
                {visible.map((c) => <option key={c.q.name} value={c.q.name}>{c.q.title || c.q.name}</option>)}
              </select>
            </div>
            {isMulti(qA) && (
              <div className="flex items-center gap-1.5">
                <span className="font-body font-medium" style={{ fontSize: 11, color: MUTED }}>Row option</span>
                <select className={selectCls} value={effRowOption ?? ''}
                  onChange={(e) => setRowOption(e.target.value)}
                  aria-label="Cross-tab row option" style={{ maxWidth: 220 }}>
                  {qA!.choices?.map((o) => <option key={o.value} value={o.value}>{o.text}</option>)}
                </select>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className="font-body font-medium" style={{ fontSize: 11, color: MUTED }}>Columns</span>
              <select className={selectCls} value={qB?.name ?? ''}
                onChange={(e) => { setColName(e.target.value); setColOption('') }}
                aria-label="Cross-tab column question" style={{ maxWidth: 280 }}>
                {visible.map((c) => <option key={c.q.name} value={c.q.name}>{c.q.title || c.q.name}</option>)}
              </select>
            </div>
            {isMulti(qB) && (
              <div className="flex items-center gap-1.5">
                <span className="font-body font-medium" style={{ fontSize: 11, color: MUTED }}>Column option</span>
                <select className={selectCls} value={effColOption ?? ''}
                  onChange={(e) => setColOption(e.target.value)}
                  aria-label="Cross-tab column option" style={{ maxWidth: 220 }}>
                  {qB!.choices?.map((o) => <option key={o.value} value={o.value}>{o.text}</option>)}
                </select>
              </div>
            )}
            <div className="flex items-center gap-1 ml-auto p-0.5 rounded-lg" style={{ background: '#f0f4f1', border: '1px solid var(--bd)' }}>
              {(['count', 'rowpct'] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMode(m)}
                  className="font-body font-semibold px-2.5 py-1 rounded-md transition-all"
                  style={mode === m
                    ? { fontSize: 11, background: '#fff', color: '#0e5921', boxShadow: 'var(--shadow-sm)' }
                    : { fontSize: 11, background: 'transparent', color: '#7a8a96' }}>
                  {m === 'count' ? 'Counts' : 'Row %'}
                </button>
              ))}
            </div>
          </div>

          {/* Coverage note — why some questions aren't listed */}
          <p className="font-body mb-4" style={{ fontSize: 10, color: '#b0bec5' }}>
            {omittedNote(sectionFilter)}
          </p>

          {visible.length < 2 ? (
            <p className="font-body" style={{ fontSize: 12, color: '#b0bec5' }}>
              This section has fewer than two choice-based questions — choose another section or “All sections”.
            </p>
          ) : !tab || tab.total === 0 ? (
            <p className="font-body" style={{ fontSize: 12, color: '#b0bec5' }}>
              No completed responses answered both questions.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="border-collapse" style={{ fontFamily: 'var(--font-body)', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ padding: '6px 10px', textAlign: 'left', color: MUTED, fontWeight: 600, fontSize: 11, borderBottom: '1px solid var(--bd)' }} />
                    {tab.colLabels.map((cl, ci) => (
                      <th key={ci} style={{ padding: '6px 10px', textAlign: 'center', color: INK, fontWeight: 700, fontSize: 11, borderBottom: '1px solid var(--bd)', whiteSpace: 'nowrap' }}>
                        {cl}
                      </th>
                    ))}
                    <th style={{ padding: '6px 10px', textAlign: 'right', color: MUTED, fontWeight: 700, fontSize: 11, borderBottom: '1px solid var(--bd)' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {tab.rowLabels.map((rl, ri) => (
                    <tr key={ri}>
                      <td style={{ padding: '6px 10px', color: INK, fontWeight: 600, whiteSpace: 'nowrap', borderRight: '1px solid var(--bd)' }}>{rl}</td>
                      {tab.counts[ri].map((n, ci) => {
                        const intensity = mode === 'count'
                          ? n / maxCell
                          : (tab.rowTotals[ri] > 0 ? n / tab.rowTotals[ri] : 0)
                        const display = mode === 'count' ? String(n) : (tab.rowTotals[ri] > 0 ? `${Math.round((n / tab.rowTotals[ri]) * 100)}%` : '—')
                        return (
                          <td key={ci} title={`${n} of ${tab.rowTotals[ri]}`}
                            style={{
                              padding: '6px 10px', textAlign: 'center', fontVariantNumeric: 'tabular-nums',
                              background: cellFill(intensity),
                              color: intensity > 0.55 ? '#fff' : INK,
                              fontWeight: 600, border: '2px solid #fff',
                            }}>
                            {display}
                          </td>
                        )
                      })}
                      <td style={{ padding: '6px 10px', textAlign: 'right', color: MUTED, fontWeight: 700 }}>{tab.rowTotals[ri]}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ padding: '6px 10px', color: MUTED, fontWeight: 700, borderTop: '1px solid var(--bd)' }}>Total</td>
                    {tab.colTotals.map((ct, ci) => (
                      <td key={ci} style={{ padding: '6px 10px', textAlign: 'center', color: MUTED, fontWeight: 700, borderTop: '1px solid var(--bd)' }}>{ct}</td>
                    ))}
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: INK, fontWeight: 700, borderTop: '1px solid var(--bd)' }}>{tab.total}</td>
                  </tr>
                </tbody>
              </table>

              {/* Association test — journal style */}
              {(() => {
                const stats = crossTabStats(tab)
                if (!stats) return null
                return (
                  <p className="font-body mt-2.5 tabular-nums" style={{ fontSize: 11, color: MUTED }}>
                    {stats.fisherUsed
                      ? <>Fisher’s exact test: <span style={{ color: INK, fontWeight: 600 }}>{fmtP(stats.p)}</span></>
                      : <>χ²({stats.df}) = {stats.chi2.toFixed(2)}, <span style={{ color: INK, fontWeight: 600 }}>{fmtP(stats.p)}</span></>}
                    {' · '}Cramér’s V = {stats.cramersV.toFixed(2)} · n = {stats.n}
                    {!stats.fisherUsed && stats.lowExpectedPct > 0.2 && (
                      <span style={{ color: '#b45309' }}>
                        {' '}· caution: {Math.round(stats.lowExpectedPct * 100)}% of cells have expected counts &lt; 5 — the χ² approximation is unreliable here
                      </span>
                    )}
                  </p>
                )
              })()}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Main view ──────────────────────────────────────────────────────────────────

export function InsightsView({
  submissions, pages, sectionNames,
}: {
  submissions: SubmissionRow[]
  pages: unknown[]
  sectionNames: string[]
}) {
  // Flatten choice questions (with section context) that can drive the map.
  const choiceQuestions = useMemo(() => {
    const out: Array<{ q: ExtractedQuestion; section: string }> = []
    pages.forEach((p, i) => {
      for (const q of extractQuestionsFromPage(p)) {
        if (q.name && CHOICE_TYPES.has(q.type) && answerOptionsFor(q).length > 0) {
          out.push({ q, section: sectionNames[i] ?? `Section ${i + 1}` })
        }
      }
    })
    return out
  }, [pages, sectionNames])

  // Per-section count of questions that can't be charted (free-text, comments,
  // multi-part text) — surfaced so admins know the selectors aren't missing data.
  const omittedCounts = useMemo(() => {
    const bySection = new Map<string, number>()
    let total = 0
    let chartableTotal = 0
    pages.forEach((p, i) => {
      const sec = sectionNames[i] ?? `Section ${i + 1}`
      const all = extractQuestionsFromPage(p)
      const chartable = all.filter(
        (q) => q.name && CHOICE_TYPES.has(q.type) && answerOptionsFor(q).length > 0
      ).length
      bySection.set(sec, all.length - chartable)
      total += all.length - chartable
      chartableTotal += chartable
    })
    return { bySection, total, chartableTotal }
  }, [pages, sectionNames])

  const omittedNote = useMemo(() => (section: string): string => {
    const omitted = section === 'All'
      ? omittedCounts.total
      : (omittedCounts.bySection.get(section) ?? 0)
    if (omitted === 0) return 'All questions in this selection are choice-based and listed above.'
    return `${omitted} free-text question${omitted !== 1 ? 's' : ''} in this selection ${omitted !== 1 ? 'are' : 'is'} not listed — typed answers have no options to chart as shares.`
  }, [omittedCounts])

  // Sections that actually contain choice questions, in page order, tagged with
  // their true survey section number.
  const sectionOptions = useMemo(() => {
    const seen = new Set<string>()
    const out: Array<{ name: string; number: number }> = []
    choiceQuestions.forEach((c) => {
      if (seen.has(c.section)) return
      seen.add(c.section)
      const idx = sectionNames.indexOf(c.section)
      out.push({ name: c.section, number: idx >= 0 ? idx + 1 : out.length + 1 })
    })
    return out
  }, [choiceQuestions, sectionNames])

  const [sectionFilter, setSectionFilter] = useState<string>('All')
  const visibleQuestions = useMemo(
    () => (sectionFilter === 'All' ? choiceQuestions : choiceQuestions.filter((c) => c.section === sectionFilter)),
    [choiceQuestions, sectionFilter],
  )

  const [qName, setQName] = useState<string>(() => choiceQuestions[0]?.q.name ?? '')
  const [answerValue, setAnswerValue] = useState<string>(() => {
    const first = choiceQuestions[0]
    return first ? (answerOptionsFor(first.q)[0]?.value ?? '') : ''
  })

  const selected = visibleQuestions.find((c) => c.q.name === qName) ?? visibleQuestions[0]
  const options = selected ? answerOptionsFor(selected.q) : []
  const effectiveAnswer = options.some((o) => o.value === answerValue) ? answerValue : (options[0]?.value ?? '')
  const answerLabel = options.find((o) => o.value === effectiveAnswer)?.text ?? effectiveAnswer

  const prevalence = useMemo(
    () => (selected ? choicePrevalenceByCountry(submissions, selected.q, effectiveAnswer) : null),
    [submissions, selected, effectiveAnswer],
  )

  const isoDetail = useMemo(() => {
    const m = new Map<string, { name: string; n: number; count: number }>()
    prevalence?.byCountry.forEach((c) => m.set(c.iso2, { name: c.name, n: c.n, count: c.count }))
    return m
  }, [prevalence])

  const funnel = useMemo(() => completionFunnel(submissions, pages, sectionNames), [submissions, pages, sectionNames])
  const medianMin = useMemo(() => medianCompletionMinutes(submissions), [submissions])
  const averageMin = useMemo(() => averageCompletionMinutes(submissions), [submissions])
  const completedCount = useMemo(() => completedOnly(submissions).length, [submissions])

  // Journal-grade additions
  const [showAllMissing, setShowAllMissing] = useState(false)
  const blanks = useMemo(
    () => mostBlankQuestions(submissions, pages, sectionNames, showAllMissing ? 10_000 : 10),
    [submissions, pages, sectionNames, showAllMissing],
  )
  const respondingCountries = useMemo(() => respondingCountryCount(submissions), [submissions])
  const distribution = useMemo(
    () => (selected ? answerDistribution(submissions, selected.q) : null),
    [submissions, selected],
  )
  const regional = useMemo(
    () => (selected ? regionalPrevalence(submissions, selected.q, effectiveAnswer) : []),
    [submissions, selected, effectiveAnswer],
  )
  const numerics = useMemo(() => numericSummaries(submissions, pages, sectionNames), [submissions, pages, sectionNames])
  const [showAllNumerics, setShowAllNumerics] = useState(false)

  const selectCls =
    'font-body text-[12px] font-medium text-[#3d4a52] border border-[#e2ebe4] rounded-lg px-3 py-1.5 bg-white hover:border-[#1d7733] focus:outline-none focus:border-[#1d7733] transition-colors cursor-pointer'

  const cardCls = 'bg-white rounded-2xl p-5'
  const cardStyle = { border: '1px solid var(--bd)', boxShadow: 'var(--shadow-sm)' } as const

  return (
    <div className="flex flex-col gap-6">
      {/* ── Response-rate banner (sampling frame + snapshot) ─────────────────── */}
      <div className="rounded-xl px-4 py-3 flex flex-wrap items-baseline gap-x-4 gap-y-1"
        style={{ background: '#e8f5ec', border: '1px solid #c8d9cc' }}>
        <span className="font-body tabular-nums" style={{ fontSize: 12, color: '#0e5921', fontWeight: 700 }}>
          {respondingCountries} of {INVITED_COUNTRIES} invited countries responded
          {' '}({Math.round((respondingCountries / INVITED_COUNTRIES) * 100)}%)
        </span>
        <span className="font-body tabular-nums" style={{ fontSize: 11, color: '#3d4a52' }}>
          {completedCount} completed response{completedCount !== 1 ? 's' : ''}
        </span>
        <span className="font-body" style={{ fontSize: 10, color: MUTED }}>
          Unweighted country-level analysis · 95% CIs are Wilson intervals · snapshot {new Date().toISOString().slice(0, 10)}
        </span>
      </div>

      {/* ── Answer prevalence by country ─────────────────────────────────────── */}
      <div className={cardCls} style={cardStyle}>
        <SectionTitle hint="Share of each country’s respondents who chose a given answer, versus the global average.">
          Answer prevalence by country
        </SectionTitle>

        {choiceQuestions.length === 0 ? (
          <p className="font-body" style={{ fontSize: 12, color: '#b0bec5' }}>
            No choice-based questions found in this survey.
          </p>
        ) : (
          <>
            {/* Selectors */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex items-center gap-1.5">
                <span className="font-body font-medium" style={{ fontSize: 11, color: MUTED }}>Section</span>
                <select
                  className={selectCls}
                  value={sectionFilter}
                  onChange={(e) => {
                    const sec = e.target.value
                    setSectionFilter(sec)
                    const list = sec === 'All' ? choiceQuestions : choiceQuestions.filter((c) => c.section === sec)
                    const next = list[0]
                    setQName(next?.q.name ?? '')
                    setAnswerValue(next ? (answerOptionsFor(next.q)[0]?.value ?? '') : '')
                  }}
                  aria-label="Filter questions by section"
                  style={{ maxWidth: 260 }}
                >
                  <option value="All">All sections</option>
                  {sectionOptions.map((s) => (
                    <option key={s.name} value={s.name}>{s.number}. {s.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-body font-medium" style={{ fontSize: 11, color: MUTED }}>Question</span>
                <select
                  className={selectCls}
                  value={selected?.q.name ?? ''}
                  onChange={(e) => {
                    const next = visibleQuestions.find((c) => c.q.name === e.target.value)
                    setQName(e.target.value)
                    setAnswerValue(next ? (answerOptionsFor(next.q)[0]?.value ?? '') : '')
                  }}
                  aria-label="Select question"
                  style={{ maxWidth: 460 }}
                >
                  {visibleQuestions.map((c) => (
                    <option key={c.q.name} value={c.q.name}>
                      {c.q.title || c.q.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-body font-medium" style={{ fontSize: 11, color: MUTED }}>Answer</span>
                <select
                  className={selectCls}
                  value={effectiveAnswer}
                  onChange={(e) => setAnswerValue(e.target.value)}
                  aria-label="Select answer"
                  style={{ maxWidth: 320 }}
                >
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>{o.text}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Coverage note — why some questions aren't listed */}
            <p className="font-body -mt-2 mb-4" style={{ fontSize: 10, color: '#b0bec5' }}>
              {visibleQuestions.length} choice-based question{visibleQuestions.length !== 1 ? 's' : ''} listed. {omittedNote(sectionFilter)}
            </p>

            {/* Global answer distribution — pie replacement */}
            {distribution && (
              <AnswerDistributionBar
                shares={distribution.shares}
                n={distribution.n}
                multi={distribution.multi}
                selectedValue={effectiveAnswer}
              />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <AnswerChoroplethMap
                isoValue={prevalence?.isoValue ?? new Map()}
                isoDetail={isoDetail}
                answerLabel={answerLabel}
                height={380}
              />
              <div>
                <CountryComparison
                  rows={prevalence?.byCountry ?? []}
                  globalPrevalence={prevalence?.globalPrevalence ?? 0}
                  globalCount={prevalence?.globalCount ?? 0}
                  globalN={prevalence?.globalN ?? 0}
                  answerLabel={answerLabel}
                />
              </div>
            </div>

            {/* Regional stratification — journal table: region | n | % (95% CI) */}
            {regional.length > 0 && (
              <div className="mt-5">
                <p className="font-body mb-1.5" style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>
                  Regional breakdown — % choosing “{answerLabel}”
                </p>
                <div style={{ overflowX: 'auto' }}>
                  <table className="border-collapse" style={{ fontFamily: 'var(--font-body)', fontSize: 12 }}>
                    <thead>
                      <tr>
                        {['Region', 'n', '% (95% CI)'].map((h) => (
                          <th key={h} style={{ padding: '5px 14px 5px 0', textAlign: h === 'Region' ? 'left' : 'right', color: MUTED, fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--bd)' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {regional.map((r) => (
                        <tr key={r.region}>
                          <td style={{ padding: '5px 14px 5px 0', color: INK, fontWeight: 600 }}>{r.region}</td>
                          <td className="tabular-nums" style={{ padding: '5px 14px 5px 0', textAlign: 'right', color: MUTED }}>{r.n}</td>
                          <td className="tabular-nums" style={{ padding: '5px 0', textAlign: 'right', color: INK }}>
                            {pct(r.prevalence)} <span style={{ color: '#b0bec5' }}>({r.count}/{r.n} · {Math.round(r.ci.lo * 100)}–{Math.round(r.ci.hi * 100)}%)</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Completion & quality ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatTile value={String(funnel.totalWithData)} label="Responses started" />
        <StatTile value={String(completedCount)} label="Completed" />
        <StatTile
          value={medianMin === null ? '—' : `${Math.round(medianMin)}m`}
          label="Median time to complete"
          sub={medianMin === null ? 'Needs submitted responses' : undefined}
        />
        <StatTile
          value={averageMin === null ? '—' : `${Math.round(averageMin)}m`}
          label="Average time to complete"
          sub={averageMin === null ? 'Needs submitted responses' : undefined}
        />
        <StatTile
          value={funnel.totalWithData > 0 ? pct(completedCount / funnel.totalWithData) : '—'}
          label="Completion rate"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={cardCls} style={cardStyle}>
          <SectionTitle hint="Share of started responses that reached each section.">
            Completion funnel
          </SectionTitle>
          <CompletionFunnel steps={funnel.steps} total={funnel.totalWithData} />
        </div>

        <div className={cardCls} style={cardStyle}>
          <SectionTitle hint="Questions most often left blank or “unknown” among completed responses.">
            Most-skipped questions
          </SectionTitle>
          <div style={showAllMissing ? { maxHeight: 420, overflowY: 'auto', paddingRight: 4 } : undefined}>
            <BlankQuestions items={blanks} />
          </div>
          <button type="button" onClick={() => setShowAllMissing((v) => !v)}
            className="font-display mt-3 text-[10px] font-bold tracking-[0.10em] uppercase px-3 py-1.5 rounded-lg border-[1.5px] text-[#1d7733] border-[#afc7b4] hover:bg-[#e8f5ec] transition-all">
            {showAllMissing ? 'Show top 10 only' : 'Show full missingness appendix'}
          </button>
        </div>
      </div>

      {/* ── Numeric summaries — median (IQR) for numeric questions ───────────── */}
      <div className={cardCls} style={cardStyle}>
        <SectionTitle hint="Median (IQR) and range for numeric questions with at least 3 parseable values, over completed responses.">
          Numeric summaries
        </SectionTitle>
        {numerics.length === 0 ? (
          <p className="font-body" style={{ fontSize: 12, color: '#b0bec5' }}>
            No numeric questions have enough values yet (minimum 3).
          </p>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="w-full border-collapse" style={{ fontFamily: 'var(--font-body)', fontSize: 12, minWidth: 640 }}>
                <thead>
                  <tr>
                    {['Question', 'Section', 'n', 'Median (IQR)', 'Range'].map((h, i) => (
                      <th key={h} style={{ padding: '5px 14px 5px 0', textAlign: i >= 2 ? 'right' : 'left', color: MUTED, fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--bd)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(showAllNumerics ? numerics : numerics.slice(0, 10)).map((s, i) => (
                    <tr key={i}>
                      <td style={{ padding: '5px 14px 5px 0', color: INK, maxWidth: 380 }}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.question}</span>
                      </td>
                      <td style={{ padding: '5px 14px 5px 0', color: MUTED, whiteSpace: 'nowrap' }}>{s.section}</td>
                      <td className="tabular-nums" style={{ padding: '5px 14px 5px 0', textAlign: 'right', color: MUTED }}>{s.n}</td>
                      <td className="tabular-nums" style={{ padding: '5px 14px 5px 0', textAlign: 'right', color: INK }}>
                        {s.median.toLocaleString()} <span style={{ color: '#b0bec5' }}>({s.q1.toLocaleString()}–{s.q3.toLocaleString()})</span>
                      </td>
                      <td className="tabular-nums" style={{ padding: '5px 0', textAlign: 'right', color: MUTED }}>
                        {s.min.toLocaleString()}–{s.max.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {numerics.length > 10 && (
              <button type="button" onClick={() => setShowAllNumerics((v) => !v)}
                className="font-display mt-3 text-[10px] font-bold tracking-[0.10em] uppercase px-3 py-1.5 rounded-lg border-[1.5px] text-[#1d7733] border-[#afc7b4] hover:bg-[#e8f5ec] transition-all">
                {showAllNumerics ? 'Show top 10 only' : `Show all ${numerics.length}`}
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Cross-tabulation ─────────────────────────────────────────────────── */}
      <CrossTabCard
        questions={choiceQuestions}
        submissions={submissions}
        sectionNames={sectionNames}
        omittedNote={omittedNote}
      />
    </div>
  )
}
