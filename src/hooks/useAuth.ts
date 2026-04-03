import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useSurveyStore } from '@/stores/surveyStore'
import { supabase } from '@/lib/supabase'
import { getSubmission, getActiveDefinition } from '@/services/surveyService'
import { loadPersistedSurvey } from '@/lib/localStorage'

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
          // Merge with any newer localStorage draft
          const local = loadPersistedSurvey(email!)
          if (
            local &&
            submission.status !== 'submitted' &&
            (local.page_no > submission.page_no ||
              Object.keys(local.data).length > Object.keys(submission.data).length)
          ) {
            surveyStore.setSubmission({
              ...submission,
              page_no: local.page_no,
              data: local.data,
              saved_at: local.saved_at ?? submission.saved_at,
            })
          } else {
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
            surveyStore.setSubmission(payload.new as Parameters<typeof surveyStore.setSubmission>[0])
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [authStore.user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return authStore
}
