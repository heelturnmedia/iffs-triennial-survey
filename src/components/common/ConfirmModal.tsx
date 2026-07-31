import { useState } from 'react'
import { useUIStore } from '@/stores/uiStore'

export function ConfirmModal() {
  const { isConfirmModalOpen, confirmModal, closeConfirmModal } = useUIStore()
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isConfirmModalOpen || !confirmModal) return null

  const isDanger = confirmModal.variant === 'danger'
  const isWarning = confirmModal.variant === 'warning'

  const handleConfirm = async () => {
    setIsSubmitting(true)
    try {
      await confirmModal.onConfirm()
    } finally {
      // Always clear spinner and close — even if onConfirm throws or the
      // network call times out. Previously closeConfirmModal() was outside
      // the finally block, so any unhandled throw would leave the modal
      // frozen open with the spinner stuck.
      setIsSubmitting(false)
      closeConfirmModal()
    }
  }

  return (
    <div
      className="fixed inset-0 z-99000 flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
      aria-labelledby="confirm-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-xs"
        onClick={closeConfirmModal}
      />

      {/* Card */}
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl border border-bd w-full max-w-md animate-[fadeSlideUp_0.25s_ease-out]">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[#eef2ef]">
          <h2
            id="confirm-modal-title"
            className="font-display text-lg font-bold text-f1"
          >
            {confirmModal.title}
          </h2>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="font-body text-[15px] text-f2 leading-relaxed">
            {confirmModal.message}
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={closeConfirmModal}
            disabled={isSubmitting}
            className="font-display text-[11px] font-bold tracking-[0.12em] uppercase px-5 py-2.5 rounded-full border-[1.5px] border-bd2 text-f2 hover:border-g1 hover:text-g1 hover:bg-g3 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className={[
              'font-display text-[11px] font-bold tracking-[0.14em] uppercase px-5 py-2.5 rounded-full border-none text-white transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed',
              isDanger
                ? 'bg-red-600 hover:bg-red-700 shadow-[0_4px_12px_rgba(220,38,38,0.3)]'
                : isWarning
                ? 'bg-amber-500 hover:bg-amber-600 shadow-[0_4px_12px_rgba(245,158,11,0.3)]'
                : 'bg-g1 hover:bg-g2 shadow-[0_4px_12px_rgba(29,119,51,0.25)]',
            ].join(' ')}
          >
            {isSubmitting && (
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            )}
            {isSubmitting ? 'Submitting…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
