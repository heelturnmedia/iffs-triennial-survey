import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { getSubmissions, getMapSubmissions, resetSubmission } from '@/services/surveyService'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

// A failed import here almost always means the app was redeployed while this
// tab was open, so the chunk hash in memory no longer exists on the server.
// This previously called window.location.reload() immediately — an unannounced
// navigation that discards anything unsaved elsewhere in the dashboard (a
// half-written filter, an open confirm dialog, and in the worst case a survey
// draft that has not hit its 800ms autosave yet). Offer the reload instead of
// taking it, and render an inline notice rather than an empty space.
const ChoroplethMap = lazy(() =>
  import('@/components/map/ChoroplethMap')
    .then(m => ({ default: m.ChoroplethMap }))
    .catch(() => ({ default: StaleChunkNotice }))
)

function StaleChunkNotice() {
  return (
    <div
      style={{
        height: 380, borderRadius: 16, background: 'var(--s2)',
        border: '1px dashed var(--bd2)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 10, textAlign: 'center',
        padding: 24,
      }}
      role="status"
    >
      <p className="font-display text-[14px] font-bold text-f2">
        A new version of the app is available
      </p>
      <p className="font-body text-[12px] text-f3 max-w-sm">
        The map could not load because this page is running an older version.
        Reload to get the latest — any answers you have entered are already saved.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex items-center gap-2 font-display text-[11px] font-bold tracking-[0.12em] uppercase px-5 min-h-[40px] rounded-full text-white bg-g1 hover:bg-g2 transition-colors cursor-pointer"
      >
        Reload page
      </button>
    </div>
  )
}
import { getRegion, resolveCountryToIso2, resolveCountryName } from '@/utils/countryRegions'
import { formatDateTime, formatDuration, formatSeconds, durationMinutes } from '@/utils/formatDate'
import { supabase } from '@/lib/supabase'
import { SECTION_NAMES, STATUS_LABELS } from '@/constants'
import { SURVEY_DEFINITION } from '@/data/survey-definition'
import { useSurveyStore } from '@/stores/surveyStore'
import { exportIndividualCsv } from '@/utils/exportIndividualResponse'
import { logActivity } from '@/services/auditService'
import { SectionResponsesView } from './SectionResponsesView'
import { InsightsView } from './InsightsView'
import { DataQualityView } from './DataQualityView'
import { CountriesDataView } from './CountriesDataView'
import type { SubmissionRow, MapSubmission, SurveyStatus } from '@/types'

type ReportsTab = 'overview' | 'responses' | 'insights' | 'quality' | 'countries'

// ─── Types ────────────────────────────────────────────────────────────────────

type RegionFilter = 'All' | 'Africa' | 'Americas' | 'Asia' | 'Europe' | 'Oceania'
type StatusFilter = 'All' | SurveyStatus

