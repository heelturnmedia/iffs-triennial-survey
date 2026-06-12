import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useSurveyStore } from '@/stores/surveyStore'
import { useUIStore } from '@/stores/uiStore'
import { supabase } from '@/lib/supabase'
import { getSubmission, getActiveDefinition } from '@/services/surveyService'
import { getProfile } from '@/services/authService'
import { loadPersistedSurvey, clearPersistedSurvey } from '@/lib/localStorage'
import type { SurveySubmission } from '@/types'

/**
 * Bootstraps auth state and loads user's survey submission after sign-in.
 * Call once at the app root level.
 */
export function useAuth() {
  const authStore = useAuthStore()
  const surveyStore = useSurveyStore()

  useEffect(() => {
    const cleanup = authStore.initialize()
    return cleanup
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Safety net: if we have a valid session but profile is still null after the
  // initial load window (e.g. fetchProfile failed silently, or an auth event
  // cleared it), re-fetch automatically. This runs whenever user/profile changes.
  useEffect(() => {
    const { user, profile, loading } = authStore
    if (loading || !user || profile) return
    // Session exists but no profile — recover silently
    getProfile(user.id).then((p) => {
      if (p) useAuthStore.setState({ profile: p })
    }).catch(() => { /* non-fatal */ })
  }, [authStore.user?.id, authStore.profile, authStore.loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // When user signs in, load their survey submission
  useEffect(() => {
    const userId = authStore.user?.id
    const email = authStore.user?.email
    if (!userId || !email) {
      surveyStore.reset()
      return
    }

    let cancelled = false

    async function loadSurveyData() {
      try {
        // Load submission and active definition in parallel (one roundtrip instead of two)
        const [submission, def] = await Promise.all([
          getSubmission(userId!),
          getActiveDefinition(),
        ])
        if (cancelled) return

        if (submission) {
          // Restore the localStorage draft only when it is strictly NEWER than
          // the server row. The old heuristic (more keys / higher page wins)
          // resurrected answers after an admin reset: the reset empties the
          // server row, so any stale local draft "won" and the next autosave
          // re-uploaded the cleared answers.
          const local = loadPersistedSurvey(email!)
          const localSavedAt = local?.saved_at ? new Date(local.saved_at).getTime() : 0
          const serverSavedAt = submission.saved_at ? new Date(submission.saved_at).getTime() : 0
          const localIsNewer = submission.status === 'draft' && localSavedAt > serverSavedAt

          if (local && localIsNewer) {
            surveyStore.setSubmission({
              ...submission,
              page_no: local.page_no,
              data: local.data,
              saved_at: local.saved_at,
            })
          } else {
            // Server is authoritative — drop any stale local draft so it can
            // never be merged back on a future login.
            if (local) clearPersistedSurvey(email!)
            surveyStore.setSubmission(submission)
          }
        }

        if (def) {
          surveyStore.setActiveDefinition(def)
        }
      } catch (err) {
        if (import.meta.env.DEV) console.warn('useAuth: failed to load survey data', err)
      }
    }

    loadSurveyData()
    return () => { cancelled = true }
  }, [authStore.user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime subscription — update submission live when admin resets it
  useEffect(() => {
    const userId = authStore.user?.id
    if (!userId) return

    const channel = supabase
      .channel(`submission:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'survey_submissions',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const next = payload.new as SurveySubmission
            // An admin reset arrives as an empty draft row. Drop the local
            // draft (so it can't resurrect the cleared answers) and close the
            // survey modal — the in-memory SurveyJS model still holds the old
            // answers and would autosave them right back.
            const isReset =
              next.status === 'draft' &&
              next.page_no === 0 &&
              Object.keys(next.data ?? {}).length === 0
            if (isReset) {
              const email = useAuthStore.getState().user?.email
              if (email) clearPersistedSurvey(email)
              if (useSurveyStore.getState().isModalOpen) {
                useSurveyStore.getState().closeModal()
                useUIStore.getState().toast('Your survey was reset by an administrator.', 'info')
              }
            }
            surveyStore.setSubmission(next)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [authStore.user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return authStore
}
