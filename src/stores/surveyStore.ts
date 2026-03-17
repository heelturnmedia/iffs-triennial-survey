// ─────────────────────────────────────────────────────────────────────────────
// Survey Store — Zustand
// ─────────────────────────────────────────────────────────────────────────────
import { create } from 'zustand'
import type { SurveySubmission, SurveyDefinition } from '@/types'

type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface SurveyState {
  submission: SurveySubmission | null
  isModalOpen: boolean
  isSurveyLoaded: boolean
  autoSaveStatus: AutoSaveStatus
  lastSavedAt: string | null
  activeDefinition: SurveyDefinition | null

  setSubmission: (submission: SurveySubmission | null) => void
  updateSubmissionData: (pageNo: number, data: Record<string, unknown>, savedAt: string) => void
  openModal: () => void
  closeModal: () => void
  setSurveyLoaded: (loaded: boolean) => void
  setAutoSaveStatus: (status: AutoSaveStatus) => void
  setLastSavedAt: (at: string | null) => void
  setActiveDefinition: (def: SurveyDefinition | null) => void
  reset: () => void
}

export const useSurveyStore = create<SurveyState>((set, get) => ({
  submission: null,
  isModalOpen: false,
  isSurveyLoaded: false,
  autoSaveStatus: 'idle',
  lastSavedAt: null,
  activeDefinition: null,

  setSubmission: (submission) => set({ submission }),

  updateSubmissionData: (pageNo, data, savedAt) => {
    const existing = get().submission
    if (!existing) return
    set({ submission: { ...existing, page_no: pageNo, data, saved_at: savedAt } })
  },

  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false }),
  setSurveyLoaded: (isSurveyLoaded) => set({ isSurveyLoaded }),
  setAutoSaveStatus: (autoSaveStatus) => set({ autoSaveStatus }),
  setLastSavedAt: (lastSavedAt) => set({ lastSavedAt }),
  setActiveDefinition: (activeDefinition) => set({ activeDefinition }),

  reset: () =>
    set({
      submission: null,
      isModalOpen: false,
      isSurveyLoaded: false,
      autoSaveStatus: 'idle',
      lastSavedAt: null,
      activeDefinition: null,
    }),
}))
