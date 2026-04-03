import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { getSubmissions, resetSubmission } from '@/services/surveyService'

const ChoroplethMap = lazy(() =>
  import('@/components/map/ChoroplethMap').then(m => ({ default: m.ChoroplethMap }))
)
import { getRegion, resolveCountryToIso2, resolveCountryName } from '@/utils/countryRegions'
import { formatDateTime } from '@/utils/formatDate'
import { supabase } from '@/lib/supabase'
import { SECTION_NAMES, STATUS_LABELS } from '@/constants'
import { SectionResponsesView } from './SectionResponsesView'
import type { SubmissionRow, SurveyStatus } from '@/types'

type ReportsTab = 'overview' | 'responses'

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
  submitted: 'bg-[#e8f5ec] text-[#0e5921] border-[#afc7b4]',
  reviewed:  'bg-blue-50 text-blue-700 border-blue-200',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcProgress(pageNo: number): number {
  return Math.round((Math.max(0, pageNo) / 20) * 100)
}

function exportCsv(rows: SubmissionRow[]) {
  const headers = ['Name', 'Email', 'Country', 'Institution', 'Status', 'Progress %', 'Submitted At', 'Saved At']
  const lines = rows.map((r) => {
    const name = `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim()
    const pct = r.status === 'submitted' || r.status === 'reviewed' ? 100 : calcProgress(r.page_no)
    return [
      `"${name}"`,
      `"${r.email ?? ''}"`,
      `"${resolveCountryName(r.country ?? r.profile?.country ?? r.data?.['Country'])}"`,
      `"${r.institution ?? r.profile?.institution ?? ''}"`,
      r.status,
      pct,
      `"${r.submitted_at ? formatDateTime(r.submitted_at) : ''}"`,
      `"${r.saved_at ? formatDateTime(r.saved_at) : ''}"`,
    ].join(',')
  })
  const csv = [headers.join(','), ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `iffs-survey-report-${new Date().toISOString().slice(0, 10)}.csv`
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
    'font-body text-[12px] font-medium text-[#3d4a52] border border-[#e2ebe4] rounded-lg px-3 py-1.5 bg-white hover:border-[#1d7733] focus:outline-none focus:border-[#1d7733] transition-colors cursor-pointer'

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Status */}
      <div className="flex items-center gap-1.5">
        <span className="font-body text-[11px] text-[#7a8a96] font-medium">Status</span>
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
        <span className="font-body text-[11px] text-[#7a8a96] font-medium">Region</span>
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
        <span className="font-body text-[11px] text-[#7a8a96] font-medium">Section</span>
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
          <span className="font-body text-[11px] text-[#7a8a96] font-medium">{c.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Submissions table ────────────────────────────────────────────────────────

function SubmissionsTable({
  rows,
  onReset,
  isAdmin,
}: {
  rows: SubmissionRow[]
  onReset: (row: SubmissionRow) => void
  isAdmin: boolean
}) {
  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#e2ebe4] p-10 text-center">
        <p className="font-body text-[14px] text-[#b0bec5]">No submissions match your filters.</p>
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
              {['Name', 'Country', 'Status', 'Progress', 'Submitted', isAdmin ? 'Actions' : ''].filter(Boolean).map((h) => (
                <th
                  key={h}
                  className="font-display text-[10px] font-bold tracking-[0.12em] uppercase text-[#7a8a96] px-4 py-3"
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
                        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: 'var(--g3)' }}
                        aria-hidden="true"
                      >
                        <span className="font-display text-[10px] font-bold text-[#0e5921]">
                          {initials}
                        </span>
                      </div>
                      <div>
                        <p className="font-body text-[13px] font-semibold text-[#0d1117] leading-snug">
                          {name}
                        </p>
                        {row.email && (
                          <p className="font-body text-[11px] text-[#7a8a96]">{row.email}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Country */}
                  <td className="px-4 py-3">
                    <span className="font-body text-[13px] text-[#3d4a52]">{country}</span>
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
                      <span className="font-body text-[11px] text-[#7a8a96] tabular-nums">
                        {pct}%
                      </span>
                    </div>
                  </td>

                  {/* Submitted at */}
                  <td className="px-4 py-3">
                    <span className="font-body text-[12px] text-[#7a8a96]">
                      {row.submitted_at ? formatDateTime(row.submitted_at) : '—'}
                    </span>
                  </td>

                  {/* Actions — admin only */}
                  {isAdmin && (
                    <td className="px-4 py-3">
                      {row.id && (
                        <button
                          type="button"
                          onClick={() => onReset(row)}
                          className="font-display text-[10px] font-bold tracking-[0.10em] uppercase px-3 py-1.5 rounded-lg border-[1.5px] text-red-600 border-red-200 hover:bg-red-50 transition-all"
                        >
                          Reset
                        </button>
                      )}
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
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<ReportFilters>({
    status: 'All',
    region: 'All',
    section: 'All',
  })

  // ── Fetch ─────────────────────────────────────────────────────────────────
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

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  // ── Realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('reports-submissions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'survey_submissions' },
        () => void fetchAll()
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [fetchAll])

  // ── Filter ────────────────────────────────────────────────────────────────
  const filteredRows = rows.filter((row) => {
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
  ]

  return (
    <div className="p-6 md:p-8 max-w-[1200px]">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="font-display text-[22px] font-bold text-[#0d1117]">Reports</h1>
          <p className="font-body text-[13px] text-[#7a8a96] mt-0.5">
            Survey submissions across all participants
          </p>
        </div>

        {tab === 'overview' && (
          <button
            type="button"
            onClick={() => exportCsv(filteredRows)}
            disabled={filteredRows.length === 0}
            className="inline-flex items-center gap-2 font-display text-[11px] font-bold tracking-[0.12em] uppercase px-4 py-2 rounded-full border-[1.5px] border-[#c8d9cc] text-[#3d4a52] hover:border-[#1d7733] hover:text-[#1d7733] hover:bg-[#e8f5ec] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Export CSV"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Export CSV
          </button>
        )}
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div
        className="flex gap-1 mb-6 p-1 rounded-xl"
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
            className="font-body text-[12px] font-semibold px-4 py-1.5 rounded-lg transition-all"
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

          {/* ── Filter bar ───────────────────────────────────────────────────── */}
          <div className="mb-5">
            <FilterBar
              filters={filters}
              onChange={(partial) => setFilters((prev) => ({ ...prev, ...partial }))}
            />
          </div>

          {/* ── Choropleth map ───────────────────────────────────────────────── */}
          <div className="mb-6">
            <Suspense fallback={<div style={{ height: 380, background: 'var(--s2)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--f3)', fontSize: 13 }}>Loading map…</div>}>
              <ChoroplethMap submissions={filteredRows} height="380px" />
            </Suspense>
          </div>

          {/* ── Table ────────────────────────────────────────────────────────── */}
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 rounded-full border-2 border-[#1d7733] border-t-transparent animate-spin" />
            </div>
          ) : (
            <SubmissionsTable
              rows={filteredRows}
              onReset={handleReset}
              isAdmin={isAdmin()}
            />
          )}

          {/* Row count */}
          {!loading && (
            <p className="font-body text-[11px] text-[#b0bec5] mt-3 text-right">
              Showing {filteredRows.length} of {rows.length} submissions
            </p>
          )}
        </>
      )}

      {tab === 'responses' && (
        <SectionResponsesView submissions={rows} />
      )}
    </div>
  )
}
