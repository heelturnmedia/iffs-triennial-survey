// Shown after login — reads from uiStore.welcomeOverlayOpen
// Dark overlay + centered card
// Card top (dark): "IFFS Triennial Survey" label + "Welcome, [LastName]"
// Card body:
//   - Description text (shows resume hint if draft in progress: "Section N of 20 saved on [date]")
//   - "Begin Survey →" green button → openModal(), setWelcomeOverlayOpen(false)
//   - "Go to Dashboard" ghost button → setWelcomeOverlayOpen(false)

import { CornerDownLeft, ArrowRight } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { useSurveyStore } from '@/stores/surveyStore'
import { formatSavedAt } from '@/utils/formatDate'

export function WelcomeOverlay() {
  const { profile } = useAuthStore()
  const { welcomeOverlayOpen, setWelcomeOverlayOpen } = useUIStore()
  const { submission, openModal } = useSurveyStore()

  if (!welcomeOverlayOpen) return null

  // Determine draft state
  const hasDraft =
    submission?.status === 'draft' &&
    submission?.page_no != null &&
    submission.page_no > 0

  const lastName  = profile?.last_name ?? ''
  const greeting  = lastName ? lastName : (profile?.first_name ?? 'there')
  const sectionNo = (submission?.page_no ?? 0) + 1
  const savedOn   = submission?.saved_at ? formatSavedAt(submission.saved_at) : ''

  const handleBeginSurvey = () => {
    openModal()
    setWelcomeOverlayOpen(false)
  }

  const handleDashboard = () => {
    setWelcomeOverlayOpen(false)
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 9500 }}
      aria-modal="true"
      role="dialog"
      aria-labelledby="welcome-title"
    >
      {/* ── Dark overlay ──────────────────────────────────────── */}
      <div
        className="absolute inset-0"
        style={{
          background: 'rgba(0,0,0,0.72)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
        onClick={handleDashboard}
        aria-hidden="true"
      />

      {/* ── Card ──────────────────────────────────────────────── */}
      <div
        className="relative z-10 w-full max-w-lg rounded-2xl overflow-hidden"
        style={{
          background: '#fff',
          border: '1px solid var(--bd)',
          boxShadow: 'var(--shadow-lg)',
          animation: 'fadeSlideUp 0.4s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Top green accent bar */}
        <div
          className="h-1.5 w-full"
          style={{
            background: 'linear-gradient(90deg, var(--g1) 0%, var(--g5) 100%)',
          }}
        />

        {/* Card body */}
        <div className="px-8 py-8">
          {/* Logo + label row */}
          <div className="flex items-center gap-3 mb-6">
            <img
              src="/iffs-logo.png"
              alt="IFFS"
              className="w-10 h-10 object-contain flex-shrink-0"
            />
            <div>
              <div
                className="uppercase"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                  color: 'var(--f3)',
                }}
              >
                2026 Triennial Survey
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 11,
                  color: 'var(--f4)',
                  marginTop: 1,
                }}
              >
                Assisted Reproductive Technology
              </div>
            </div>
          </div>

          {/* Welcome heading */}
          <h1
            id="welcome-title"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 28,
              fontWeight: 300,
              color: 'var(--f1)',
              marginBottom: 8,
              lineHeight: 1.25,
            }}
          >
            Welcome,{' '}
            <span style={{ fontWeight: 700, color: 'var(--g1)' }}>{greeting}</span>
          </h1>

          {/* Description */}
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14.5,
              color: 'var(--f2)',
              lineHeight: 1.65,
              marginBottom: 12,
            }}
          >
            You are about to complete the IFFS 2026 Triennial Survey on Assisted
            Reproductive Technology. The survey covers 20 sections and takes
            approximately 30–45 minutes.
          </p>

          {/* Draft-in-progress hint */}
          {hasDraft && (
            <div
              className="flex items-start gap-3 rounded-lg px-4 py-3 mb-4"
              style={{
                background: 'var(--g3)',
                border: '1px solid var(--bd2)',
              }}
            >
              <span
                style={{ color: 'var(--g1)', marginTop: 1, flexShrink: 0 }}
                aria-hidden="true"
              >
                <CornerDownLeft size={15} strokeWidth={2} />
              </span>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 13,
                  color: 'var(--g2)',
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                You have a draft in progress — Section{' '}
                <strong>{sectionNo} of 20</strong>
                {savedOn ? ` saved ${savedOn}` : ''}.{' '}
                Clicking &ldquo;Begin Survey&rdquo; will resume where you left off.
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-6">
            {/* Primary */}
            <button
              type="button"
              onClick={handleBeginSurvey}
              className="flex-1 flex items-center justify-center gap-2 rounded-full uppercase transition-all"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.14em',
                paddingTop: 14,
                paddingBottom: 14,
                background: 'var(--g1)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(29,119,51,0.28)',
              }}
              onMouseOver={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--g2)'
              }}
              onMouseOut={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--g1)'
              }}
            >
              {hasDraft ? 'Resume Survey' : 'Begin Survey'}
              <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
            </button>

            {/* Ghost */}
            <button
              type="button"
              onClick={handleDashboard}
              className="flex-1 rounded-full uppercase border transition-all"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.12em',
                paddingTop: 14,
                paddingBottom: 14,
                borderWidth: '1.5px',
                borderColor: 'var(--bd2)',
                color: 'var(--f2)',
                background: 'transparent',
                cursor: 'pointer',
              }}
              onMouseOver={e => {
                const btn = e.currentTarget as HTMLButtonElement
                btn.style.borderColor = 'var(--g1)'
                btn.style.color       = 'var(--g1)'
                btn.style.background  = 'var(--g3)'
              }}
              onMouseOut={e => {
                const btn = e.currentTarget as HTMLButtonElement
                btn.style.borderColor = 'var(--bd2)'
                btn.style.color       = 'var(--f2)'
                btn.style.background  = 'transparent'
              }}
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
