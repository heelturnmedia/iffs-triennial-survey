// ─────────────────────────────────────────────────────────────────────────────
// Countries Data — Reports tab. Two sections:
//  1. A table of every country in the world with submitted / in-progress / total
//     counts, downloadable as PDF or XLS.
//  2. A country-wise answer map: pick a question + answer, the Mapbox globe shades
//     each country by the share who chose it, downloadable as PDF (with a snapshot).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from 'react'
import { extractQuestionsFromPage, type ExtractedQuestion } from '@/utils/surveyAnalytics'
import { choicePrevalenceByCountry } from '@/utils/insightsAnalytics'
import { buildCountrySubmissionRows, countryTotals, buildNotStartedUsers } from '@/utils/countriesData'
import { AnswerChoroplethMap } from '@/components/map/AnswerChoroplethMap'
import { listProfiles } from '@/services/authService'
import { logActivity } from '@/services/auditService'
import { useUIStore } from '@/stores/uiStore'
import type { SubmissionRow, Profile } from '@/types'

const fmtDate = (iso: string) => {
  try { return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) }
  catch { return '—' }
}

const MUTED = '#7a8a96'
const INK = '#0d1117'
const selectCls =
  'font-body text-[12px] font-medium text-f2 border border-bd rounded-lg px-3 py-1.5 bg-white hover:border-g1 focus:outline-hidden focus:border-g1 transition-colors cursor-pointer'
const btnCls =
  'inline-flex items-center gap-2 font-display text-[11px] font-bold tracking-[0.12em] uppercase px-4 py-2 rounded-full border-[1.5px] border-g1 text-g1 bg-white hover:bg-g3 transition-all disabled:opacity-40 disabled:cursor-not-allowed'

interface AnswerOption { value: string; text: string }
const CHOICE_TYPES = new Set(['radiogroup', 'dropdown', 'checkbox', 'tagbox', 'boolean'])
function answerOptionsFor(q: ExtractedQuestion): AnswerOption[] {
  if (q.type === 'boolean') return [{ value: 'true', text: 'Yes' }, { value: 'false', text: 'No' }]
  return q.choices ?? []
}

