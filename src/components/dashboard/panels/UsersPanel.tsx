import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { listProfiles, updateUserRole } from '@/services/authService'
import { getSubmissions, resetSubmission, resetAllSubmissions } from '@/services/surveyService'
import { supabase } from '@/lib/supabase'
import { formatSavedAt } from '@/utils/formatDate'
import { ROLES, STATUS_LABELS, SECTION_NAMES } from '@/constants'
import { SURVEY_DEFINITION } from '@/data/survey-definition'
import { extractQuestionsFromPage } from '@/utils/surveyAnalytics'
import { useSurveyStore } from '@/stores/surveyStore'
import type { Profile, SubmissionRow, UserRole, SurveyStatus } from '@/types'
import type { ExtractedQuestion } from '@/utils/surveyAnalytics'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserRow {
  profile: Profile
  submission?: SubmissionRow
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_OPTIONS = Object.values(ROLES)

const ROLE_BADGE_COLORS: Record<UserRole, string> = {
  admin:         'bg-purple-100 text-purple-800 border-purple-200',
  supervisor:    'bg-blue-100 text-blue-800 border-blue-200',
  'iffs-member': 'bg-[#e8f5ec] text-[#0e5921] border-[#afc7b4]',
  user:          'bg-gray-100 text-gray-600 border-gray-200',
}

const STATUS_CHIP_STYLES: Record<SurveyStatus, string> = {
  draft:     'bg-amber-50 text-amber-700 border-amber-200',
  submitted: 'bg-[#e8f5ec] text-[#0e5921] border-[#afc7b4]',
  reviewed:  'bg-blue-50 text-blue-700 border-blue-200',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcProgress(pageNo: number): number {
  return Math.round((Math.max(0, pageNo) / 20) * 100)
}

function getInitials(profile: Profile): string {
  return (
    `${profile.first_name?.[0] ?? ''}${profile.last_name?.[0] ?? ''}`.toUpperCase() || '?'
  )
}

// ─── Answer formatter ─────────────────────────────────────────────────────────

function formatAnswer(q: ExtractedQuestion, value: unknown): string {
  if (value === undefined || value === null || value === '') return '—'

  switch (q.type) {
    case 'boolean':
      return value === true || value === 'true' ? 'Yes' : 'No'

    case 'checkbox':
    case 'tagbox': {
      if (!Array.isArray(value)) return String(value)
      const labelMap: Record<string, string> = {}
      for (const c of q.choices ?? []) labelMap[c.value] = c.text
      return (value as unknown[])
        .map((v) => labelMap[String(v)] || String(v))
        .join(', ')
    }

    case 'radiogroup':
    case 'dropdown': {
      const labelMap: Record<string, string> = {}
      for (const c of q.choices ?? []) labelMap[c.value] = c.text
      return labelMap[String(value)] || String(value)
    }

    case 'matrix':
    case 'matrixdropdown': {
      if (typeof value !== 'object' || !value) return '—'
      const rowLabelMap: Record<string, string> = {}
      const colLabelMap: Record<string, string> = {}
      for (const r of q.rows ?? []) rowLabelMap[r.value] = r.text
      for (const c of q.columns ?? []) colLabelMap[c.value] = c.text
      return Object.entries(value as Record<string, unknown>)
        .map(([rk, cv]) => `${rowLabelMap[rk] || rk}: ${colLabelMap[String(cv)] || String(cv)}`)
        .join(' · ')
    }

    case 'multipletext': {
      if (typeof value !== 'object' || !value) return '—'
      const itemLabelMap: Record<string, string> = {}
      for (const it of q.items ?? []) itemLabelMap[it.name] = it.title
      return Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${itemLabelMap[k] || k}: ${String(v)}`)
        .join(' · ')
    }

    default: {
      if (typeof value === 'object') {
        // SurveyJS choice object (e.g. country)
        const obj = value as Record<string, unknown>
        return String(obj['name'] ?? obj['cca2'] ?? JSON.stringify(value))
      }
      return String(value)
    }
  }
}

// ─── User Answers Modal ───────────────────────────────────────────────────────

function UserAnswersModal({
  row,
  onClose,
}: {
  row: UserRow
  onClose: () => void
}) {
  const { activeDefinition } = useSurveyStore()
  const [selectedSection, setSelectedSection] = useState(0)

  const definition = (activeDefinition?.definition ?? SURVEY_DEFINITION) as Record<string, unknown>
  const pages = (definition['pages'] ?? []) as unknown[]

  const data = row.submission?.data ?? {}
  const profile = row.profile
  const name = `${profile.first_name} ${profile.last_name}`.trim() || profile.email

  const questions = useMemo(() => {
    const page = pages[selectedSection]
    if (!page) return []
    return extractQuestionsFromPage(page)
  }, [selectedSection, pages])

  const answeredQuestions = questions.filter((q) => {
    const v = data[q.name]
    return v !== undefined && v !== null && v !== ''
  })

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={handleBackdrop}
    >
      <div
        className="bg-white rounded-2xl flex flex-col"
        style={{
          width: '100%',
          maxWidth: 720,
          maxHeight: '88vh',
          border: '1px solid var(--bd)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--bd)' }}
        >
          <div>
            <h2 className="font-display text-[16px] font-bold text-[#0d1117]">
              Survey Answers — {name}
            </h2>
            <p className="font-body text-[12px] text-[#7a8a96] mt-0.5">
              {profile.email} ·{' '}
              <span
                className={
                  row.submission?.status === 'submitted' || row.submission?.status === 'reviewed'
                    ? 'text-[#1d7733]'
                    : 'text-amber-600'
                }
              >
                {row.submission?.status ?? 'no submission'}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f0f4f1] transition-colors"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="#7a8a96" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Section selector */}
        <div
          className="flex items-center gap-3 px-6 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid #f0f4f1' }}
        >
          <span className="font-body text-[11px] text-[#7a8a96] font-medium">Section</span>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(Number(e.target.value))}
            className="font-body text-[12px] font-medium text-[#3d4a52] border border-[#e2ebe4] rounded-lg px-3 py-1.5 bg-white hover:border-[#1d7733] focus:outline-none focus:border-[#1d7733] transition-colors cursor-pointer"
          >
            {SECTION_NAMES.map((sn, i) => (
              <option key={i} value={i}>
                {i + 1}. {sn}
              </option>
            ))}
          </select>
          <span className="font-body text-[11px] text-[#b0bec5]">
            {answeredQuestions.length} / {questions.length} answered
          </span>
        </div>

        {/* Answers list */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
          {questions.length === 0 ? (
            <p className="font-body text-[13px] text-[#b0bec5] text-center py-10">
              No questions found in this section.
            </p>
          ) : answeredQuestions.length === 0 ? (
            <p className="font-body text-[13px] text-[#b0bec5] text-center py-10">
              No answers recorded for this section.
            </p>
          ) : (
            questions.map((q) => {
              const value = data[q.name]
              const hasAnswer = value !== undefined && value !== null && value !== ''
              return (
                <div
                  key={q.name}
                  className="rounded-xl px-4 py-3"
                  style={{
                    background: hasAnswer ? '#fff' : '#fafafa',
                    border: `1px solid ${hasAnswer ? 'var(--bd)' : '#f0f0f0'}`,
                    opacity: hasAnswer ? 1 : 0.5,
                  }}
                >
                  <p className="font-body text-[11px] text-[#7a8a96] mb-1 leading-snug">
                    {q.title || q.name}
                  </p>
                  <p
                    className="font-body text-[13px] font-semibold leading-snug"
                    style={{ color: hasAnswer ? '#0d1117' : '#b0bec5' }}
                  >
                    {hasAnswer ? formatAnswer(q, value) : 'Not answered'}
                  </p>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div
          className="flex justify-end px-6 py-3 flex-shrink-0"
          style={{ borderTop: '1px solid #f0f4f1' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="font-display text-[10px] font-bold tracking-[0.10em] uppercase px-4 py-2 rounded-lg border-[1.5px] border-[#e2ebe4] text-[#7a8a96] hover:bg-[#f7f9f7] transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function UsersPanel() {
  const { profile: myProfile } = useAuthStore()
  const { toast, openConfirmModal } = useUIStore()

  const [userRows, setUserRows] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null)
  const [viewAnswersRow, setViewAnswersRow] = useState<UserRow | null>(null)

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const [profiles, submissions] = await Promise.all([
        listProfiles(),
        getSubmissions(),
      ])

      const submissionByUserId = new Map<string, SubmissionRow>()
      for (const sub of submissions) {
        submissionByUserId.set(sub.user_id, sub)
      }

      setUserRows(
        profiles.map((p) => ({
          profile: p,
          submission: submissionByUserId.get(p.id),
        }))
      )
    } catch (err) {
      console.error('UsersPanel fetch error:', err)
      toast('Failed to load users.', 'err')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('users-panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () =>
        void fetchAll()
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () =>
        void fetchAll()
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [fetchAll])

  // ── Role update ───────────────────────────────────────────────────────────
  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdatingRoleId(userId)
    try {
      await updateUserRole(userId, newRole)
      setUserRows((prev) =>
        prev.map((r) =>
          r.profile.id === userId ? { ...r, profile: { ...r.profile, role: newRole } } : r
        )
      )
      toast('Role updated.', 'ok')
    } catch {
      toast('Failed to update role.', 'err')
    } finally {
      setUpdatingRoleId(null)
    }
  }

  // ── Reset single user ─────────────────────────────────────────────────────
  const handleResetUser = (row: UserRow) => {
    const name =
      `${row.profile.first_name} ${row.profile.last_name}`.trim() || row.profile.email
    openConfirmModal({
      title: 'Reset Survey',
      message: `Reset the survey for ${name}? All their responses will be permanently cleared.`,
      variant: 'danger',
      onConfirm: async () => {
        const subId = row.submission?.id
        if (!subId) return
        try {
          await resetSubmission(subId)
          toast(`Survey reset for ${name}.`, 'ok')
          await fetchAll()
        } catch {
          toast('Failed to reset survey.', 'err')
        }
      },
    })
  }

  // ── Reset all ─────────────────────────────────────────────────────────────
  const handleResetAll = () => {
    openConfirmModal({
      title: 'Reset All Surveys',
      message:
        'This will reset ALL survey submissions (except reviewed ones). This action cannot be undone.',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await resetAllSubmissions()
          toast('All surveys reset.', 'ok')
          await fetchAll()
        } catch {
          toast('Failed to reset all surveys.', 'err')
        }
      },
    })
  }

  // ── Search filter ─────────────────────────────────────────────────────────
  const filteredRows = userRows.filter((row) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    const name = `${row.profile.first_name} ${row.profile.last_name}`.toLowerCase()
    const email = row.profile.email.toLowerCase()
    return name.includes(q) || email.includes(q)
  })

  return (
    <div className="p-6 md:p-8 max-w-[1200px]">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-[22px] font-bold text-[#0d1117]">Users</h1>
          <p className="font-body text-[13px] text-[#7a8a96] mt-0.5">
            Manage roles and survey progress for all participants
          </p>
        </div>

        <button
          type="button"
          onClick={handleResetAll}
          className="inline-flex items-center gap-2 font-display text-[10px] font-bold tracking-[0.12em] uppercase px-4 py-2 rounded-full border-[1.5px] border-red-200 text-red-600 hover:bg-red-50 transition-all"
        >
          Reset All Surveys
        </button>
      </div>

      {/* ── Search ─────────────────────────────────────────────────────────── */}
      <div className="mb-5 relative max-w-xs">
        <span
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#b0bec5]"
          aria-hidden="true"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M9.5 9.5l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </span>
        <input
          type="search"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 font-body text-[13px] border border-[#e2ebe4] rounded-lg bg-white placeholder-[#b0bec5] text-[#0d1117] focus:outline-none focus:border-[#1d7733] transition-colors"
          aria-label="Search users"
        />
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-[#1d7733] border-t-transparent animate-spin" />
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#e2ebe4] p-10 text-center">
          <p className="font-body text-[14px] text-[#b0bec5]">
            {search ? 'No users match your search.' : 'No users found.'}
          </p>
        </div>
      ) : (
        <div
          className="bg-white rounded-2xl overflow-hidden"
          style={{ border: '1px solid var(--bd)', boxShadow: 'var(--shadow-sm)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" style={{ minWidth: '900px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--bd)' }}>
                  {['User', 'Role', 'Status', 'Progress', 'Last Saved', 'Actions'].map((h) => (
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
                {filteredRows.map((row, i) => {
                  const { profile, submission } = row
                  const name = `${profile.first_name} ${profile.last_name}`.trim()
                  const isMe = profile.id === myProfile?.id
                  const isSubmitted =
                    submission?.status === 'submitted' || submission?.status === 'reviewed'
                  const pct = submission
                    ? isSubmitted
                      ? 100
                      : calcProgress(submission.page_no)
                    : 0
                  const statusVal: SurveyStatus = submission?.status ?? 'draft'
                  const isNotStarted = !submission || (submission.status === 'draft' && submission.page_no === 0)

                  return (
                    <tr
                      key={profile.id}
                      className="transition-colors"
                      style={{
                        borderBottom: i < filteredRows.length - 1 ? '1px solid #f0f4f1' : 'none',
                      }}
                      onMouseEnter={(e) => {
                        ;(e.currentTarget as HTMLTableRowElement).style.background = '#f7f9f7'
                      }}
                      onMouseLeave={(e) => {
                        ;(e.currentTarget as HTMLTableRowElement).style.background = 'transparent'
                      }}
                    >
                      {/* User */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: 'var(--g3)' }}
                            aria-hidden="true"
                          >
                            <span className="font-display text-[11px] font-bold text-[#0e5921]">
                              {getInitials(profile)}
                            </span>
                          </div>
                          <div>
                            <p className="font-body text-[13px] font-semibold text-[#0d1117] leading-snug flex items-center gap-1.5">
                              {name}
                              {isMe && (
                                <span className="font-body text-[9px] font-semibold text-[#7a8a96] bg-[#f0f4f1] px-1.5 py-0.5 rounded-full">
                                  You
                                </span>
                              )}
                            </p>
                            <p className="font-body text-[11px] text-[#7a8a96]">{profile.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Role dropdown */}
                      <td className="px-4 py-3">
                        <div className="relative inline-flex items-center">
                          <select
                            value={profile.role}
                            onChange={(e) =>
                              void handleRoleChange(profile.id, e.target.value as UserRole)
                            }
                            disabled={updatingRoleId === profile.id}
                            className={[
                              'font-body text-[11px] font-semibold px-2 py-1 rounded-full border cursor-pointer appearance-none pr-5 transition-all focus:outline-none',
                              ROLE_BADGE_COLORS[profile.role],
                            ].join(' ')}
                            aria-label={`Change role for ${name}`}
                          >
                            {ROLE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          {updatingRoleId === profile.id && (
                            <span className="absolute right-1 top-1/2 -translate-y-1/2">
                              <div className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin opacity-60" />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span
                          className={[
                            'inline-flex font-body text-[10px] font-semibold px-2 py-0.5 rounded-full border tracking-[0.04em]',
                            STATUS_CHIP_STYLES[statusVal],
                          ].join(' ')}
                        >
                          {isNotStarted ? 'Not Started' : STATUS_LABELS[statusVal]}
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

                      {/* Last saved */}
                      <td className="px-4 py-3">
                        <span className="font-body text-[12px] text-[#7a8a96]">
                          {submission?.saved_at
                            ? formatSavedAt(submission.saved_at)
                            : '—'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {submission && Object.keys(submission.data ?? {}).length > 0 && (
                            <button
                              type="button"
                              onClick={() => setViewAnswersRow(row)}
                              className="font-display text-[10px] font-bold tracking-[0.10em] uppercase px-3 py-1.5 rounded-lg border-[1.5px] text-[#1d7733] border-[#afc7b4] hover:bg-[#e8f5ec] transition-all"
                              aria-label={`View answers for ${name}`}
                            >
                              View Answers
                            </button>
                          )}
                          {submission?.id && (
                            <button
                              type="button"
                              onClick={() => handleResetUser(row)}
                              className="font-display text-[10px] font-bold tracking-[0.10em] uppercase px-3 py-1.5 rounded-lg border-[1.5px] text-red-600 border-red-200 hover:bg-red-50 transition-all"
                              aria-label={`Reset survey for ${name}`}
                            >
                              Reset Survey
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Row count */}
      {!loading && (
        <p className="font-body text-[11px] text-[#b0bec5] mt-3 text-right">
          Showing {filteredRows.length} of {userRows.length} users
        </p>
      )}

      {/* View Answers modal */}
      {viewAnswersRow && (
        <UserAnswersModal
          row={viewAnswersRow}
          onClose={() => setViewAnswersRow(null)}
        />
      )}
    </div>
  )
}
