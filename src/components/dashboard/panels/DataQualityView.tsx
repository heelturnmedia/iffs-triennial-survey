// ─────────────────────────────────────────────────────────────────────────────
// Data Quality — admin-facing flags over completed responses: duplicate-country
// submissions, numeric outliers (robust median/MAD), and rushed completions.
// Presentational only; all logic lives in insightsAnalytics.dataQualityFlags.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react'
import { dataQualityFlags, type QualityFlag } from '@/utils/insightsAnalytics'
import type { SubmissionRow } from '@/types'

const INK = '#0d1117'
const MUTED = '#7a8a96'

const GROUPS: Array<{ kind: QualityFlag['kind']; label: string; hint: string }> = [
  { kind: 'duplicate_country', label: 'Multiple responses per country', hint: 'Two or more completed responses share a country — confirm they are distinct institutions.' },
  { kind: 'numeric_outlier', label: 'Numeric outliers', hint: 'A reported number is far from the median across responses — possible typo or unit mismatch.' },
  { kind: 'rushed', label: 'Rushed completions', hint: 'Finished unusually fast — responses may be low-effort.' },
]

// Warn = amber (a genuine attention state, shipped with a label — not colour alone).
const TONE: Record<QualityFlag['severity'], { bg: string; bar: string; text: string }> = {
  warn: { bg: '#fffbeb', bar: '#f59e0b', text: '#92400e' },
  info: { bg: '#f7f9f7', bar: '#b0bec5', text: '#3d4a52' },
}

function FlagCard({ flag }: { flag: QualityFlag }) {
  const tone = TONE[flag.severity]
  return (
    <div className="rounded-xl p-3.5" style={{ background: tone.bg, borderLeft: `3px solid ${tone.bar}`, border: '1px solid var(--bd)', borderLeftWidth: 3 }}>
      <p className="font-body font-semibold" style={{ fontSize: 13, color: INK }}>{flag.title}</p>
      <p className="font-body mt-1" style={{ fontSize: 12, color: tone.text, lineHeight: 1.5 }}>{flag.detail}</p>
      {flag.refs.length > 0 && (
        <p className="font-mono mt-1.5" style={{ fontSize: 10, color: MUTED, letterSpacing: '-0.01em' }}>
          {flag.refs.slice(0, 8).join(' · ')}{flag.refs.length > 8 ? ` +${flag.refs.length - 8} more` : ''}
        </p>
      )}
    </div>
  )
}

export function DataQualityView({
  submissions, pages,
}: {
  submissions: SubmissionRow[]
  pages: unknown[]
}) {
  const flags = useMemo(() => dataQualityFlags(submissions, pages), [submissions, pages])
  const [showAll, setShowAll] = useState(false)

  const byKind = useMemo(() => {
    const m = new Map<QualityFlag['kind'], QualityFlag[]>()
    for (const f of flags) {
      const list = m.get(f.kind) ?? []
      list.push(f)
      m.set(f.kind, list)
    }
    return m
  }, [flags])

  const warnCount = flags.filter((f) => f.severity === 'warn').length

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white rounded-2xl p-5" style={{ border: '1px solid var(--bd)', boxShadow: 'var(--shadow-sm)' }}>
        <h3 className="font-display font-bold" style={{ fontSize: 14, color: INK }}>Data quality</h3>
        <p className="font-body mt-0.5" style={{ fontSize: 12, color: MUTED }}>
          Automated checks over completed responses. These are signals to review, not errors — verify before acting.
        </p>
        {flags.length === 0 ? (
          <p className="font-body mt-4" style={{ fontSize: 13, color: '#1d7733', fontWeight: 600 }}>
            ✓ No quality issues detected.
          </p>
        ) : (
          <p className="font-body mt-3" style={{ fontSize: 12, color: MUTED }}>
            {flags.length} flag{flags.length !== 1 ? 's' : ''} across {byKind.size} categor{byKind.size !== 1 ? 'ies' : 'y'}
            {warnCount > 0 && <span style={{ color: '#92400e', fontWeight: 600 }}> · {warnCount} needing attention</span>}
          </p>
        )}
      </div>

      {GROUPS.map((g) => {
        const items = byKind.get(g.kind) ?? []
        if (items.length === 0) return null
        const shown = showAll ? items : items.slice(0, 6)
        return (
          <div key={g.kind} className="bg-white rounded-2xl p-5" style={{ border: '1px solid var(--bd)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <div>
                <h3 className="font-display font-bold" style={{ fontSize: 14, color: INK }}>{g.label}</h3>
                <p className="font-body mt-0.5" style={{ fontSize: 12, color: MUTED }}>{g.hint}</p>
              </div>
              <span className="font-display font-bold tabular-nums" style={{ fontSize: 18, color: INK }}>{items.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {shown.map((f, i) => <FlagCard key={i} flag={f} />)}
            </div>
            {items.length > 6 && !showAll && (
              <button type="button" onClick={() => setShowAll(true)}
                className="font-display mt-3 text-[10px] font-bold tracking-[0.10em] uppercase px-3 py-1.5 rounded-lg border-[1.5px] text-[#1d7733] border-[#afc7b4] hover:bg-[#e8f5ec] transition-all">
                Show all {items.length}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
