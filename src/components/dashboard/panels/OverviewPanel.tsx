import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { useSurveyStore } from '@/stores/surveyStore'
import { SECTION_NAMES } from '@/constants'
import { formatSavedAt } from '@/utils/formatDate'

const TOTAL = 20

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getPct(pageNo: number): number {
  return Math.round((Math.max(0, pageNo) / TOTAL) * 100)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusTag({ status }: { status: 'draft' | 'submitted' | 'reviewed' | null }) {
  if (!status || status === 'draft') {
    return (
      <span className="inline-flex items-center gap-1.5 font-body text-[11px] font-semibold px-2.5 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200 tracking-[0.04em]">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
        Draft
      </span>
    )
  }
  if (status === 'submitted') {
    return (
      <span className="inline-flex items-center gap-1.5 font-body text-[11px] font-semibold px-2.5 py-1 rounded-full border bg-[#e8f5ec] text-[#0e5921] border-[#afc7b4] tracking-[0.04em]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#1d7733] flex-shrink-0" />
        Submitted
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-body text-[11px] font-semibold px-2.5 py-1 rounded-full border bg-blue-50 text-blue-700 border-blue-200 tracking-[0.04em]">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
      Reviewed
    </span>
  )
}

// ─── Survey card ─────────────────────────────────────────────────────────────

interface SurveyCardProps {
  pageNo: number
  status: 'draft' | 'submitted' | 'reviewed' | null
  savedAt: string | null
  onOpen: () => void
}

function SurveyCard({ pageNo, status, savedAt, onOpen }: SurveyCardProps) {
  const isSubmitted = status === 'submitted' || status === 'reviewed'
  const isNotStarted = !isSubmitted && pageNo === 0
  const pct = getPct(pageNo)

  // ── State 3: Submitted ──────────────────────────────────────────────────────
  if (isSubmitted) {
    return (
      <div
        className="bg-white rounded-2xl p-6 flex flex-col gap-4"
        style={{ border: '1px solid var(--bd)', boxShadow: 'var(--shadow-sm)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--g3)' }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M4 10.5l4.5 4.5 7.5-9"
                stroke="#1d7733"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <p className="font-body text-[11px] font-semibold tracking-[0.08em] uppercase text-[#1d7733] mb-0.5">
              Completed
            </p>
            <h2 className="font-display text-[18px] font-bold text-[#0d1117] leading-snug">
              Survey Submitted Successfully
            </h2>
          </div>
        </div>

        <p className="font-body text-[14px] text-[#3d4a52] leading-relaxed">
          Thank you for completing the 2026 IFFS Triennial Survey. Your responses have been
          recorded and will contribute to the global ART landscape report.
        </p>

        <button
          type="button"
          disabled
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-display text-[11px] font-bold tracking-[0.12em] uppercase cursor-not-allowed opacity-60 w-fit"
          style={{
            background: 'var(--g3)',
            color: 'var(--g1)',
            border: '1.5px solid var(--bd2)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M2.5 7.5l3 3 6-7"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Submitted
        </button>
      </div>
    )
  }

  // ── State 1: Not started ────────────────────────────────────────────────────
  if (isNotStarted) {
    return (
      <div
        className="bg-white rounded-2xl p-6 flex flex-col gap-4"
        style={{ border: '1px solid var(--bd)', boxShadow: 'var(--shadow-sm)' }}
      >
        <div>
          <p className="font-body text-[11px] font-semibold tracking-[0.08em] uppercase text-amber-600 mb-1.5">
            Action Required
          </p>
          <h2 className="font-display text-[20px] font-bold text-[#0d1117] leading-snug">
            Complete Your 2026 Triennial Survey
          </h2>
        </div>

        <p className="font-body text-[14px] text-[#3d4a52] leading-relaxed">
          20 sections covering ART infrastructure, regulation, financing, and clinical practice.
        </p>

        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-display text-[11px] font-bold tracking-[0.12em] uppercase text-white transition-all w-fit hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: 'var(--g1)',
            boxShadow: '0 4px 12px rgba(29,119,51,0.25)',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--g2)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--g1)'
          }}
        >
          Begin Survey
          <span aria-hidden="true">→</span>
        </button>
      </div>
    )
  }

  // ── State 2: In progress ────────────────────────────────────────────────────
  return (
    <div
      className="bg-white rounded-2xl p-6 flex flex-col gap-4"
      style={{ border: '1px solid var(--bd)', boxShadow: 'var(--shadow-sm)' }}
    >
      <div>
        <p className="font-body text-[11px] font-semibold tracking-[0.08em] uppercase text-[#1d7733] mb-1.5">
          {pct}% Complete
        </p>
        <h2 className="font-display text-[20px] font-bold text-[#0d1117] leading-snug">
          Continue Your Survey
        </h2>
      </div>

      <p className="font-body text-[14px] text-[#3d4a52] leading-relaxed">
        {pageNo} of {TOTAL} sections completed. Resume where you left off.
      </p>

      {savedAt && (
        <p className="font-body text-[12px] text-[#7a8a96]">
          Last saved: {formatSavedAt(savedAt)}
        </p>
      )}

      {/* Progress chips — 20 small squares */}
      <div className="flex flex-wrap gap-1.5" aria-label="Section progress">
        {SECTION_NAMES.map((name, i) => {
          const sectionNo = i + 1
          const isDone = sectionNo <= pageNo
          const isCurrent = sectionNo === pageNo + 1
          return (
            <div
              key={i}
              title={name}
              className="w-5 h-5 rounded-[4px] transition-all"
              style={{
                background: isDone
                  ? 'var(--g1)'
                  : isCurrent
                  ? 'transparent'
                  : 'var(--bd)',
                border: isCurrent
                  ? '2px solid var(--g1)'
                  : isDone
                  ? '2px solid transparent'
                  : '2px solid transparent',
              }}
              aria-label={`Section ${sectionNo}: ${name} — ${isDone ? 'done' : isCurrent ? 'current' : 'pending'}`}
            />
          )
        })}
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-display text-[11px] font-bold tracking-[0.12em] uppercase text-white transition-all w-fit hover:scale-[1.02] active:scale-[0.98]"
        style={{
          background: 'var(--g1)',
          boxShadow: '0 4px 12px rgba(29,119,51,0.25)',
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--g2)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--g1)'
        }}
      >
        Continue Survey
        <span aria-hidden="true">→</span>
      </button>
    </div>
  )
}

