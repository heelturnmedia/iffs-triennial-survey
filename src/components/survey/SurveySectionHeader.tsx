// Sticky white header above survey form
// Content:
//   - Eyebrow: green line + "Section X of Y"
//   - Title: page title (large, font-display, weight 700)
//   - Description: page description
//   - Right side: question count badge + mini progress bar + autosave status

import { useMemo } from 'react'
import type { Model } from 'survey-core'
import { SURVEY_PAGES_META } from '@/data/survey-definition'
import { useSurveyStore } from '@/stores/surveyStore'
import { formatSavedAt } from '@/utils/formatDate'

interface Props {
  survey: Model
  totalPages: number
  currentPage: number
}

export function SurveySectionHeader({ survey, totalPages, currentPage }: Props) {
  const { autoSaveStatus, lastSavedAt } = useSurveyStore()

  const meta        = SURVEY_PAGES_META[currentPage]
  const title       = meta?.name ?? survey.currentPage?.title ?? `Section ${currentPage + 1}`
  const description = meta?.description ?? survey.currentPage?.description ?? ''

  const questionCount = useMemo(() => {
    const page = survey.pages[currentPage]
    if (!page) return 0
    return page.questions.filter(q => q.isVisible).length
  }, [survey, currentPage])

  // Progress: fraction of sections already completed
  const progressPct = totalPages > 0 ? (currentPage / totalPages) * 100 : 0

  const saveIndicator = useMemo(() => {
    if (autoSaveStatus === 'saving') return { text: 'Saving…', color: '#f59e0b' }
    if (autoSaveStatus === 'saved' && lastSavedAt)
      return { text: `Saved ${formatSavedAt(lastSavedAt)}`, color: '#1d7733' }
    if (autoSaveStatus === 'error') return { text: 'Save failed', color: '#dc2626' }
    return null
  }, [autoSaveStatus, lastSavedAt])

  return (
    <div
      className="sticky top-0 z-10 bg-white border-b"
      style={{
        borderColor: 'var(--bd)',
        padding: '24px 36px 20px',
        boxShadow: '0 2px 8px rgba(13,17,23,0.05)',
      }}
    >
      {/* Mini progress bar — bottom edge of header */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: 3, background: 'var(--bd)' }}
        role="progressbar"
        aria-valuenow={currentPage + 1}
        aria-valuemin={1}
        aria-valuemax={totalPages}
      >
        <div
          style={{
            height: '100%',
            width: `${progressPct}%`,
            background: 'linear-gradient(90deg, #1d7733 0%, #2a9444 100%)',
            transition: 'width 0.5s ease',
          }}
        />
      </div>

      <div className="flex items-start justify-between gap-4">
        {/* Left: eyebrow → title → description */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Eyebrow */}
          <div className="flex items-center gap-2.5" style={{ marginBottom: 8 }}>
            <span
              style={{
                display: 'block',
                width: 16,
                height: 2,
                borderRadius: 2,
                background: '#1d7733',
                flexShrink: 0,
              }}
            />
            <span
              className="uppercase"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.20em',
                color: '#1d7733',
              }}
            >
              Section {currentPage + 1} of {totalPages}
            </span>
          </div>

          {/* Title */}
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 21,
              fontWeight: 700,
              color: 'var(--f1)',
              lineHeight: 1.25,
              marginBottom: 6,
            }}
          >
            {title}
          </h2>

          {/* Description */}
          {description && (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                color: 'var(--f3)',
                lineHeight: 1.6,
                maxWidth: 640,
                margin: 0,
              }}
            >
              {description}
            </p>
          )}
        </div>

        {/* Right: question count badge + autosave status */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {/* Question count badge */}
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 border"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 11,
              fontWeight: 600,
              background: 'var(--g3)',
              color: 'var(--g2)',
              borderColor: 'var(--bd2)',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <circle cx="5" cy="5" r="4" stroke="#1d7733" strokeWidth="1.2" />
              <path d="M5 3v2.5l1.5 1" stroke="#1d7733" strokeWidth="1" strokeLinecap="round" />
            </svg>
            {questionCount} question{questionCount !== 1 ? 's' : ''}
          </span>

          {/* Auto-save indicator */}
          {saveIndicator && (
            <span
              className="flex items-center gap-1.5"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 11,
                color: saveIndicator.color,
              }}
            >
              {autoSaveStatus === 'saving' && (
                <span
                  className="inline-block rounded-full border-2 border-current border-t-transparent animate-spin"
                  style={{ width: 12, height: 12 }}
                />
              )}
              {autoSaveStatus === 'saved' && <span aria-hidden="true">✓</span>}
              {autoSaveStatus === 'error' && <span aria-hidden="true">⚠</span>}
              {saveIndicator.text}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
