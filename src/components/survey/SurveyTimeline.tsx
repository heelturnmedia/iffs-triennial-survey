// Left sidebar: 240px wide, black bg, overflow-y auto
// "Survey Sections" label at top
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

interface Props {
  survey: Model
  totalPages: number
  currentPage: number
  onPageChange?: (page: number) => void
}

export function SurveyTimeline({ survey, totalPages, currentPage, onPageChange }: Props) {
  const activeItemRef = useRef<HTMLButtonElement | HTMLDivElement | null>(null)

  // Scroll active item into view when currentPage changes
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [currentPage])

  const handleClick = (index: number) => {
    if (index < currentPage) {
      if (onPageChange) {
        onPageChange(index)
      } else {
        survey.currentPageNo = index
      }
    }
  }

  return (
    <aside
      style={{
        flexShrink: 0,
        width: 240,
        background: '#000',
        overflowY: 'auto',
        minHeight: 0,
      }}
    >
      <div style={{ padding: '24px 20px 24px' }}>
        {/* "Survey Sections" label */}
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.28)',
            marginBottom: 20,
          }}
        >
          Survey Sections
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
  )
}