// ─── Progress tracker ─────────────────────────────────────────────────────────

function ProgressTracker({ pageNo, status }: { pageNo: number; status: string | null }) {
  const pct = getPct(pageNo)
  const isSubmitted = status === 'submitted' || status === 'reviewed'

  return (
    <div
      className="bg-white rounded-2xl p-6 flex flex-col gap-4"
      style={{ border: '1px solid var(--bd)', boxShadow: 'var(--shadow-sm)' }}
    >
      <div>
        <h3 className="font-display text-[14px] font-bold text-[#0d1117] mb-3">
          Progress Tracker
        </h3>

        {/* Progress bar */}
        <div className="flex items-center gap-3 mb-1">
          <div
            className="flex-1 h-2 rounded-full overflow-hidden"
            style={{ background: 'var(--bd)' }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Survey completion"
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: isSubmitted
                  ? 'var(--g1)'
                  : pct > 0
                  ? 'var(--g1)'
                  : 'transparent',
              }}
            />
          </div>
          <span className="font-display text-[12px] font-bold text-[#1d7733] flex-shrink-0 tabular-nums">
            {pct}%
          </span>
        </div>
        <p className="font-body text-[11px] text-[#7a8a96]">
          {isSubmitted ? TOTAL : Math.min(pageNo, TOTAL)} of {TOTAL} sections
        </p>
      </div>

      {/* Section list */}
      <div className="space-y-1.5">
        {SECTION_NAMES.slice(0, 10).map((name, i) => {
          const sectionNo = i + 1
          const isDone = isSubmitted || sectionNo <= pageNo
          const isCurrent = !isSubmitted && sectionNo === pageNo + 1
          return (
            <div
              key={i}
              className="flex items-center gap-2.5"
            >
              <span
                className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center"
                style={{
                  background: isDone ? 'var(--g3)' : isCurrent ? 'rgba(29,119,51,0.08)' : 'var(--bd)',
                  border: isCurrent ? '1.5px solid var(--g1)' : isDone ? 'none' : 'none',
                }}
                aria-hidden="true"
              >
                {isDone ? (
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                    <path d="M1.5 4.5l2 2 4-4" stroke="#1d7733" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : isCurrent ? (
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--g1)' }} />
                ) : null}
              </span>
              <span
                className="font-body text-[12px] truncate"
                style={{
                  color: isDone
                    ? 'var(--f1)'
                    : isCurrent
                    ? 'var(--g1)'
                    : 'var(--f3)',
                  fontWeight: isCurrent ? 600 : isDone ? 500 : 400,
                }}
              >
                {sectionNo}. {name}
              </span>
              {isCurrent && (
                <span
                  className="ml-auto font-body text-[10px] font-semibold text-[#1d7733] flex-shrink-0"
                  aria-hidden="true"
                >
                  →
                </span>
              )}
            </div>
          )
        })}

        {/* Remaining count */}
        <p
          className="font-body text-[11px] pt-1 pl-6.5"
          style={{ color: 'var(--f4)' }}
        >
          + 10 more sections
        </p>
      </div>
    </div>
  )
}

