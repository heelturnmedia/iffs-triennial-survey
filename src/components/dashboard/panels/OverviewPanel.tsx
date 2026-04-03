import {
  Users,
  CheckCircle2,
  Clock3,
  CircleDashed,
  ArrowRight,
  ChevronRight,
} from 'lucide-react'
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
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--g3)' }}
          >
            <CheckCircle2 size={20} color="var(--g1)" strokeWidth={2} />
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

        <div
          className="flex items-start gap-3 rounded-xl px-4 py-3"
          style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}
        >
          <svg className="flex-shrink-0 mt-0.5" width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M2.5 5.5A1.5 1.5 0 014 4h12a1.5 1.5 0 011.5 1.5v.379l-7.5 5-7.5-5V5.5z" fill="#1d7733" opacity="0.3"/>
            <path d="M2.5 7.621V14.5A1.5 1.5 0 004 16h12a1.5 1.5 0 001.5-1.5V7.621l-7.5 5-7.5-5z" fill="#1d7733" opacity="0.3"/>
            <rect x="2.5" y="4" width="15" height="12" rx="1.5" stroke="#1d7733" strokeWidth="1.4"/>
            <path d="M2.5 6.5l7.5 5 7.5-5" stroke="#1d7733" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <p className="font-body text-[13px] text-[#0e5921] leading-snug">
            You will receive a confirmation email from us shortly. Please check your inbox.
          </p>
        </div>

        <div className="flex items-center gap-2 w-fit px-4 py-2 rounded-full opacity-60"
          style={{ background: 'var(--g3)', border: '1.5px solid var(--bd2)' }}>
          <CheckCircle2 size={13} color="var(--g1)" strokeWidth={2.2} />
          <span className="font-display text-[11px] font-bold tracking-[0.1em] uppercase" style={{ color: 'var(--g1)' }}>
            Submitted
          </span>
        </div>
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
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-display text-[11px] font-bold tracking-[0.12em] uppercase text-white transition-all w-fit"
          style={{
            background: 'var(--g1)',
            boxShadow: '0 4px 12px rgba(29,119,51,0.25)',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--g2)'
            ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--g1)'
            ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
          }}
        >
          Begin Survey
          <ArrowRight size={13} strokeWidth={2.2} aria-hidden="true" />
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
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-display text-[11px] font-bold tracking-[0.12em] uppercase text-white transition-all w-fit"
        style={{
          background: 'var(--g1)',
          boxShadow: '0 4px 12px rgba(29,119,51,0.25)',
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--g2)'
          ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--g1)'
          ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
        }}
      >
        Continue Survey
        <ArrowRight size={13} strokeWidth={2.2} aria-hidden="true" />
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
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${isSubmitted ? 100 : pct}%`,
                background: 'linear-gradient(90deg, var(--g1) 0%, var(--g5) 100%)',
              }}
            />
          </div>
          <span className="font-display text-[12px] font-bold text-[#1d7733] flex-shrink-0 tabular-nums">
            {isSubmitted ? 100 : pct}%
          </span>
        </div>
        <p className="font-body text-[11px] text-[#7a8a96]">
          {isSubmitted ? TOTAL : Math.min(pageNo, TOTAL)} of {TOTAL} sections
        </p>
      </div>

      {/* Section list */}
      <div className="space-y-1">
        {SECTION_NAMES.slice(0, 10).map((name, i) => {
          const sectionNo = i + 1
          const isDone = isSubmitted || sectionNo <= pageNo
          const isCurrent = !isSubmitted && sectionNo === pageNo + 1
          return (
            <div key={i} className="flex items-center gap-2.5">
              <span
                className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center"
                style={{
                  background: isDone ? 'var(--g3)' : isCurrent ? 'rgba(29,119,51,0.08)' : 'var(--bd)',
                  border: isCurrent ? '1.5px solid var(--g1)' : 'none',
                }}
                aria-hidden="true"
              >
                {isDone ? (
                  <CheckCircle2 size={9} color="var(--g1)" strokeWidth={2.5} />
                ) : isCurrent ? (
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--g1)' }} />
                ) : null}
              </span>
              <span
                className="font-body text-[12px] flex-1 truncate"
                style={{
                  color: isDone ? 'var(--f1)' : isCurrent ? 'var(--g1)' : 'var(--f3)',
                  fontWeight: isCurrent ? 600 : isDone ? 500 : 400,
                }}
              >
                {sectionNo}. {name}
              </span>
              {isCurrent && (
                <ChevronRight
                  size={12}
                  color="var(--g1)"
                  strokeWidth={2.5}
                  className="flex-shrink-0"
                  aria-hidden="true"
                />
              )}
            </div>
          )
        })}

        {/* Remaining count */}
        <p className="font-body text-[11px] pt-1 pl-[26px]" style={{ color: 'var(--f4)' }}>
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
    {
      label: 'Total Users',
      value: stats.total,
      Icon: Users,
      iconColor: '#3d4a52',
      iconBg: '#f1f5f9',
      valueColor: '#3d4a52',
    },
    {
      label: 'Submitted',
      value: stats.submitted,
      Icon: CheckCircle2,
      iconColor: '#1d7733',
      iconBg: '#e8f5ec',
      valueColor: '#1d7733',
    },
    {
      label: 'In Progress',
      value: stats.inProgress,
      Icon: Clock3,
      iconColor: '#d97706',
      iconBg: '#fffbeb',
      valueColor: '#d97706',
    },
    {
      label: 'Not Started',
      value: stats.notStarted,
      Icon: CircleDashed,
      iconColor: '#94a3b8',
      iconBg: '#f8fafc',
      valueColor: '#94a3b8',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {cards.map((card) => {
        const { Icon } = card
        return (
          <div
            key={card.label}
            className="bg-white rounded-xl p-4 flex flex-col gap-3"
            style={{ border: '1px solid var(--bd)', boxShadow: 'var(--shadow-sm)' }}
          >
            <div className="flex items-center justify-between">
              <span
                className="font-display text-[28px] font-bold tabular-nums leading-none"
                style={{ color: card.valueColor }}
              >
                {card.value}
              </span>
              <span
                className="flex items-center justify-center rounded-lg flex-shrink-0"
                style={{ width: 32, height: 32, background: card.iconBg }}
              >
                <Icon size={15} color={card.iconColor} strokeWidth={2} />
              </span>
            </div>
            <span className="font-body text-[11px] font-medium" style={{ color: 'var(--f3)' }}>
              {card.label}
            </span>
          </div>
        )
      })}
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
        <ProgressTracker pageNo={pageNo} status={status} />
      </div>

      {/* Admin note */}
      {isAdmin() && (
        <p className="mt-5 font-body text-[12px] text-[#7a8a96] bg-[#f7f9f7] border border-[#e2ebe4] rounded-lg px-4 py-2.5">
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