export function CountriesDataView({
  submissions,
  pages,
  sectionNames,
}: {
  submissions: SubmissionRow[]
  pages: unknown[]
  sectionNames: string[]
}) {
  const { toast } = useUIStore()

  // All signed-up users (profiles) — needed to count people who signed up but
  // never started: they have no submission row, so `submissions` alone misses them.
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [profilesLoaded, setProfilesLoaded] = useState(false)
  useEffect(() => {
    let alive = true
    listProfiles()
      .then((p) => { if (alive) { setProfiles(p); setProfilesLoaded(true) } })
      .catch(() => { if (alive) setProfilesLoaded(true) })
    return () => { alive = false }
  }, [])

  // ── Section 1: per-country counts ──────────────────────────────────────────
  const tableRows = useMemo(() => buildCountrySubmissionRows(submissions, profiles), [submissions, profiles])
  const totals = useMemo(() => countryTotals(tableRows), [tableRows])
  const notStartedUsers = useMemo(() => buildNotStartedUsers(submissions, profiles), [submissions, profiles])
  const [tableBusy, setTableBusy] = useState(false)

  const handleTableExport = async (kind: 'pdf' | 'xls') => {
    setTableBusy(true)
    try {
      const mod = await import('@/utils/exportCountriesData')
      if (kind === 'pdf') mod.exportCountriesTablePdf(tableRows, notStartedUsers)
      else mod.exportCountriesTableXls(tableRows, notStartedUsers)
      void logActivity('export_all_responses', { format: `countries_${kind}`, count: totals.total })
    } catch {
      toast('Failed to generate the country report.', 'err')
    } finally {
      setTableBusy(false)
    }
  }

  // ── Section 2: answers by country ──────────────────────────────────────────
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

  const [sectionFilter, setSectionFilter] = useState('All')
  const visibleQuestions = useMemo(
    () => (sectionFilter === 'All' ? choiceQuestions : choiceQuestions.filter((c) => c.section === sectionFilter)),
    [choiceQuestions, sectionFilter],
  )

  const [qName, setQName] = useState(() => choiceQuestions[0]?.q.name ?? '')
  const [answerValue, setAnswerValue] = useState(() => {
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

  const mapWrapRef = useRef<HTMLDivElement>(null)
  const [answerBusy, setAnswerBusy] = useState(false)

  const captureMap = (): { dataUrl: string; width: number; height: number } | undefined => {
    const canvas = mapWrapRef.current?.querySelector('canvas.mapboxgl-canvas') as HTMLCanvasElement | null
    if (!canvas) return undefined
    try {
      return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height }
    } catch {
      return undefined
    }
  }

  const handleAnswerExport = async () => {
    if (!selected || !prevalence) return
    setAnswerBusy(true)
    try {
      const { exportCountryAnswerPdf } = await import('@/utils/exportCountriesData')
      exportCountryAnswerPdf({
        questionTitle: selected.q.title || selected.q.name,
        sectionName: selected.section,
        answerLabel,
        global: { n: prevalence.globalN, count: prevalence.globalCount, prevalence: prevalence.globalPrevalence },
        byCountry: prevalence.byCountry,
        mapImage: captureMap(),
      })
      void logActivity('export_all_responses', { format: 'country_answers_pdf', question: selected.q.name })
    } catch {
      toast('Failed to generate the answer report.', 'err')
    } finally {
      setAnswerBusy(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* ── Section 1: country submissions table ─────────────────────────── */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="font-display text-lg font-semibold" style={{ color: INK }}>Submissions by Country</h2>
            <p className="font-body" style={{ fontSize: 12, color: MUTED }}>
              {totals.countriesActive} countries with activity · {totals.submitted} submitted · {totals.inProgress} in progress · {totals.notStarted} not started · {totals.total} signed-up users
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className={btnCls} disabled={tableBusy} onClick={() => handleTableExport('pdf')}
              title="Download the country submissions table as PDF">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M3 1h5l3 3v9H3zM8 1v3h3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
              {tableBusy ? 'Generating…' : 'Download (PDF)'}
            </button>
            <button type="button" className={btnCls} disabled={tableBusy} onClick={() => handleTableExport('xls')}
              title="Download the country submissions table as Excel">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M3 1h5l3 3v9H3zM8 1v3h3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                <path d="M5 8l4 4M9 8l-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              {tableBusy ? 'Generating…' : 'Download (XLS)'}
            </button>
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--bd)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ maxHeight: 440, overflowY: 'auto', overflowX: 'auto' }}>
            <table className="w-full border-collapse" style={{ fontFamily: 'var(--font-body)', fontSize: 13, minWidth: 520 }}>
              <thead>
                <tr>
                  {['Country', 'Submitted', 'In Progress', 'Not Started', 'Total'].map((h, i) => (
                    <th key={h} style={{
                      position: 'sticky', top: 0, zIndex: 1, background: '#fff',
                      padding: '10px 16px', textAlign: i === 0 ? 'left' : 'right',
                      color: MUTED, fontWeight: 700, fontSize: 10, textTransform: 'uppercase',
                      letterSpacing: '0.08em', borderBottom: '1px solid var(--bd)',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r) => (
                  <tr key={r.country} style={{ borderBottom: '1px solid var(--bd)', opacity: r.total === 0 ? 0.5 : 1 }}>
                    <td style={{ padding: '8px 16px', color: INK }}>{r.country}</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right' }} className="tabular-nums">{r.submitted}</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', color: r.inProgress ? '#b45309' : undefined }} className="tabular-nums">{r.inProgress}</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', color: r.notStarted ? MUTED : undefined }} className="tabular-nums">{r.notStarted}</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 700, color: r.total ? 'var(--g1)' : MUTED }} className="tabular-nums">{r.total}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--s2)', position: 'sticky', bottom: 0 }}>
                  <td style={{ padding: '10px 16px', fontWeight: 700, color: INK }}>Total</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }} className="tabular-nums">{totals.submitted}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }} className="tabular-nums">{totals.inProgress}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }} className="tabular-nums">{totals.notStarted}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--g1)' }} className="tabular-nums">{totals.total}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Signed up — not started */}
        <div className="mt-6">
          <h3 className="font-display font-semibold mb-1" style={{ fontSize: 15, color: INK }}>
            Signed up — not started ({notStartedUsers.length})
          </h3>
          <p className="font-body mb-3" style={{ fontSize: 12, color: MUTED }}>
            Accounts created with no submitted or in-progress response{profilesLoaded ? '' : ' — loading…'}. Not-started
            users usually haven’t reached the Country question, so they aren’t shown on a country row above.
          </p>
          {notStartedUsers.length === 0 ? (
            <p className="font-body" style={{ fontSize: 13, color: MUTED }}>
              {profilesLoaded ? 'Everyone who signed up has started the survey.' : 'Loading users…'}
            </p>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--bd)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ maxHeight: 300, overflowY: 'auto', overflowX: 'auto' }}>
                <table className="w-full border-collapse" style={{ fontFamily: 'var(--font-body)', fontSize: 13, minWidth: 560 }}>
                  <thead>
                    <tr>
                      {['Name', 'Email', 'Country', 'Signed up', 'Opened survey?'].map((h) => (
                        <th key={h} style={{
                          position: 'sticky', top: 0, background: '#fff', padding: '10px 16px', textAlign: 'left',
                          color: MUTED, fontWeight: 700, fontSize: 10, textTransform: 'uppercase',
                          letterSpacing: '0.08em', borderBottom: '1px solid var(--bd)',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {notStartedUsers.map((u, i) => (
                      <tr key={u.email + i} style={{ borderBottom: '1px solid var(--bd)' }}>
                        <td style={{ padding: '8px 16px', color: INK }}>{u.name}</td>
                        <td style={{ padding: '8px 16px', color: MUTED }}>{u.email}</td>
                        <td style={{ padding: '8px 16px' }}>{u.country}</td>
                        <td style={{ padding: '8px 16px', color: MUTED }} className="tabular-nums">{fmtDate(u.signedUp)}</td>
                        <td style={{ padding: '8px 16px' }}>
                          <span style={{ fontSize: 11, color: u.opened ? '#b45309' : MUTED }}>
                            {u.opened ? 'Opened (page 0)' : 'Never opened'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Section 2: answers by country ────────────────────────────────── */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="font-display text-lg font-semibold" style={{ color: INK }}>Answers by Country</h2>
            <p className="font-body" style={{ fontSize: 12, color: MUTED }}>
              Shade the globe by the share of each country’s respondents who chose a given answer.
            </p>
          </div>
          <button type="button" className={btnCls} disabled={answerBusy || !selected} onClick={handleAnswerExport}
            title="Download the selected question's country data (with map) as PDF">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3 1h5l3 3v9H3zM8 1v3h3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
            {answerBusy ? 'Generating…' : 'Download Question (PDF)'}
          </button>
        </div>

        {choiceQuestions.length === 0 ? (
          <p className="font-body" style={{ fontSize: 13, color: MUTED }}>No choice-based questions available to map.</p>
        ) : (
          <>
            {/* Selectors */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex items-center gap-1.5">
                <span className="font-body font-medium" style={{ fontSize: 11, color: MUTED }}>Section</span>
                <select className={selectCls} value={sectionFilter} aria-label="Filter questions by section" style={{ maxWidth: 260 }}
                  onChange={(e) => {
                    const sec = e.target.value
                    setSectionFilter(sec)
                    const list = sec === 'All' ? choiceQuestions : choiceQuestions.filter((c) => c.section === sec)
                    const next = list[0]
                    setQName(next?.q.name ?? '')
                    setAnswerValue(next ? (answerOptionsFor(next.q)[0]?.value ?? '') : '')
                  }}>
                  <option value="All">All sections</option>
                  {sectionOptions.map((s) => <option key={s.name} value={s.name}>{s.number}. {s.name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-body font-medium" style={{ fontSize: 11, color: MUTED }}>Question</span>
                <select className={selectCls} value={selected?.q.name ?? ''} aria-label="Select question" style={{ maxWidth: 460 }}
                  onChange={(e) => {
                    const next = visibleQuestions.find((c) => c.q.name === e.target.value)
                    setQName(e.target.value)
                    setAnswerValue(next ? (answerOptionsFor(next.q)[0]?.value ?? '') : '')
                  }}>
                  {visibleQuestions.map((c) => <option key={c.q.name} value={c.q.name}>{c.q.title || c.q.name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-body font-medium" style={{ fontSize: 11, color: MUTED }}>Answer</span>
                <select className={selectCls} value={effectiveAnswer} aria-label="Select answer" style={{ maxWidth: 320 }}
                  onChange={(e) => setAnswerValue(e.target.value)}>
                  {options.map((o) => <option key={o.value} value={o.value}>{o.text}</option>)}
                </select>
              </div>
            </div>

            {prevalence && (
              <p className="font-body mb-3" style={{ fontSize: 12, color: MUTED }}>
                Global: <strong style={{ color: 'var(--g1)' }}>{Math.round(prevalence.globalPrevalence * 100)}%</strong>{' '}
                chose “{answerLabel}” ({prevalence.globalCount} of {prevalence.globalN} respondents across{' '}
                {prevalence.byCountry.length} countr{prevalence.byCountry.length === 1 ? 'y' : 'ies'})
              </p>
            )}

            <div ref={mapWrapRef}>
              <AnswerChoroplethMap
                isoValue={prevalence?.isoValue ?? new Map()}
                isoDetail={isoDetail}
                answerLabel={answerLabel}
                height={420}
                preserveDrawingBuffer
              />
            </div>
          </>
        )}
      </section>
    </div>
  )
}
