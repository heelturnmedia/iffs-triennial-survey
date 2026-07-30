// ─────────────────────────────────────────────────────────────────────────────
// Active-time tracker — accumulates the seconds a respondent actively spends in
// the survey. Time is counted only while the tab is visible, the window is
// focused, and the user has interacted within the idle window; it pauses when
// the survey is backgrounded or left idle. The running total (base + this
// session) is persisted in seconds through the survey's normal autosave, so it
// sums correctly across the many sessions a long survey is filled over.
//
// This is an approximation of engagement time, not a precise stopwatch — the
// idle threshold is a deliberate judgement call.
// ─────────────────────────────────────────────────────────────────────────────

const TICK_MS = 5_000   // how often we settle elapsed active time
const IDLE_MS = 60_000  // no interaction for this long ⇒ counted as idle (paused)

// Interaction signals that count as "the respondent is working". Deliberately
// excludes bare mousemove — presence needs a real action (key, click, scroll).
const INTERACTION_EVENTS = ['keydown', 'pointerdown', 'wheel', 'scroll', 'touchstart'] as const

export interface ActiveTimeTracker {
  /** base seconds + active seconds accumulated this session, settled to now. */
  totalSeconds(): number
  /** Detach listeners and stop counting. Idempotent. */
  stop(): void
}

export function createActiveTimeTracker(baseSeconds = 0): ActiveTimeTracker {
  let sessionMs = 0
  let lastTick = Date.now()
  let lastInteraction = Date.now()
  let stopped = false

  const markInteraction = () => { lastInteraction = Date.now() }

  const isEngaged = () =>
    typeof document !== 'undefined' &&
    document.visibilityState === 'visible' &&
    document.hasFocus() &&
    Date.now() - lastInteraction <= IDLE_MS

  // Settle the time since the last tick, crediting it only when engaged. The
  // upper bound guards against huge jumps after the machine sleeps or a timer
  // is throttled in a background tab.
  const settle = () => {
    if (stopped) return
    const now = Date.now()
    const delta = now - lastTick
    lastTick = now
    if (isEngaged() && delta > 0 && delta <= TICK_MS * 2) sessionMs += delta
  }

  const interval = setInterval(settle, TICK_MS)
  for (const ev of INTERACTION_EVENTS) {
    document.addEventListener(ev, markInteraction, { passive: true })
  }
  // Settle immediately when the tab hides or the window loses focus so we never
  // count away-time; treat regaining focus as a fresh interaction.
  document.addEventListener('visibilitychange', settle)
  window.addEventListener('blur', settle)
  window.addEventListener('focus', markInteraction)

  return {
    totalSeconds() {
      settle()
      return baseSeconds + Math.round(sessionMs / 1000)
    },
    stop() {
      if (stopped) return
      stopped = true
      settle()
      clearInterval(interval)
      for (const ev of INTERACTION_EVENTS) document.removeEventListener(ev, markInteraction)
      document.removeEventListener('visibilitychange', settle)
      window.removeEventListener('blur', settle)
      window.removeEventListener('focus', markInteraction)
    },
  }
}