interface ReportFilters {
  status: StatusFilter
  region: RegionFilter
  section: number | 'All'
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REGIONS: RegionFilter[] = ['All', 'Africa', 'Americas', 'Asia', 'Europe', 'Oceania']
const STATUS_OPTIONS: StatusFilter[] = ['All', 'draft', 'submitted', 'reviewed']

const STATUS_CHIP_STYLES: Record<SurveyStatus, string> = {
  draft:     'bg-amber-50 text-amber-700 border-amber-200',
  submitted: 'bg-g3 text-g2 border-[#afc7b4]',
  reviewed:  'bg-blue-50 text-blue-700 border-blue-200',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcProgress(pageNo: number): number {
  return Math.round((Math.max(0, pageNo) / 20) * 100)
}

function exportCsv(rows: SubmissionRow[]) {
  // Columns mirror the Overview table, including Time Taken and Active Time.
  // Each duration is exported twice: the human-readable string shown on screen,
  // plus a raw minutes number so the column can actually be sorted, averaged or
  // charted in Excel ("2h 15m" sorts as text and is useless for analysis).
  const headers = [
    'Reference', 'Name', 'Email', 'Country', 'Institution', 'Status', 'Progress %',
    'Submitted At', 'Saved At',
    'Time Taken', 'Time Taken (minutes)',
    'Active Time', 'Active Time (minutes)',
  ]
  const lines = rows.map((r) => {
    const name = `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim()
    const isSubmitted = r.status === 'submitted' || r.status === 'reviewed'
    const pct = isSubmitted ? 100 : calcProgress(r.page_no)
    // Time Taken is only meaningful once submitted — matches the table, which
    // shows an em dash for anything still in progress.
    const timeTaken = isSubmitted ? formatDuration(r.created_at, r.submitted_at) : '—'
    const timeTakenMin = isSubmitted ? durationMinutes(r.created_at, r.submitted_at) : ''
    const activeSeconds = r.active_seconds
    const activeMin =
      activeSeconds != null && Number.isFinite(activeSeconds) && activeSeconds > 0
        ? Math.floor(activeSeconds / 60)
        : ''
    return [
      `"${r.reference_no ?? ''}"`,
      `"${name}"`,
      `"${r.email ?? ''}"`,
      `"${resolveCountryName(r.country ?? r.profile?.country ?? r.data?.['Country'])}"`,
      `"${r.institution ?? r.profile?.institution ?? ''}"`,
      r.status,
      pct,
      `"${r.submitted_at ? formatDateTime(r.submitted_at) : ''}"`,
      `"${r.saved_at ? formatDateTime(r.saved_at) : ''}"`,
      `"${timeTaken}"`,
      timeTakenMin,
      `"${formatSeconds(activeSeconds)}"`,
      activeMin,
    ].join(',')
  })
  const csv = [headers.join(','), ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `iffs-user-submissions-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

function FilterBar({
  filters,
  onChange,
}: {
  filters: ReportFilters
  onChange: (f: Partial<ReportFilters>) => void
}) {
  const selectCls =
    'font-body text-[12px] font-medium text-f2 border border-bd rounded-lg px-3 py-1.5 bg-white hover:border-g1 focus:outline-hidden focus:border-g1 transition-colors cursor-pointer'

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Status */}
      <div className="flex items-center gap-1.5">
        <span className="font-body text-[11px] text-f3 font-medium">Status</span>
        <select
          value={filters.status}
          onChange={(e) => onChange({ status: e.target.value as StatusFilter })}
          className={selectCls}
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === 'All' ? 'All' : STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {/* Region */}
      <div className="flex items-center gap-1.5">
        <span className="font-body text-[11px] text-f3 font-medium">Region</span>
        <select
          value={filters.region}
          onChange={(e) => onChange({ region: e.target.value as RegionFilter })}
          className={selectCls}
          aria-label="Filter by region"
        >
          {REGIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Section */}
      <div className="flex items-center gap-1.5">
        <span className="font-body text-[11px] text-f3 font-medium">Section</span>
        <select
          value={filters.section}
          onChange={(e) =>
            onChange({ section: e.target.value === 'All' ? 'All' : Number(e.target.value) })
          }
          className={selectCls}
          aria-label="Filter by section"
        >
          <option value="All">All</option>
          {SECTION_NAMES.map((name, i) => (
            <option key={i} value={i + 1}>
              {i + 1}. {name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

// ─── Stats cards ──────────────────────────────────────────────────────────────

function StatsCards({ rows }: { rows: SubmissionRow[] }) {
  const total = rows.length
  const submitted = rows.filter((r) => r.status === 'submitted' || r.status === 'reviewed').length
  const inProgress = rows.filter((r) => r.status === 'draft' && r.page_no > 0).length
  const notStarted = rows.filter((r) => r.status === 'draft' && r.page_no === 0).length

  const cards = [
    { label: 'Total',       value: total,       color: '#3d4a52' },
    { label: 'Submitted',   value: submitted,   color: '#1d7733' },
    { label: 'In Progress', value: inProgress,  color: '#f59e0b' },
    { label: 'Not Started', value: notStarted,  color: '#b0bec5' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="bg-white rounded-xl p-4 flex flex-col gap-1"
          style={{ border: '1px solid var(--bd)', boxShadow: 'var(--shadow-sm)' }}
        >
          <span
            className="font-display text-[28px] font-bold tabular-nums leading-none"
            style={{ color: c.color }}
          >
            {c.value}
          </span>
          <span className="font-body text-[11px] text-f3 font-medium">{c.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Submissions table ────────────────────────────────────────────────────────

function SubmissionsTable({
  rows,
  onReset,
  onExportCsv,
  onExportPdf,
  isAdmin,
}: {
  rows: SubmissionRow[]
  onReset: (row: SubmissionRow) => void
  onExportCsv: (row: SubmissionRow) => void
  onExportPdf: (row: SubmissionRow) => void
  isAdmin: boolean
}) {
  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-bd p-10 text-center">
        <p className="font-body text-[14px] text-f4">No submissions match your filters.</p>
      </div>
    )
  }

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden"
      style={{ border: '1px solid var(--bd)', boxShadow: 'var(--shadow-sm)' }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse" style={{ minWidth: '720px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--bd)' }}>
              {['Name', 'Country', 'Status', 'Progress', 'Submitted', 'Time Taken', 'Active Time', isAdmin ? 'Actions' : ''].filter(Boolean).map((h) => (
                <th
                  key={h}
                  className="font-display text-[10px] font-bold tracking-[0.12em] uppercase text-f3 px-4 py-3"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const name = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || 'Unknown'
              const country = resolveCountryName(row.country ?? row.profile?.country ?? row.data?.['Country']) || '—'
              const isSubmitted = row.status === 'submitted' || row.status === 'reviewed'
              const pct = isSubmitted ? 100 : calcProgress(row.page_no)
              const initials = name
                .split(' ')
                .map((p) => p[0] ?? '')
                .join('')
                .toUpperCase()
                .slice(0, 2)

              return (
                <tr
                  key={row.id ?? i}
                  className="transition-colors"
                  style={{ borderBottom: i < rows.length - 1 ? '1px solid #f0f4f1' : 'none' }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLTableRowElement).style.background = '#f7f9f7'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLTableRowElement).style.background = 'transparent'
                  }}
                >
                  {/* Name */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: 'var(--g3)' }}
                        aria-hidden="true"
                      >
                        <span className="font-display text-[10px] font-bold text-g2">
                          {initials}
                        </span>
                      </div>
                      <div>
                        <p className="font-body text-[13px] font-semibold text-f1 leading-snug">
                          {name}
                        </p>
                        {row.email && (
                          <p className="font-body text-[11px] text-f3">{row.email}</p>
                        )}
                        {row.reference_no && (
                          <p className="font-mono text-[10px] text-g1 tracking-tight mt-0.5">
                            {row.reference_no}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Country */}
                  <td className="px-4 py-3">
                    <span className="font-body text-[13px] text-f2">{country}</span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span
                      className={[
                        'inline-flex font-body text-[10px] font-semibold px-2 py-0.5 rounded-full border tracking-[0.04em]',
                        STATUS_CHIP_STYLES[row.status] ?? STATUS_CHIP_STYLES['draft'],
                      ].join(' ')}
                    >
                      {row.status === 'draft' && row.page_no === 0
                        ? 'Not Started'
                        : STATUS_LABELS[row.status]}
                    </span>
                  </td>

                  {/* Progress */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-20 h-1.5 rounded-full overflow-hidden"
                        style={{ background: 'var(--bd)' }}
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            background: isSubmitted ? 'var(--g1)' : '#f59e0b',
                          }}
                        />
                      </div>
                      <span className="font-body text-[11px] text-f3 tabular-nums">
                        {pct}%
                      </span>
                    </div>
                  </td>

                  {/* Submitted at */}
                  <td className="px-4 py-3">
                    <span className="font-body text-[12px] text-f3">
                      {row.submitted_at ? formatDateTime(row.submitted_at) : '—'}
                    </span>
                  </td>

                  {/* Time taken — start (created_at) → submission. Only meaningful
                      once submitted; blank while still in progress. */}
                  <td className="px-4 py-3">
                    <span
                      className="font-body text-[12px] text-f2 tabular-nums"
                      title={isSubmitted ? 'Elapsed time from first saved answer to submission' : undefined}
                    >
                      {isSubmitted ? formatDuration(row.created_at, row.submitted_at) : '—'}
                    </span>
                  </td>

                  {/* Active time — focused, non-idle engagement time in the survey.
                      "—" for rows created before tracking existed. */}
                  <td className="px-4 py-3">
                    <span
                      className="font-body text-[12px] text-f2 tabular-nums"
                      title="Active time spent in the survey (tab focused, non-idle)"
                    >
                      {formatSeconds(row.active_seconds)}
                    </span>
                  </td>

                  {/* Actions — admin only */}
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap">
                        {Object.keys(row.data ?? {}).length > 0 && (
                          <>
                            <button
                              type="button"
                              onClick={() => onExportCsv(row)}
                              title={`Download ${name}'s answers as CSV`}
                              className="font-display text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-lg border-[1.5px] text-g1 border-[#afc7b4] hover:bg-g3 transition-all"
                            >
                              CSV
                            </button>
                            <button
                              type="button"
                              onClick={() => onExportPdf(row)}
                              title={`Download ${name}'s answers as PDF`}
                              className="font-display text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-lg border-[1.5px] text-g1 border-[#afc7b4] hover:bg-g3 transition-all"
                            >
                              PDF
                            </button>
                          </>
                        )}
                        {row.id && (
                          <button
                            type="button"
                            onClick={() => onReset(row)}
                            className="font-display text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-lg border-[1.5px] text-red-600 border-red-200 hover:bg-red-50 transition-all"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function ReportsPanel() {
  const { isAdmin } = useAuthStore()
  const { toast, openConfirmModal } = useUIStore()

  const [tab, setTab] = useState<ReportsTab>('overview')
  const [rows, setRows] = useState<SubmissionRow[]>([])
  const [mapRows, setMapRows] = useState<MapSubmission[]>([])
  const [mapDataReady, setMapDataReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<ReportFilters>({
    status: 'All',
    region: 'All',
    section: 'All',
  })

  // ── Fetch table data ──────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const data = await getSubmissions()
      setRows(data)
    } catch (err) {
      console.error('ReportsPanel fetch error:', err)
      toast('Failed to load submissions.', 'err')
    } finally {
      setLoading(false)
    }
  }, [toast])

  // ── Fetch lightweight map data (unfiltered, no survey JSON) ───────────────
  const fetchMapData = useCallback(async () => {
    try {
      const data = await getMapSubmissions()
      setMapRows(data)
    } catch (err) {
      console.error('ReportsPanel map fetch error:', err)
      // Non-critical — map will just show nothing
    } finally {
      // Gate ChoroplethMap mount until data is ready so the Mapbox Layer is
      // always created with the correct fill expression on first render.
      // If we mount with empty submissions first, react-map-gl does not
      // reliably call setPaintProperty when the expression later changes.
      setMapDataReady(true)
    }
  }, [])

  useEffect(() => {
    void fetchAll()
    void fetchMapData()
  }, [fetchAll, fetchMapData])

  // ── Realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('reports-submissions')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'survey_submissions' },
        () => { void fetchAll(); void fetchMapData() }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'survey_submissions' },
        () => { void fetchAll(); void fetchMapData() }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [fetchAll, fetchMapData])

  // ── Filter ────────────────────────────────────────────────────────────────
  const filteredRows = rows.filter((row) => {
    if (search.trim()) {
      const q = search.toLowerCase()
      const name = `${row.first_name ?? ''} ${row.last_name ?? ''}`.toLowerCase()
      const email = (row.email ?? '').toLowerCase()
      const ref = (row.reference_no ?? '').toLowerCase()
      if (!name.includes(q) && !email.includes(q) && !ref.includes(q)) return false
    }

    if (filters.status !== 'All' && row.status !== filters.status) return false

    if (filters.region !== 'All') {
      const countryVal = row.country ?? row.profile?.country ?? row.data?.['Country']
      const iso2 = resolveCountryToIso2(countryVal)
      const region = iso2 ? getRegion(iso2) : 'Unknown'
      if (region !== filters.region) return false
    }

    if (filters.section !== 'All') {
      const sectionNo = filters.section as number
      const isSubmitted = row.status === 'submitted' || row.status === 'reviewed'
      if (!isSubmitted && row.page_no < sectionNo) return false
    }

    return true
  })

  // ── Individual response export (per participant, all sections) ────────────
  const { activeDefinition } = useSurveyStore()
  const definitionPages = ((activeDefinition?.definition ?? SURVEY_DEFINITION) as Record<string, unknown>)['pages'] as unknown[] ?? []

  const handleExportRowCsv = (row: SubmissionRow) => {
    exportIndividualCsv(row, definitionPages, SECTION_NAMES)
    void logActivity('export_response', {
      target_email: row.email ?? row.profile?.email, reference: row.reference_no, format: 'csv',
    })
  }

  const handleExportRowPdf = async (row: SubmissionRow) => {
    // Lazy-load jsPDF (~140 KB gzip) only when an admin actually exports.
    const { exportIndividualPdf } = await import('@/utils/exportIndividualPdf')
    exportIndividualPdf(row, definitionPages, SECTION_NAMES)
    void logActivity('export_response', {
      target_email: row.email ?? row.profile?.email, reference: row.reference_no, format: 'pdf',
    })
  }

  // ── Templated surveillance report (all sections) ──────────────────────────
  const [reportBusy, setReportBusy] = useState(false)
  const handleGenerateReport = async () => {
    setReportBusy(true)
    try {
      const { exportSurveyReport } = await import('@/utils/exportSurveyReport')
      exportSurveyReport(rows, definitionPages, SECTION_NAMES)
      void logActivity('export_all_responses', { format: 'report_pdf', count: rows.length })
    } catch (err) {
      console.error('Report generation failed:', err)
      toast('Failed to generate report.', 'err')
    } finally {
      setReportBusy(false)
    }
  }

  const [reportXlsBusy, setReportXlsBusy] = useState(false)
  const handleGenerateReportXls = async () => {
    setReportXlsBusy(true)
    try {
      const { exportSurveyReportXls } = await import('@/utils/exportSurveyReportXls')
      exportSurveyReportXls(rows, definitionPages, SECTION_NAMES)
      void logActivity('export_all_responses', { format: 'report_xls', count: rows.length })
    } catch (err) {
      console.error('XLS report generation failed:', err)
      toast('Failed to generate the Excel report.', 'err')
    } finally {
      setReportXlsBusy(false)
    }
  }

  // ── Cumulative responses (every question × every user) ────────────────────
  // Wide CSV matrix of all answers from all users — the raw analysable dataset,
  // distinct from the roster CSV (meta only) and the aggregated report above.
  const [cumulativeCsvBusy, setCumulativeCsvBusy] = useState(false)
  const handleExportCumulativeCsv = async () => {
    setCumulativeCsvBusy(true)
    try {
      const { exportCumulativeCsv } = await import('@/utils/exportCumulativeResponses')
      exportCumulativeCsv(rows, definitionPages, SECTION_NAMES)
      void logActivity('export_all_responses', { format: 'cumulative_csv', count: rows.length })
    } catch (err) {
      console.error('Cumulative CSV export failed:', err)
      toast('Failed to generate the cumulative report.', 'err')
    } finally {
      setCumulativeCsvBusy(false)
    }
  }

  const [cumulativeXlsBusy, setCumulativeXlsBusy] = useState(false)
  const handleExportCumulativeXls = async () => {
    setCumulativeXlsBusy(true)
    try {
      const { exportCumulativeXls } = await import('@/utils/exportCumulativeResponses')
      exportCumulativeXls(rows, definitionPages, SECTION_NAMES)
      void logActivity('export_all_responses', { format: 'cumulative_xls', count: rows.length })
    } catch (err) {
      console.error('Cumulative XLS export failed:', err)
      toast('Failed to generate the cumulative Excel report.', 'err')
    } finally {
      setCumulativeXlsBusy(false)
    }
  }

  // ── Reset action ──────────────────────────────────────────────────────────
  const handleReset = (row: SubmissionRow) => {
    const name = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || 'this user'
    openConfirmModal({
      title: 'Reset Survey',
      message: `Reset the survey for ${name}? This will clear all their responses and cannot be undone.`,
      variant: 'danger',
      onConfirm: async () => {
        if (!row.user_id) return
        try {
          await resetSubmission(row.user_id)
          toast(`Survey reset for ${name}.`, 'ok')
          await fetchAll()
        } catch {
          toast('Failed to reset survey.', 'err')
        }
      },
    })
  }

  const TABS: Array<{ id: ReportsTab; label: string }> = [
    { id: 'overview',  label: 'Overview' },
    { id: 'responses', label: 'Section Responses' },
    { id: 'insights',  label: 'Insights' },
    { id: 'quality',   label: 'Data Quality' },
    { id: 'countries', label: 'Countries Data' },
  ]

  return (
    <div className="p-6 md:p-8 max-w-[1200px]">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="font-display text-[22px] font-bold text-f1">Reports</h1>
          <p className="font-body text-[13px] text-f3 mt-0.5">
            Survey submissions across all participants
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {isAdmin() && (
            <button
              type="button"
              onClick={handleGenerateReport}
              disabled={reportBusy || rows.length === 0}
              className="inline-flex items-center gap-2 font-display text-[11px] font-bold tracking-[0.12em] uppercase px-4 py-2 rounded-full border-[1.5px] border-g1 text-white bg-g1 hover:bg-g2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Generate surveillance report PDF"
              title="Generate the templated Surveillance Report (PDF)"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M3 1h5l3 3v9H3zM8 1v3h3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
              {reportBusy ? 'Generating…' : 'Report (PDF)'}
            </button>
          )}

          {isAdmin() && (
            <button
              type="button"
              onClick={handleGenerateReportXls}
              disabled={reportXlsBusy || rows.length === 0}
              className="inline-flex items-center gap-2 font-display text-[11px] font-bold tracking-[0.12em] uppercase px-4 py-2 rounded-full border-[1.5px] border-g1 text-g1 bg-white hover:bg-g3 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Generate surveillance report Excel"
              title="Download the Surveillance Report as an Excel workbook (.xls)"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M3 1h5l3 3v9H3zM8 1v3h3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                <path d="M5 8l4 4M9 8l-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              {reportXlsBusy ? 'Generating…' : 'Report (XLS)'}
            </button>
          )}

          {tab === 'overview' && (
            <>
              <button
                type="button"
                onClick={() => {
                  exportCsv(filteredRows)
                  void logActivity('export_all_responses', { format: 'csv', count: filteredRows.length })
                }}
                disabled={filteredRows.length === 0}
                className="inline-flex items-center gap-2 font-display text-[11px] font-bold tracking-[0.12em] uppercase px-4 py-2 rounded-full border-[1.5px] border-bd2 text-f2 hover:border-g1 hover:text-g1 hover:bg-g3 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Export user submissions CSV"
                title="Download the list of user submissions (name, email, country, status) as CSV"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                User Submissions (CSV)
              </button>

              {isAdmin() && (
                <button
                  type="button"
                  onClick={handleExportCumulativeCsv}
                  disabled={cumulativeCsvBusy || rows.length === 0}
                  className="inline-flex items-center gap-2 font-display text-[11px] font-bold tracking-[0.12em] uppercase px-4 py-2 rounded-full border-[1.5px] border-g1 text-g1 bg-white hover:bg-g3 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Download cumulative report — every question and answer from all users — as CSV"
                  title="Every question and every answer from all users as one CSV matrix (opens in Excel)"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M2 2h10v10H2zM2 6h10M2 9h10M6 2v10" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                  </svg>
                  {cumulativeCsvBusy ? 'Generating…' : 'Cumulative Report (CSV)'}
                </button>
              )}

              {isAdmin() && (
                <button
                  type="button"
                  onClick={handleExportCumulativeXls}
                  disabled={cumulativeXlsBusy || rows.length === 0}
                  className="inline-flex items-center gap-2 font-display text-[11px] font-bold tracking-[0.12em] uppercase px-4 py-2 rounded-full border-[1.5px] border-g1 text-g1 bg-white hover:bg-g3 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Download cumulative report — every question and answer from all users — as Excel"
                  title="Every question and every answer from all users as one Excel (.xls) matrix"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M2 2h10v10H2zM2 6h10M2 9h10M6 2v10" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                    <path d="M4.5 4.5l5 5M9.5 4.5l-5 5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                  </svg>
                  {cumulativeXlsBusy ? 'Generating…' : 'Cumulative Report (XLS)'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div
        className="flex gap-1 mb-6 p-1 rounded-xl max-w-full overflow-x-auto"
        style={{ background: '#f0f4f1', border: '1px solid var(--bd)', width: 'fit-content' }}
        role="tablist"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className="font-body text-[12px] font-semibold px-4 py-1.5 rounded-lg transition-all shrink-0 whitespace-nowrap min-h-[36px]"
            style={
              tab === t.id
                ? { background: '#fff', color: '#0e5921', boxShadow: 'var(--shadow-sm)', border: '1px solid #c8d9cc' }
                : { background: 'transparent', color: '#7a8a96', border: '1px solid transparent' }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          {/* ── Stats ────────────────────────────────────────────────────────── */}
          <div className="mb-5">
            <StatsCards rows={rows} />
          </div>

          {/* ── Search + filter bar ──────────────────────────────────────────── */}
          <div className="mb-5 flex flex-wrap items-center gap-4">
            <div className="relative max-w-xs shrink-0">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-f4" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M9.5 9.5l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </span>
              <input
                type="search"
                placeholder="Search name, email, or reference…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 font-body text-[13px] border border-bd rounded-lg bg-white placeholder-f4 text-f1 focus:outline-hidden focus:border-g1 transition-colors"
                aria-label="Search submissions"
              />
            </div>
            <FilterBar
              filters={filters}
              onChange={(partial) => setFilters((prev) => ({ ...prev, ...partial }))}
            />
          </div>

          {/* ── Choropleth map ───────────────────────────────────────────────── */}
          <div className="mb-6">
            <ErrorBoundary label="Map">
              <Suspense fallback={<div style={{ height: 380, background: 'var(--s2)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--f3)', fontSize: 13 }}>Loading map…</div>}>
                {mapDataReady
                  ? <ChoroplethMap submissions={mapRows} height="380px" />
                  : <div style={{ height: 380, background: 'var(--s2)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--f3)', fontSize: 13 }}>Loading map…</div>
                }
              </Suspense>
            </ErrorBoundary>
          </div>

          {/* ── Table ────────────────────────────────────────────────────────── */}
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 rounded-full border-2 border-g1 border-t-transparent animate-spin" />
            </div>
          ) : (
            <SubmissionsTable
              rows={filteredRows}
              onReset={handleReset}
              onExportCsv={handleExportRowCsv}
              onExportPdf={handleExportRowPdf}
              isAdmin={isAdmin()}
            />
          )}

          {/* Row count */}
          {!loading && (
            <p className="font-body text-[11px] text-f4 mt-3 text-right">
              Showing {filteredRows.length} of {rows.length} submissions
            </p>
          )}
        </>
      )}

      {tab === 'responses' && (
        <SectionResponsesView submissions={rows} />
      )}

      {tab === 'insights' && (
        <InsightsView submissions={rows} pages={definitionPages} sectionNames={SECTION_NAMES} />
      )}

      {tab === 'quality' && (
        <DataQualityView submissions={rows} pages={definitionPages} />
      )}

      {tab === 'countries' && (
        <CountriesDataView submissions={rows} pages={definitionPages} sectionNames={SECTION_NAMES} />
      )}
    </div>
  )
}