// ─── Admin stats row ──────────────────────────────────────────────────────────

interface AdminStats {
  total: number
  submitted: number
  inProgress: number
  notStarted: number
}

function StatsRow({ stats }: { stats: AdminStats }) {
  const cards = [
    { label: 'Total Users',  value: stats.total,      color: '#3d4a52' },
    { label: 'Submitted',    value: stats.submitted,   color: '#1d7733' },
    { label: 'In Progress',  value: stats.inProgress,  color: '#f59e0b' },
    { label: 'Not Started',  value: stats.notStarted,  color: '#b0bec5' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white rounded-xl p-4 flex flex-col gap-1"
          style={{ border: '1px solid var(--bd)', boxShadow: 'var(--shadow-sm)' }}
        >
          <span
            className="font-display text-[26px] font-bold tabular-nums leading-none"
            style={{ color: card.color }}
          >
            {card.value}
          </span>
          <span className="font-body text-[11px] text-[#7a8a96] font-medium">
            {card.label}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function OverviewPanel() {
  const { profile, isAdmin, canViewReports } = useAuthStore()
  const { openModal } = useSurveyStore()
  const { submission } = useSurveyStore()

  const firstName = profile?.first_name ?? 'there'
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const pageNo = submission?.page_no ?? 0
  const status = submission?.status ?? null
  const savedAt = submission?.saved_at ?? null

  // Admin/supervisor stats (derived from own submission as placeholder —
  // full stats come from ReportsPanel which fetches all submissions)
  const showStats = canViewReports()
  const adminStats: AdminStats = {
    total: 1,
    submitted: status === 'submitted' || status === 'reviewed' ? 1 : 0,
    inProgress: !status || (status === 'draft' && pageNo > 0) ? 1 : 0,
    notStarted: status === 'draft' && pageNo === 0 ? 1 : 0,
  }

  return (
    <div className="p-6 md:p-8 max-w-[1100px]">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-7">
        <div>
          <h1 className="font-display text-[24px] font-bold text-[#0d1117] leading-snug">
            Welcome, {firstName}
          </h1>
          <p className="font-body text-[13px] text-[#7a8a96] mt-0.5">{today}</p>
        </div>
        <StatusTag status={status as 'draft' | 'submitted' | 'reviewed' | null} />
      </div>

      {/* ── Admin stats ────────────────────────────────────────────────────── */}
      {showStats && <StatsRow stats={adminStats} />}

      {/* ── Main grid ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SurveyCard
          pageNo={pageNo}
          status={status as 'draft' | 'submitted' | 'reviewed' | null}
          savedAt={savedAt}
          onOpen={openModal}
        />
        <ProgressTracker
          pageNo={pageNo}
          status={status}
        />
      </div>

      {/* Admin note */}
      {isAdmin() && (
        <p
          className="mt-5 font-body text-[12px] text-[#7a8a96] bg-[#f7f9f7] border border-[#e2ebe4] rounded-lg px-4 py-2.5"
        >
          As an administrator, visit the{' '}
          <button
            type="button"
            className="text-[#1d7733] font-semibold hover:underline"
            onClick={() => useUIStore.getState().setActivePanel('reports')}
          >
            Reports
          </button>{' '}
          panel to see all submissions and the choropleth map.
        </p>
      )}
    </div>
  )
}
