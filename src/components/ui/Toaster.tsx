import { useEffect, useCallback } from 'react'
import { create } from 'zustand'

// ─── Toast types ─────────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  message: string
  variant: ToastVariant
  duration?: number // ms, default 4000
}

// ─── Toast store ──────────────────────────────────────────────────────────────

interface ToastState {
  toasts: Toast[]
  add: (toast: Omit<Toast, 'id'>) => void
  remove: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  add: (toast) => {
    const id = crypto.randomUUID()
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }))
  },

  remove: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },
}))

// ─── Public helper — call from anywhere ──────────────────────────────────────

export function toast(message: string, variant: ToastVariant = 'info', duration = 4000) {
  useToastStore.getState().add({ message, variant, duration })
}

// ─── Variant styles ───────────────────────────────────────────────────────────

const variantClasses: Record<ToastVariant, string> = {
  success: 'bg-g1 text-white',
  error:   'bg-red-600 text-white',
  warning: 'bg-yellow-500 text-white',
  info:    'bg-f2 text-white',
}

const variantIcons: Record<ToastVariant, string> = {
  success: '✓',
  error:   '✕',
  warning: '⚠',
  info:    'ℹ',
}

// ─── Single toast item ────────────────────────────────────────────────────────

function ToastItem({ toast: t }: { toast: Toast }) {
  const remove = useToastStore((s) => s.remove)

  const dismiss = useCallback(() => remove(t.id), [remove, t.id])

  useEffect(() => {
    const timer = setTimeout(dismiss, t.duration ?? 4000)
    return () => clearTimeout(timer)
  }, [dismiss, t.duration])

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={[
        'flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg',
        'font-body text-sm font-medium',
        'animate-fade-slide-up cursor-pointer select-none',
        variantClasses[t.variant],
      ].join(' ')}
      onClick={dismiss}
    >
      <span className="text-base leading-none" aria-hidden="true">
        {variantIcons[t.variant]}
      </span>
      <span className="flex-1">{t.message}</span>
      <button
        onClick={(e) => { e.stopPropagation(); dismiss() }}
        className="ml-2 opacity-75 hover:opacity-100 transition-opacity leading-none"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  )
}

// ─── Toaster container ────────────────────────────────────────────────────────

export default function Toaster() {
  const toasts = useToastStore((s) => s.toasts)

  if (toasts.length === 0) return null

  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-[10000] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} />
        </div>
      ))}
    </div>
  )
}
