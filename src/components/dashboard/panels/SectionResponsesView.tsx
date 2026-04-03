// ─────────────────────────────────────────────────────────────────────────────
// SectionResponsesView — per-section aggregated survey responses for admins
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo } from 'react'
import { SECTION_NAMES, SECTION_DESCRIPTIONS } from '@/constants'
import { SURVEY_DEFINITION } from '@/data/survey-definition'
import { useSurveyStore } from '@/stores/surveyStore'
import {
  extractQuestionsFromPage,
  aggregateSection,
  sortedChoiceCounts,
  type AggregatedQuestion,
} from '@/utils/surveyAnalytics'
import type { SubmissionRow } from '@/types'

// ─── Choice bar ──────────────────────────────────────────────────────────────

function ChoiceBar({
  label,
  count,
  total,
  max,
}: {
  label: string
  count: number
  total: number
  max: number
}) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  const outOf = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="w-36 flex-shrink-0 font-body text-[12px] text-[#3d4a52] text-right leading-snug">
        {label}
      </div>
      <div className="flex-1 flex items-center gap-2">
        <div
          className="h-5 rounded-sm overflow-hidden"
          style={{ width: '100%', background: '#e8f5ec' }}
        >
          <div
            className="h-full rounded-sm transition-all"
            style={{ width: `${pct}%`, background: '#1d7733' }}
          />
        </div>
        <span
          className="w-20 flex-shrink-0 font-body text-[11px] text-[#7a8a96] tabular-nums"
          style={{ minWidth: 72 }}
        >
          {count} ({outOf}%)
        </span>
      </div>
    </div>
  )
}

// ─── Question card ────────────────────────────────────────────────────────────

