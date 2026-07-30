import { useEffect, useRef, useState } from 'react'
import { Model } from 'survey-core'
import { Survey } from 'survey-react-ui'
import 'survey-core/survey-core.min.css'
import { useSurveyStore } from '@/stores/surveyStore'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { upsertSubmission, submitSurvey } from '@/services/surveyService'
import { logActivity } from '@/services/auditService'
import { persistSurvey, loadPersistedSurvey, clearPersistedSurvey } from '@/lib/localStorage'
import { createActiveTimeTracker, type ActiveTimeTracker } from '@/utils/activeTimeTracker'
import { SURVEY_DEFINITION } from '@/data/survey-definition'
import { COUNTRY_CHOICES } from '@/data/countries'
import { SECTION_NAMES } from '@/constants'
import type { SubmissionRow } from '@/types'
import { SurveyTimeline } from './SurveyTimeline'
import { SurveySectionHeader } from './SurveySectionHeader'
import { formatSavedAt } from '@/utils/formatDate'

export function SurveyModal() {
  const {
    isModalOpen,
    closeModal,
    submission,
    updateSubmissionData,
    setAutoSaveStatus,
    setLastSavedAt,
    autoSaveStatus,
    lastSavedAt,
    activeDefinition,
  } = useSurveyStore()
  const { user, profile } = useAuthStore()
  const { toast, openConfirmModal } = useUIStore()

  const [surveyModel, setSurveyModel]   = useState<Model | null>(null)
  const [currentPage, setCurrentPage]   = useState(0)
  const [totalPages, setTotalPages]     = useState(20)

  const contentAreaRef    = useRef<HTMLDivElement>(null)
  const autoSaveTimerRef  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const saveWatchdogRef   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const activeTrackerRef  = useRef<ActiveTimeTracker | null>(null)

  // Build SurveyJS model when modal opens
  useEffect(() => {
    if (!isModalOpen) {
      setSurveyModel(null)
      setCurrentPage(0)
      return
    }

    const def   = activeDefinition?.definition ?? SURVEY_DEFINITION
    const model = new Model({
      ...def,
      showProgressBar:             'off',
      showQuestionNumbers:         'on',
      checkErrorsMode:             'onNextPage',
      clearInvisibleValues:        'onHidden',
      textUpdateMode:              'onBlur',
      focusFirstQuestionAutomatic: false,
      firstPageIsStartPage:        false,
      // Pre-submission review: on the last page the primary button becomes
      // "Review answers", which shows every response grouped by section (with
      // inline Edit) before the final "Submit Survey" button fires onCompleting.
      showPreviewBeforeComplete:   true,
      previewMode:                 'allQuestions',
      previewText:                 'Review answers',
      completeText:                'Submit Survey',
    })

    // Patch the Country question to use inline choices. The DB-stored
    // definition may still have choicesByUrl pointing at a third-party
    // API that returns 503. Override it with the embedded list.
    const countryQ = model.getQuestionByName('Country')
    if (countryQ) {
      countryQ.choicesByUrl.clear()
      countryQ.choices = COUNTRY_CHOICES
    }

    // Restore saved state
    if (submission?.page_no && submission.page_no > 0 && submission.page_no < model.pageCount) {
      model.currentPageNo = submission.page_no
    }
    if (submission?.data && Object.keys(submission.data).length > 0) {
      model.data = submission.data
    }

    // Prefill known facts from the user's profile — never survey opinions.
    // Only when the respondent hasn't answered yet (a deliberate choice is
    // never overwritten). Uses the profile country when it exactly matches a
    // survey option (WA-sourced profiles may use different spellings);
    // otherwise defaults to United States per IFFS's request. Runs before
    // onValueChanged is attached, so the prefill alone never triggers an
    // autosave. The field stays fully editable on page 1.
    if (countryQ && countryQ.isEmpty()) {
      const profileCountry =
        profile?.country && (COUNTRY_CHOICES as readonly string[]).includes(profile.country)
          ? profile.country
          : 'United States'
      countryQ.value = profileCountry
    }

    setCurrentPage(model.currentPageNo)
    setTotalPages(model.pageCount)

    // ── Active-time tracker ────────────────────────────────────────────────
    // Resume from the highest known total (DB row or a possibly-newer local
    // draft), then accumulate this session's focused, non-idle time.
    const persistedDraft = user?.email ? loadPersistedSurvey(user.email) : null
    const baseSeconds = Math.max(
      useSurveyStore.getState().submission?.active_seconds ?? 0,
      persistedDraft?.active_seconds ?? 0,
    )
    const tracker = createActiveTimeTracker(baseSeconds)
    activeTrackerRef.current = tracker

    // ── Auto-save on value changed (debounced 800 ms) ──────────────────────
    // FIX: do NOT set status to 'saving' immediately on input — the debounce
    // hasn't fired yet, nothing is being saved. The indicator was lying to
    // users, making the app feel sluggish on every single click.
    // Status only changes to 'saving' when the actual DB write starts.
    model.onValueChanged.add((sender) => {
      if (!user) return
      // App-level guard: never overwrite a terminal status with 'draft'.
      // The DB trigger is the safety net; this prevents the network call entirely.
      const currentStatus = useSurveyStore.getState().submission?.status
      if (currentStatus === 'submitted' || currentStatus === 'reviewed') return
      clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = setTimeout(async () => {
        try {
          const now  = new Date().toISOString()
          const data = { ...sender.data }
          const activeSeconds = tracker.totalSeconds()
          // Write to localStorage first (sync, instant) — DB is the secondary backup
          updateSubmissionData(sender.currentPageNo, data, now)
          persistSurvey(user.email!, {
            status: 'draft',
            page_no: sender.currentPageNo,
            data,
            saved_at: now,
            active_seconds: activeSeconds,
          })
          // Only NOW show 'saving' — the actual network write is about to start
          setAutoSaveStatus('saving')
          // Watchdog: if the DB write hangs for >6 s, stop showing the spinner.
          // localStorage already has the data; the DB write will eventually complete.
          clearTimeout(saveWatchdogRef.current)
          saveWatchdogRef.current = setTimeout(() => {
            if (useSurveyStore.getState().autoSaveStatus === 'saving') {
              setAutoSaveStatus('saved')
            }
          }, 6_000)
          const saved = await upsertSubmission(user.id, {
            page_no: sender.currentPageNo,
            data,
            saved_at: now,
            status: 'draft',
            active_seconds: activeSeconds,
          })
          clearTimeout(saveWatchdogRef.current)
          if (!useSurveyStore.getState().submission?.id) {
            useSurveyStore.getState().setSubmission(saved)
          }
          setAutoSaveStatus('saved')
          setLastSavedAt(now)
        } catch {
          clearTimeout(saveWatchdogRef.current)
          setAutoSaveStatus('error')
        }
      }, 800)
    })

    // ── Save + scroll on page change ───────────────────────────────────────
    model.onCurrentPageChanged.add(async (sender) => {
      const pageNo = sender.currentPageNo
      setCurrentPage(pageNo)
      if (contentAreaRef.current) contentAreaRef.current.scrollTop = 0

      if (user) {
        // App-level guard: never overwrite a terminal status with 'draft'.
        const currentStatus = useSurveyStore.getState().submission?.status
        if (currentStatus === 'submitted' || currentStatus === 'reviewed') return
        try {
          const now  = new Date().toISOString()
          const data = { ...sender.data }
          const activeSeconds = tracker.totalSeconds()
          updateSubmissionData(pageNo, data, now)
          persistSurvey(user.email!, {
            status: 'draft',
            page_no: pageNo,
            data,
            saved_at: now,
            active_seconds: activeSeconds,
          })
          const saved = await upsertSubmission(user.id, {
            page_no: pageNo,
            data,
            saved_at: now,
            status: 'draft',
            active_seconds: activeSeconds,
          })
          if (!useSurveyStore.getState().submission?.id) {
            useSurveyStore.getState().setSubmission(saved)
          }
          setAutoSaveStatus('saved')
          setLastSavedAt(now)
        } catch { /* fail silently */ }
      }
    })

    // ── On completing — intercept BEFORE SurveyJS renders the thank-you page ──
    // FIX: onComplete fires after SurveyJS has already transitioned to the
    // completion state, so pressing Cancel on our confirm dialog revealed the
    // built-in thank-you screen underneath. onCompleting fires before that
    // transition; setting options.allowComplete = false keeps the user on the
    // last question page while our confirm dialog is open.
    // FIX 2: Added safety upsert so submission.id is always set before calling
    // submitSurvey — prevents the silent no-op when autosave hadn't resolved.
    model.onCompleting.add((sender, options) => {
      // Block SurveyJS from rendering the completion/thank-you page immediately.
      options.allowComplete = false

      openConfirmModal({
        title:   'Submit Survey',
        message: 'Are you sure you want to submit your survey? This action cannot be undone. You will not be able to make further changes after submission.',
        variant: 'warning',
        onConfirm: async () => {
          try {
            console.log('[Survey] onConfirm started — user:', user?.id, 'submissionId:', useSurveyStore.getState().submission?.id)

            // Safety net: if autosave hasn't yet resolved an ID (e.g. the user
            // moved through pages very quickly), upsert a row first so we have
            // an ID to pass to submitSurvey.
            let submissionId = useSurveyStore.getState().submission?.id
            if (!submissionId && user) {
              console.log('[Survey] No submission ID — running safety-net upsert')
              const now  = new Date().toISOString()
              const data = { ...sender.data }
              const saved = await upsertSubmission(user.id, {
                page_no: sender.currentPageNo,
                data,
                saved_at: now,
                status: 'draft',
                active_seconds: tracker.totalSeconds(),
              })
              useSurveyStore.getState().setSubmission(saved)
              submissionId = saved.id
              console.log('[Survey] Safety-net upsert complete — id:', submissionId)
            }

            if (submissionId) {
              console.log('[Survey] Calling submitSurvey — id:', submissionId)
              const updated = await submitSurvey(submissionId, tracker.totalSeconds())
              console.log('[Survey] submitSurvey success — status:', updated.status)
              void logActivity('survey_submitted', { reference: updated.reference_no })
              // Update the store so Overview immediately reflects submitted status
              useSurveyStore.getState().setSubmission(updated)
              // Clear localStorage draft so re-login merge cannot restore draft
              // data on top of the now-submitted row.
              if (user?.email) clearPersistedSurvey(user.email)
            } else {
              console.warn('[Survey] No submissionId — skipped submitSurvey (user may not be authenticated)')
            }
            closeModal()
          } catch (err) {
            console.error('[Survey] Submit failed:', err)
            toast('Submission failed. Please try again.', 'err')
          }
        },
      })
    })

    setSurveyModel(model)

    return () => {
      clearTimeout(autoSaveTimerRef.current)
      clearTimeout(saveWatchdogRef.current)
      activeTrackerRef.current?.stop()
      activeTrackerRef.current = null
    }
  }, [isModalOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isModalOpen) return null

  // ── Save progress and close ─────────────────────────────────────────────
  // FIX: was async and awaited upsertSubmission — if the DB was slow the X
  // button was frozen until the request timed out. Users were trapped.
  // Now: cancel any pending debounce, write to localStorage synchronously
  // (instant), fire the DB write as fire-and-forget, close immediately.
  // localStorage is the source of truth on next open anyway.
  const handleClose = () => {
    clearTimeout(autoSaveTimerRef.current)
    clearTimeout(saveWatchdogRef.current)

    if (surveyModel && user) {
      const now  = new Date().toISOString()
      const data = { ...surveyModel.data }
      const activeSeconds = activeTrackerRef.current?.totalSeconds()
      // Synchronous — instant, no network needed
      updateSubmissionData(surveyModel.currentPageNo, data, now)
      persistSurvey(user.email!, {
        status: 'draft',
        page_no: surveyModel.currentPageNo,
        data,
        saved_at: now,
        active_seconds: activeSeconds,
      })
      // Fire-and-forget — don't block close on DB latency
      upsertSubmission(user.id, {
        page_no: surveyModel.currentPageNo,
        data,
        saved_at: now,
        status: 'draft',
        ...(activeSeconds != null ? { active_seconds: activeSeconds } : {}),
      }).catch(() => { /* localStorage already has it */ })
    }

    closeModal()
    toast('Progress saved.', 'ok')
  }

  // ── Download / Print the response as a branded PDF ────────────────────────
  // Reuses the same per-respondent exporter admins use, so a respondent can
  // review the whole survey, print it, or share it with local experts before
  // final submission. jsPDF is lazy-imported on click to stay out of the bundle.
  const definitionPages =
    ((activeDefinition?.definition ?? SURVEY_DEFINITION) as Record<string, unknown>)['pages'] as unknown[] ?? []

  const hasAnswers = !!surveyModel && Object.keys(surveyModel.data ?? {}).length > 0

  const buildResponseRow = (): SubmissionRow => ({
    id:           submission?.id,
    user_id:      user?.id ?? '',
    status:       submission?.status ?? 'draft',
    page_no:      surveyModel?.currentPageNo ?? 0,
    data:         surveyModel?.data ?? {},
    saved_at:     submission?.saved_at ?? null,
    submitted_at: submission?.submitted_at ?? null,
    reference_no: submission?.reference_no ?? null,
    first_name:   profile?.first_name,
    last_name:    profile?.last_name,
    email:        profile?.email,
    institution:  profile?.institution,
    country:      profile?.country,
    profile:      profile ?? undefined,
  })

  const handleDownloadPdf = async () => {
    if (!hasAnswers) return
    try {
      const { exportIndividualPdf } = await import('@/utils/exportIndividualPdf')
      exportIndividualPdf(buildResponseRow(), definitionPages, SECTION_NAMES)
      void logActivity('export_response', { format: 'pdf', self: true, reference: submission?.reference_no ?? null })
    } catch {
      toast('Could not generate the PDF. Please try again.', 'err')
    }
  }

  const handlePrintPdf = async () => {
    if (!hasAnswers) return
    // Open the tab inside the click gesture (before the await) so it isn't
    // blocked as a popup; point it at the PDF once the doc is built.
    const printWin = window.open('', '_blank')
    try {
      const { buildIndividualPdfDoc } = await import('@/utils/exportIndividualPdf')
      const doc = buildIndividualPdfDoc(buildResponseRow(), definitionPages, SECTION_NAMES)
      doc.autoPrint()
      const url = String(doc.output('bloburl'))
      if (printWin) printWin.location.href = url
      else window.open(url, '_blank')
      void logActivity('export_response', { format: 'print', self: true, reference: submission?.reference_no ?? null })
    } catch {
      printWin?.close()
      toast('Could not open the print view. Please try again.', 'err')
    }
  }

  const saveStatusText =
    autoSaveStatus === 'saving'                     ? '⏳ Saving…' :
    autoSaveStatus === 'saved' && lastSavedAt       ? `✓ Saved ${formatSavedAt(lastSavedAt)}` :
    autoSaveStatus === 'error'                      ? '⚠ Save failed — check connection' :
    'Progress auto-saved'

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-stretch justify-center"
      style={{ animation: 'modalSlideIn 0.38s cubic-bezier(0.16,1,0.3,1)' }}
    >
      <style>{`
        #s-host .sv-header__cell img,
        #s-host .sd-logo__image,
        #s-host .sv-logo__image {
          max-width: 120px !important;
          max-height: 60px !important;
          width: auto !important;
          height: auto !important;
          object-fit: contain !important;
        }
        #s-host .sv-header .sd-title,
        #s-host .sv-header .sv-title,
        #s-host .sd-root-modern .sd-title:not(.sd-item__title):not(.sd-panel__title):not(.sd-page__title) {
          font-size: 18px !important;
          line-height: 1.3 !important;
        }
        #s-host .sv-header .sd-description,
        #s-host .sv-header .sv-description,
        #s-host .sd-root-modern__wrapper > form > div > .sd-description {
          font-size: 13px !important;
          line-height: 1.5 !important;
        }
      `}</style>
      {/* Blurred overlay */}
      <div className="absolute inset-0 bg-black/[0.72] backdrop-blur-[10px]" />

      {/* Full-screen panel */}
      <div
        className="relative z-10 w-full h-full flex flex-col"
        style={{ background: 'var(--s1)' }}
      >
        {/* ── TOP BAR ───────────────────────────────────────────────────── */}
        <div
          className="flex-shrink-0 flex items-center justify-between px-8 border-b"
          style={{ height: 62, background: '#000', borderColor: 'rgba(255,255,255,0.06)' }}
        >
          {/* Left: logo + title + save status */}
          <div className="flex items-center gap-3.5">
            <img
              src="/iffs-logo.png"
              alt="IFFS logo"
              className="w-9 h-9 rounded-full flex-shrink-0 object-contain"
              style={{ background: '#fff', padding: 2 }}
            />
            <div>
              <div
                className="uppercase"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.16em',
                  color: '#fff',
                }}
              >
                2027 Biennial Survey
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.4)',
                  marginTop: 2,
                  letterSpacing: '0.02em',
                }}
              >
                {saveStatusText}
              </div>
            </div>
          </div>

          {/* Right: export actions + user name + close button */}
          <div className="flex items-center gap-3">
            {/* Download / Print — available throughout so a respondent can review,
                print, or share their answers before final submission. */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={!hasAnswers}
              title="Download your responses as a PDF"
              aria-label="Download your responses as a PDF"
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg transition-all hover:brightness-125 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.85)',
                fontFamily: 'var(--font-display)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.04em',
              }}
            >
              <span aria-hidden="true">⬇</span>
              <span className="hidden sm:inline">Download PDF</span>
            </button>
            <button
              type="button"
              onClick={handlePrintPdf}
              disabled={!hasAnswers}
              title="Print your responses"
              aria-label="Print your responses"
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg transition-all hover:brightness-125 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.85)',
                fontFamily: 'var(--font-display)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.04em',
              }}
            >
              <span aria-hidden="true">🖨</span>
              <span className="hidden sm:inline">Print</span>
            </button>
            <span
              className="hidden md:inline"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 11,
                color: 'rgba(255,255,255,0.3)',
              }}
            >
              {profile?.first_name
                ? `${profile.first_name} ${profile.last_name ?? ''}`.trim()
                : profile?.email ?? ''}
            </span>
            <button
              type="button"
              onClick={handleClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
              }}
              onMouseOver={e => {
                const btn = e.currentTarget as HTMLButtonElement
                btn.style.background = 'rgba(255,255,255,0.14)'
                btn.style.color      = '#fff'
              }}
              onMouseOut={e => {
                const btn = e.currentTarget as HTMLButtonElement
                btn.style.background = 'rgba(255,255,255,0.07)'
                btn.style.color      = 'rgba(255,255,255,0.5)'
              }}
              title="Save & Close"
              aria-label="Save progress and close survey"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── BODY ──────────────────────────────────────────────────────── */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Timeline sidebar */}
          {surveyModel && (
            <SurveyTimeline
              survey={surveyModel}
              totalPages={totalPages}
              currentPage={currentPage}
              onPageChange={(page) => {
                if (surveyModel) surveyModel.currentPageNo = page
              }}
            />
          )}

          {/* Content area */}
          <div
            ref={contentAreaRef}
            className="flex-1 overflow-y-auto min-w-0"
            style={{ background: '#eef2ef', scrollBehavior: 'auto' }}
          >
            {/* Sticky section header */}
            {surveyModel && (
              <SurveySectionHeader
                survey={surveyModel}
                totalPages={totalPages}
                currentPage={currentPage}
              />
            )}

            {/* Survey form */}
            <div id="s-host" style={{ padding: '24px 36px 16px' }}>
              {surveyModel && <Survey model={surveyModel} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
