// Section rail. On lg+ it is a static 240px column in the modal body; below
// lg it becomes an overlay drawer (a fixed 240px column would otherwise eat
// ~64% of a 375px screen and crush the question area). The drawer is toggled
// from the survey top bar and closes on scrim tap, Escape, or section select.
//
// Each section:
//   - Vertical connector line between dots
//   - Dot (16px circle):
//     - pending: grey outline, empty
//     - active: green bg + ring glow, white inner dot
//     - done: green bg, SVG checkmark
//   - Text: zero-padded section number (small, upper) + section name
// Click on done items: calls onPageChange or survey.currentPageNo = i
// Scroll active into view on currentPage change (useEffect)

import { useEffect, useRef } from 'react'
import type { Model } from 'survey-core'
import { SURVEY_PAGES_META } from '@/data/survey-definition'
import { cn } from '@/utils/cn'

interface Props {
  survey: Model
  totalPages: number
  currentPage: number
  onPageChange?: (page: number) => void
  /** Drawer open state — mobile only; the rail is always shown on lg+. */
  open?: boolean
  onClose?: () => void
}

export function SurveyTimeline({ survey, totalPages, currentPage, onPageChange, open = false, onClose }: Props) {
  const activeItemRef = useRef<HTMLButtonElement | HTMLDivElement | null>(null)

  // Scroll active item into view when currentPage changes
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [currentPage])

  // Escape closes the mobile drawer.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const handleClick = (index: number) => {
    if (index < currentPage) {
      if (onPageChange) {
        onPageChange(index)
      } else {
        survey.currentPageNo = index
      }
      onClose?.() // collapse the drawer once a section is chosen (mobile)
    }
  }

  return (
    <>
      {/* Scrim — mobile only */}
      <div
        className={cn(
          'lg:hidden fixed inset-0 top-[62px] z-30 bg-black/50 transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={cn(
          'bg-black overflow-y-auto min-h-0 shrink-0',
          // Below lg: overlay drawer beneath the 62px top bar.
          'fixed top-[62px] bottom-0 left-0 z-40 w-[264px] max-w-[82vw]',
          'transition-transform duration-250 ease-out',
          open ? 'translate-x-0' : '-translate-x-full',
          // lg+: back to a static column in the flex row.
          'lg:static lg:inset-auto lg:z-auto lg:w-60 lg:max-w-none lg:translate-x-0 lg:transition-none',
        )}
        aria-label="Survey sections"
      >
        <div className="px-5 py-6">
          {/* Header row — label, plus a Done button on mobile */}
          <div className="flex items-center justify-between mb-5">
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.28)',
              }}
            >
              Survey Sections
            </div>
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden shrink-0 w-8 h-8 -mr-1 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close sections list"
            >
              ✕
            </button>
          </div>

        {/* Section items */}
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {Array.from({ length: totalPages }).map((_, index) => {
            const meta      = SURVEY_PAGES_META[index]
            const name      = meta?.name ?? `Section ${index + 1}`
            const isDone    = index < currentPage
            const isActive  = index === currentPage
            const isLast    = index === totalPages - 1

            const rowStyle: React.CSSProperties = {
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              position: 'relative',
              paddingBottom: isLast ? 0 : 14,
              paddingLeft: 0,
              background: 'none',
              border: 'none',
              textAlign: 'left',
              width: '100%',
              cursor: isDone ? 'pointer' : 'default',
            }

            const rowContent = (
              <>
                {/* Vertical connector line — from below this dot to next item */}
                {!isLast && (
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      left: 7,
                      top: 18,
                      bottom: -10,
                      width: 2,
                      borderRadius: 1,
                      background: isDone ? '#1d7733' : 'rgba(255,255,255,0.10)',
                    }}
                  />
                )}

                {/* Status dot */}
                <span
                  aria-hidden="true"
                  style={{
                    position: 'relative',
                    flexShrink: 0,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    marginTop: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isDone || isActive ? '#1d7733' : 'transparent',
                    border: isDone
                      ? '2px solid #1d7733'
                      : isActive
                      ? '2px solid #2a9444'
                      : '2px solid rgba(255,255,255,0.18)',
                    boxShadow: isActive ? '0 0 0 4px rgba(29,119,51,0.25)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  {isDone && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path
                        d="M1.5 4L3.5 6L6.5 2"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                  {isActive && (
                    <span
                      style={{
                        display: 'block',
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: '#fff',
                      }}
                    />
                  )}
                </span>

                {/* Section number + name */}
                <span
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: isActive
                        ? 'rgba(255,255,255,0.45)'
                        : isDone
                        ? 'rgba(255,255,255,0.30)'
                        : 'rgba(255,255,255,0.20)',
                      lineHeight: 1.2,
                      marginBottom: 2,
                    }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span
                    title={name}
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 11,
                      fontWeight: isActive ? 700 : 500,
                      color: isActive
                        ? '#ffffff'
                        : isDone
                        ? 'rgba(255,255,255,0.55)'
                        : 'rgba(255,255,255,0.28)',
                      lineHeight: 1.35,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      transition: 'color 0.2s',
                    }}
                  >
                    {name}
                  </span>
                </span>
              </>
            )

            if (isDone) {
              return (
                <li key={index}>
                  <button
                    ref={isActive ? (activeItemRef as React.RefObject<HTMLButtonElement>) : null}
                    type="button"
                    onClick={() => handleClick(index)}
                    style={rowStyle}
                    aria-label={`Go to section ${index + 1}: ${name}`}
                    title={`Go back to ${name}`}
                  >
                    {rowContent}
                  </button>
                </li>
              )
            }

            return (
              <li key={index}>
                <div
                  ref={isActive ? (activeItemRef as React.RefObject<HTMLDivElement>) : null}
                  style={rowStyle}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {rowContent}
                </div>
              </li>
            )
          })}
        </ol>
        </div>
      </aside>
    </>
  )
}
