import { useEffect, useState, useCallback } from 'react'
import { listActivity, type ActivityRecord } from '@/services/auditService'
import { useUIStore } from '@/stores/uiStore'
import { supabase } from '@/lib/supabase'
import { formatDateTime } from '@/utils/formatDate'

// ─── Action → human label + styling ────────────────────────────────────────────

interface ActionMeta {
  label: string
  danger?: boolean
}

const ACTION_META: Record<string, ActionMeta> = {
  delete_user:           { label: 'Deleted a user',              danger: true },
  reset_submission:      { label: 'Reset a survey' },
  reset_all_submissions: { label: 'Reset ALL surveys',          danger: true },
  export_response:       { label: "Exported a participant's answers" },
  export_all_responses:  { label: 'Exported all section responses' },
  view_answers:          { label: "Viewed a participant's answers" },
  wa_full_sync:          { label: 'Ran a WildApricot member sync' },
}

function actionMeta(action: string): ActionMeta {
  return ACTION_META[action] ?? { label: action.replace(/_/g, ' ') }
}

function summariseMetadata(md: Record<string, unknown> | null): string {
  if (!md) return ''
  const parts: string[] = []
  if (md['target_email']) parts.push(String(md['target_email']))
  if (md['reference']) parts.push(String(md['reference']))
  if (md['format']) parts.push(String(md['format']).toUpperCase())
  if (md['count'] !== undefined) parts.push(`${md['count']} records`)
  if (md['target_role']) parts.push(`role: ${md['target_role']}`)
  return parts.join(' · ')
}

// ─── Panel ─────────────────────────────────────────────────────────────────────

export function ActivityPanel() {
  const { toast } = useUIStore()
  const [rows, setRows] = useState<ActivityRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'sensitive'>('all')

  const fetchAll = useCallback(async () => {
    try {
      setRows(await listActivity(300))
    } catch (err) {
      console.error('ActivityPanel fetch error:', err)
      toast('Failed to load the activity log.', 'err')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  // Live-append new audit rows.
  useEffect(() => {
    const channel = supabase
      .channel('activity-log-panel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, () =>
        void fetchAll()
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [fetchAll])

  const SENSITIVE = new Set(['delete_user', 'reset_submission', 'reset_all_submissions'])
  const filtered = filter === 'all' ? rows : rows.filter((r) => SENSITIVE.has(r.action))

  const deletionsCount = rows.filter((r) => r.action === 'delete_user').length

  return (
    <div className="p-6 md:p-8 max-w-[1100px]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="font-display text-[22px] font-bold text-[#0d1117]">Activity Log</h1>
          <p className="font-body text-[13px] text-[#7a8a96] mt-0.5">
            Every administrative action — exports, views, resets, and deletions — with who and when.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'sensitive'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className="font-body text-[12px] font-semibold px-3 py-1.5 rounded-lg border transition-all"
              style={
                filter === f
                  ? { background: '#e8f5ec', color: '#0e5921', borderColor: '#afc7b4' }
                  : { background: '#fff', color: '#7a8a96', borderColor: '#e2ebe4' }
              }
            >
              {f === 'all' ? 'All actions' : 'Sensitive only'}
            </button>
          ))}
        </div>
      </div>

      {/* Deletion callout */}
      {deletionsCount > 0 && (
        <div
          className="mb-5 flex items-center gap-2.5 rounded-xl px-4 py-3"
          style={{ background: '#fef2f2', border: '1px solid #fecaca' }}
        >
          <span className="text-red-500 text-base flex-shrink-0">⚠</span>
          <p className="font-body text-[13px] text-red-700">
            <span className="font-bold">{deletionsCount}</span> user{deletionsCount !== 1 ? 's have' : ' has'} been
            permanently deleted. These are highlighted below.
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-[#1d7733] border-t-transparent animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#e2ebe4] p-10 text-center">
          <p className="font-body text-[14px] text-[#b0bec5]">No activity recorded yet.</p>
        </div>
      ) : (
        <div
          className="bg-white rounded-2xl overflow-hidden"
          style={{ border: '1px solid var(--bd)', boxShadow: 'var(--shadow-sm)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" style={{ minWidth: '760px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--bd)' }}>
                  {['When', 'Admin', 'Action', 'Details'].map((h) => (
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
                {filtered.map((r, i) => {
                  const meta = actionMeta(r.action)
                  const actorName =
                    `${r.actor?.first_name ?? ''} ${r.actor?.last_name ?? ''}`.trim() ||
                    r.actor?.email ||
                    'Unknown'
                  return (
                    <tr
                      key={r.id}
                      style={{
                        borderBottom: i < filtered.length - 1 ? '1px solid #f0f4f1' : 'none',
                        background: meta.danger ? '#fef2f2' : 'transparent',
                      }}
                    >
                      <td className="px-4 py-3 align-top">
                        <span className="font-body text-[12px] text-[#7a8a96] whitespace-nowrap">
                          {formatDateTime(r.created_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="font-body text-[13px] font-semibold text-[#0d1117] leading-snug">
                          {actorName}
                        </p>
                        {r.actor?.email && (
                          <p className="font-body text-[11px] text-[#7a8a96]">{r.actor.email}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className="inline-flex font-body text-[11px] font-semibold px-2 py-0.5 rounded-full border tracking-[0.02em]"
                          style={
                            meta.danger
                              ? { background: '#fee2e2', color: '#b91c1c', borderColor: '#fecaca' }
                              : { background: '#f0f4f1', color: '#3d4a52', borderColor: '#e2ebe4' }
                          }
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className="font-body text-[12px] text-[#3d4a52]">
                          {summariseMetadata(r.metadata) || '—'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && (
        <p className="font-body text-[11px] text-[#b0bec5] mt-3 text-right">
          Showing {filtered.length} of {rows.length} recorded actions (most recent 300).
        </p>
      )}
    </div>
  )
}
