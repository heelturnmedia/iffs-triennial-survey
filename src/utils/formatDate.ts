// ─────────────────────────────────────────────────────────────────────────────
// Date / time formatting utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format an ISO timestamp for the auto-save indicator.
 * e.g. "2:34 PM" (today) or "Mar 16 at 2:34 PM"
 */
export function formatSavedAt(iso: string): string {
  try {
    const date = new Date(iso)
    const now = new Date()
    const isToday =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()

    const time = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })

    if (isToday) return `at ${time}`

    const dateStr = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
    return `${dateStr} at ${time}`
  } catch {
    return ''
  }
}

/**
 * Format a relative timestamp.
 * e.g. "just now", "2 minutes ago", "3 hours ago", "Mar 15"
 */
export function formatRelative(iso: string): string {
  try {
    const date = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHr = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHr / 24)

    if (diffSec < 30) return 'just now'
    if (diffMin < 1) return 'less than a minute ago'
    if (diffMin === 1) return '1 minute ago'
    if (diffMin < 60) return `${diffMin} minutes ago`
    if (diffHr === 1) return '1 hour ago'
    if (diffHr < 24) return `${diffHr} hours ago`
    if (diffDay === 1) return 'yesterday'
    if (diffDay < 30) return `${diffDay} days ago`

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

/**
 * Format a date for display in tables / lists.
 * e.g. "Mar 16, 2026 at 2:34 PM"
 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const date = new Date(iso)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return '—'
  }
}

/**
 * Human-readable elapsed time between two ISO timestamps — e.g. a survey's
 * start (created_at) and submission (submitted_at). Returns "—" when either
 * bound is missing or the range is invalid/negative.
 * Examples: "< 1m", "42m", "2h 15m", "3d 4h".
 */
// Compact "Nd Nh" / "Nh Nm" / "Nm" / "< 1m" rendering from a whole-minute count.
function compactDuration(totalMin: number): string {
  if (totalMin < 1) return '< 1m'
  const days = Math.floor(totalMin / 1440)
  const hours = Math.floor((totalMin % 1440) / 60)
  const mins = totalMin % 60
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`
  if (hours > 0) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  return `${mins}m`
}

export function formatDuration(
  fromIso: string | null | undefined,
  toIso: string | null | undefined,
): string {
  if (!fromIso || !toIso) return '—'
  try {
    const ms = new Date(toIso).getTime() - new Date(fromIso).getTime()
    if (!Number.isFinite(ms) || ms < 0) return '—'
    return compactDuration(Math.floor(ms / 60000))
  } catch {
    return '—'
  }
}

/**
 * Compact rendering of a duration given in seconds (e.g. accumulated active
 * time). Returns "—" for missing/zero/invalid values. Examples: "38m",
 * "1h 12m", "2d 3h".
 */
export function formatSeconds(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds) || totalSeconds <= 0) return '—'
  return compactDuration(Math.floor(totalSeconds / 60))
}
