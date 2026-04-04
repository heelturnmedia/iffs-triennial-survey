// ─────────────────────────────────────────────────────────────────────────────
// UI Store — Zustand
// ─────────────────────────────────────────────────────────────────────────────
import { create } from 'zustand'
import type { ToastType, ActivePanel, ConfirmModalConfig } from '@/types'
// Toast rendering is owned by Toaster (src/components/ui/Toaster.tsx).
// uiStore delegates to useToastStore so all components using toast/addToast
// continue to work without change, and only one toast system renders.
// NOTE: never import from uiStore inside Toaster.tsx — that would create a cycle.
import { useToastStore } from '@/components/ui/Toaster'

// ─── Type mapping: uiStore uses 'ok'|'err'|'info', Toaster uses success|error|info ──
const TOAST_VARIANT_MAP: Record<string, 'success' | 'error' | 'info' | 'warning'> = {
  ok:   'success',
  err:  'error',
  info: 'info',
}

interface UIState {
  activePanel: ActivePanel
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

export const useUIStore = create<UIState>(() => ({
  activePanel: 'overview',
  isConfirmModalOpen: false,
  confirmModal: null,
  welcomeOverlayOpen: false,

  setActivePanel: (activePanel) => useUIStore.setState({ activePanel }),

  addToast: (message, type = 'info') => {
    useToastStore.getState().add({ message, variant: TOAST_VARIANT_MAP[type] ?? 'info' })
  },

  // No-op — Toaster handles its own dismissal via its internal store.
  // Kept in interface for backwards compatibility with any component that
  // calls removeToast directly.
  removeToast: (_id: string) => { /* delegated to Toaster */ },

  openConfirmModal: (config) =>
    useUIStore.setState({ isConfirmModalOpen: true, confirmModal: config }),

  closeConfirmModal: () =>
    useUIStore.setState({ isConfirmModalOpen: false, confirmModal: null }),

  setWelcomeOverlayOpen: (welcomeOverlayOpen) =>
    useUIStore.setState({ welcomeOverlayOpen }),

  toast: (message, type = 'info') => {
    useToastStore.getState().add({ message, variant: TOAST_VARIANT_MAP[type] ?? 'info' })
  },
}))
