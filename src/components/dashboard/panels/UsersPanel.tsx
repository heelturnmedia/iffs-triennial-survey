import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { listProfiles, updateUserRole } from '@/services/authService'
import { getSubmissions, resetSubmission, resetAllSubmissions } from '@/services/surveyService'
import { supabase } from '@/lib/supabase'
import { formatSavedAt } from '@/utils/formatDate'
import { ROLES, STATUS_LABELS } from '@/constants'
import type { Profile, SubmissionRow, UserRole, SurveyStatus } from '@/types'

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

// ─── Main panel ───────────────────────────────────────────────────────────────

export function UsersPanel() {
  const { profile: myProfile } = useAuthStore()
  const { toast, openConfirmModal } = useUIStore()

  const [userRows, setUserRows] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null)

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
    </div>
  )
}
