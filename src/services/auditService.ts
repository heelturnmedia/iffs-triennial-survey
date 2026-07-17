// ─────────────────────────────────────────────────────────────────────────────
// Audit service — records who did what, so admin access to participant PII is
// no longer invisible. Writes go to public.activity_log (RLS: a user may INSERT
// rows for themselves; admins may SELECT all).
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { UserRole } from '@/types'

export interface ActivityRecord {
  id: string
  user_id: string | null
  action: string
  metadata: Record<string, unknown> | null
  created_at: string
  actor?: {
    first_name?: string
    last_name?: string
    email?: string
    role?: UserRole
  } | null
}

// Fire-and-forget. A failed audit write must never block the action itself.
export async function logActivity(
  action: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    let uid = useAuthStore.getState().user?.id
    if (!uid) {
      // Right after sign-in the store may not have flushed yet — the persisted
      // session is already available locally (no network call).
      const { data } = await supabase.auth.getSession()
      uid = data.session?.user?.id
    }
    if (!uid) return
    await supabase.from('activity_log').insert({ user_id: uid, action, metadata })
  } catch {
    /* non-fatal */
  }
}

export async function listActivity(limit = 200): Promise<ActivityRecord[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select(`
      id, user_id, action, metadata, created_at,
      actor:profiles ( first_name, last_name, email, role )
    `)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as unknown as ActivityRecord[]
}