function QuestionCard({
  agg,
  totalSubmitted,
}: {
  agg: AggregatedQuestion
  totalSubmitted: number
}) {
  const [showAll, setShowAll] = useState(false)
  const { question, totalAnswered, choiceCounts, textResponses, matrixCounts, multitextAnswers } =
    agg

  const TYPE_BADGE: Record<string, string> = {
    radiogroup: 'Single choice',
    dropdown: 'Dropdown',
    checkbox: 'Multi-choice',
    tagbox: 'Multi-choice',
    text: 'Text',
    comment: 'Long text',
    matrix: 'Matrix',
    matrixdropdown: 'Matrix',
    multipletext: 'Multi-field',
    boolean: 'Yes/No',
    rating: 'Rating',
    paneldynamic: 'Dynamic list',
  }

  const typeLabel = TYPE_BADGE[question.type] ?? question.type
  const noData = totalAnswered === 0

  return (
    <div
      className="bg-white rounded-xl p-5"
      style={{ border: '1px solid var(--bd)', boxShadow: 'var(--shadow-sm)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="font-body text-[13px] font-semibold text-[#0d1117] leading-snug flex-1">
          {question.title || question.name}
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className="font-body text-[10px] px-2 py-0.5 rounded-full border"
            style={{
              background: '#f0f4f1',
              color: '#5a7263',
              borderColor: '#c8d9cc',
            }}
          >
            {typeLabel}
          </span>
          <span className="font-body text-[10px] text-[#b0bec5]">
            {totalAnswered}/{totalSubmitted} responded
          </span>
        </div>
      </div>

      {noData && (
        <p className="font-body text-[12px] text-[#b0bec5] italic">No responses yet.</p>
      )}

      {/* Choice questions */}
      {choiceCounts && !noData && (() => {
        const sorted = sortedChoiceCounts(choiceCounts)
        const max = sorted[0]?.count ?? 1
        // Resolve display labels from choices/rows definition
        const labelMap: Record<string, string> = {}
        for (const c of question.choices ?? []) labelMap[c.value] = c.text
        for (const r of question.rows ?? []) labelMap[r.value] = r.text

        return (
          <div>
            {sorted.map(({ label, count }) => (
              <ChoiceBar
                key={label}
                label={labelMap[label] || label}
                count={count}
                total={totalAnswered}
                max={max}
              />
            ))}
          </div>
        )
      })()}

      {/* Text questions */}
      {textResponses && !noData && (() => {
        const displayed = showAll ? textResponses : textResponses.slice(0, 5)
        return (
          <div>
            <ul className="space-y-1.5">
              {displayed.map((r, i) => (
                <li
                  key={i}
                  className="font-body text-[12px] text-[#3d4a52] pl-3 border-l-2 border-[#c8d9cc]"
                >
                  {r}
                </li>
              ))}
            </ul>
            {textResponses.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="mt-2 font-body text-[11px] text-[#1d7733] hover:underline"
              >
                {showAll ? 'Show less' : `Show all ${textResponses.length} responses`}
              </button>
            )}
          </div>
        )
      })()}

      {/* Matrix questions */}
      {matrixCounts && !noData && (() => {
        const rowDefs = question.rows ?? []
        const colDefs = question.columns ?? []
        const rowKeys = rowDefs.length
          ? rowDefs.map((r) => r.value)
          : Object.keys(matrixCounts)
        const colKeys = colDefs.length
          ? colDefs.map((c) => c.value)
          : Array.from(
              new Set(Object.values(matrixCounts).flatMap((c) => Object.keys(c)))
            )

        if (rowKeys.length === 0) return null

        return (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" style={{ minWidth: 400 }}>
              <thead>
                <tr>
                  <th className="font-body text-[10px] text-[#7a8a96] py-1.5 pr-3 font-semibold w-40">
                    Row
                  </th>
                  {colKeys.map((ck) => {
                    const colDef = colDefs.find((c) => c.value === ck)
                    return (
                      <th
                        key={ck}
                        className="font-body text-[10px] text-[#7a8a96] py-1.5 px-2 font-semibold text-center"
                      >
                        {colDef?.text || ck}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {rowKeys.map((rk) => {
                  const rowDef = rowDefs.find((r) => r.value === rk)
                  const rowData = matrixCounts[rk] ?? {}
                  return (
                    <tr key={rk} style={{ borderTop: '1px solid #f0f4f1' }}>
                      <td className="font-body text-[11px] text-[#3d4a52] py-1.5 pr-3 leading-snug">
                        {rowDef?.text || rk}
                      </td>
                      {colKeys.map((ck) => {
                        const count = rowData[ck] ?? 0
                        return (
                          <td
                            key={ck}
                            className="font-body text-[11px] text-[#3d4a52] py-1.5 px-2 text-center tabular-nums"
                          >
                            {count > 0 ? count : '—'}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })()}

      {/* Multipletext questions */}
      {multitextAnswers && !noData && (() => {
        const items = question.items ?? []
        return (
          <div className="space-y-2">
            {items.map((item) => {
              const vals = multitextAnswers[item.name] ?? []
              return (
                <div key={item.name}>
                  <p className="font-body text-[11px] font-semibold text-[#5a7263] mb-1">
                    {item.title || item.name}
                  </p>
                  {vals.length === 0 ? (
                    <p className="font-body text-[11px] text-[#b0bec5] italic pl-3">No responses.</p>
                  ) : (
                    <ul className="space-y-1">
                      {vals.map((v, i) => (
                        <li
                          key={i}
                          className="font-body text-[11px] text-[#3d4a52] pl-3 border-l-2 border-[#c8d9cc]"
                        >
                          {v}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        )
      })()}
    </div>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function SectionResponsesView({ submissions }: { submissions: SubmissionRow[] }) {
  const { activeDefinition } = useSurveyStore()
  const [selectedSection, setSelectedSection] = useState(0)

  const definition = (activeDefinition?.definition ?? SURVEY_DEFINITION) as Record<string, unknown>
  const pages = (definition['pages'] ?? []) as unknown[]

  const totalSubmitted = submissions.filter(
    (s) => s.status === 'submitted' || s.status === 'reviewed'
  ).length

  const aggregated = useMemo(() => {
    const page = pages[selectedSection]
    if (!page) return []
    const questions = extractQuestionsFromPage(page)
    return aggregateSection(questions, submissions)
  }, [selectedSection, submissions, pages])

  if (pages.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="font-body text-[14px] text-[#b0bec5]">No survey definition loaded.</p>
      </div>
    )
  }

  const sectionName = SECTION_NAMES[selectedSection] ?? `Section ${selectedSection + 1}`
  const sectionDesc = SECTION_DESCRIPTIONS[selectedSection] ?? ''

  return (
    <div>
      {/* Section selector */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="font-body text-[11px] text-[#7a8a96] font-medium flex-shrink-0">
            Section
          </span>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(Number(e.target.value))}
            className="font-body text-[12px] font-medium text-[#3d4a52] border border-[#e2ebe4] rounded-lg px-3 py-1.5 bg-white hover:border-[#1d7733] focus:outline-none focus:border-[#1d7733] transition-colors cursor-pointer"
            aria-label="Select section"
          >
            {SECTION_NAMES.map((name, i) => (
              <option key={i} value={i}>
                {i + 1}. {name}
              </option>
            ))}
          </select>
        </div>
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ background: '#e8f5ec', border: '1px solid #c8d9cc' }}
        >
          <span className="font-body text-[11px] text-[#1d7733] font-semibold">
            {totalSubmitted} submitted survey{totalSubmitted !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Section description */}
      <div
        className="rounded-xl p-4 mb-6"
        style={{ background: '#f7f9f7', border: '1px solid var(--bd)' }}
      >
        <p className="font-display text-[13px] font-bold text-[#0d1117] mb-1">
          {selectedSection + 1}. {sectionName}
        </p>
        {sectionDesc && (
          <p className="font-body text-[12px] text-[#7a8a96] leading-relaxed">{sectionDesc}</p>
        )}
        <p className="font-body text-[11px] text-[#b0bec5] mt-2">
          {aggregated.length} question{aggregated.length !== 1 ? 's' : ''} in this section
        </p>
      </div>

      {/* Question cards */}
      {aggregated.length === 0 ? (
        <div className="py-10 text-center">
          <p className="font-body text-[13px] text-[#b0bec5]">No questions found in this section.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {aggregated.map((agg) => (
            <QuestionCard key={agg.question.name} agg={agg} totalSubmitted={totalSubmitted} />
          ))}
        </div>
      )}
    </div>
  )
}
