import { useEffect } from 'react'
import { useUIStore } from '@/stores/uiStore'
import type { ToastMessage } from '@/types'

function ToastItem({ toast }: { toast: ToastMessage }) {
  const removeToast = useUIStore((s) => s.removeToast)

  useEffect(() => {
    const timer = setTimeout(() => removeToast(toast.id), 4000)
    return () => clearTimeout(timer)
  }, [toast.id, removeToast])

  const isOk = toast.type === 'ok'
  const isErr = toast.type === 'err'

  return (
    <div
      className={[
        'flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium',
        'animate-[fadeSlideUp_0.3s_ease-out] cursor-pointer select-none max-w-sm',
        isOk
          ? 'bg-[#e8f5ec] border-[#afc7b4] text-[#0e5921]'
          : isErr
          ? 'bg-red-50 border-red-200 text-red-800'
          : 'bg-white border-[#e2ebe4] text-[#0d1117]',
      ].join(' ')}
      onClick={() => removeToast(toast.id)}
    >
      <span className="text-base flex-shrink-0">
        {isOk ? '✓' : isErr ? '✕' : 'ℹ'}
      </span>
      <span className="font-body flex-1">{toast.message}</span>
      <button
        className="opacity-60 hover:opacity-100 transition-opacity ml-1"
        onClick={(e) => { e.stopPropagation(); removeToast(toast.id) }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  )
}

export function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts) as ToastMessage[]

  if (toasts.length === 0) return null

  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-6 right-6 z-[99999] flex flex-col gap-2 items-end pointer-events-none"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} />
        </div>
      ))}
    </div>
  )
}
