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
