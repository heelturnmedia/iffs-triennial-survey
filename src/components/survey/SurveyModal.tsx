import { useEffect, useRef, useState } from 'react'
import { Model } from 'survey-core'
import { Survey } from 'survey-react-ui'
import 'survey-core/survey-core.min.css'
import { useSurveyStore } from '@/stores/surveyStore'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { upsertSubmission, submitSurvey } from '@/services/surveyService'
import { persistSurvey } from '@/lib/localStorage'
import { SURVEY_DEFINITION } from '@/data/survey-definition'
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
    })

    // Restore saved state
    if (submission?.page_no && submission.page_no > 0 && submission.page_no < model.pageCount) {
      model.currentPageNo = submission.page_no
    }
    if (submission?.data && Object.keys(submission.data).length > 0) {
      model.data = submission.data
    }

    setCurrentPage(model.currentPageNo)
    setTotalPages(model.pageCount)

    // ── Auto-save on value changed (debounced 800 ms) ──────────────────────
    model.onValueChanged.add((sender) => {
      if (!user) return
      clearTimeout(autoSaveTimerRef.current)
      setAutoSaveStatus('saving')
      autoSaveTimerRef.current = setTimeout(async () => {
        try {
          const now  = new Date().toISOString()
          const data = { ...sender.data }
          updateSubmissionData(sender.currentPageNo, data, now)
          persistSurvey(user.email!, {
            status: 'draft',
            page_no: sender.currentPageNo,
            data,
            saved_at: now,
          })
          if (submission?.id) {
            await upsertSubmission(user.id, {
              page_no: sender.currentPageNo,
              data,
              saved_at: now,
              status: 'draft',
            })
          }
          setAutoSaveStatus('saved')
          setLastSavedAt(now)
        } catch {
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
        try {
          const now  = new Date().toISOString()
          const data = { ...sender.data }
          updateSubmissionData(pageNo, data, now)
          persistSurvey(user.email!, {
            status: 'draft',
            page_no: pageNo,
            data,
            saved_at: now,
          })
          if (submission?.id) {
            await upsertSubmission(user.id, {
              page_no: pageNo,
              data,
              saved_at: now,
              status: 'draft',
            })
          }
          setAutoSaveStatus('saved')
          setLastSavedAt(now)
        } catch { /* fail silently */ }
      }
    })

    // ── On complete — confirm then submit ──────────────────────────────────
    model.onComplete.add(() => {
      openConfirmModal({
        title:   'Submit Survey',
        message: 'Are you sure you want to submit your survey? This action cannot be undone. You will not be able to make further changes after submission.',
        variant: 'warning',
        onConfirm: async () => {
          try {
            if (submission?.id) await submitSurvey(submission.id)
            toast('Survey submitted successfully! Thank you.', 'ok')
            closeModal()
          } catch {
            toast('Submission failed. Please try again.', 'err')
          }
        },
      })
    })

    setSurveyModel(model)

    return () => {
      clearTimeout(autoSaveTimerRef.current)
    }
  }, [isModalOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isModalOpen) return null

  // ── Save progress and close ─────────────────────────────────────────────
  const handleClose = async () => {
    if (surveyModel && user && submission?.id) {
      try {
        const now  = new Date().toISOString()
        const data = { ...surveyModel.data }
        updateSubmissionData(surveyModel.currentPageNo, data, now)
        persistSurvey(user.email!, {
          status: 'draft',
          page_no: surveyModel.currentPageNo,
          data,
          saved_at: now,
        })
        await upsertSubmission(user.id, {
          page_no: surveyModel.currentPageNo,
          data,
          saved_at: now,
          status: 'draft',
        })
      } catch { /* fail silently */ }
    }
    closeModal()
    toast('Progress saved.', 'ok')
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
            <div
              className="w-8 h-8 flex items-center justify-center text-white"
              style={{
                background: 'var(--g1)',
                fontFamily: 'var(--font-display)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
              }}
              aria-hidden="true"
            >
              IFFS
            </div>
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
                2026 Triennial Survey
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

          {/* Right: user name + close button */}
          <div className="flex items-center gap-4">
            <span
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
