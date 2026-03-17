// ─────────────────────────────────────────────────────────────────────────────
// UI Store — Zustand
// ─────────────────────────────────────────────────────────────────────────────
import { create } from 'zustand'
import type { ToastMessage, ToastType, ActivePanel, ConfirmModalConfig } from '@/types'

interface UIState {
  activePanel: ActivePanel
  toasts: ToastMessage[]
  isConfirmModalOpen: boolean
  confirmModal: ConfirmModalConfig | null
  welcomeOverlayOpen: boolean

  setActivePanel: (panel: ActivePanel) => void
  addToast: (message: string, type?: ToastType) => void
  removeToast: (id: string) => void
  openConfirmModal: (config: ConfirmModalConfig) => void
  closeConfirmModal: () => void
  setWelcomeOverlayOpen: (open: boolean) => void
  /** Shorthand: toast(message, type) */
  toast: (message: string, type?: ToastType) => void
}

export const useUIStore = create<UIState>((set) => ({
  activePanel: 'overview',
  toasts: [],
  isConfirmModalOpen: false,
  confirmModal: null,
  welcomeOverlayOpen: false,

  setActivePanel: (activePanel) => set({ activePanel }),

  addToast: (message, type = 'info') => {
    const id = crypto.randomUUID()
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
  },

  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  openConfirmModal: (config) =>
    set({ isConfirmModalOpen: true, confirmModal: config }),

  closeConfirmModal: () =>
    set({ isConfirmModalOpen: false, confirmModal: null }),

  setWelcomeOverlayOpen: (welcomeOverlayOpen) => set({ welcomeOverlayOpen }),

  toast: (message, type = 'info') => {
    const id = crypto.randomUUID()
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
  },
}))
