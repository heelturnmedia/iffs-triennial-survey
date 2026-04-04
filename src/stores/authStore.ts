// ─────────────────────────────────────────────────────────────────────────────
// Unified Auth Store — Zustand
// Combines Supabase session management with profile / role helpers
// ─────────────────────────────────────────────────────────────────────────────
import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile, UserRole } from '@/types'

const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 4,
  supervisor: 3,
  'iffs-member': 2,
  user: 1,
}

interface AuthState {
  // Supabase session
  session: Session | null
  user: User | null
  // App-level profile from profiles table
  profile: Profile | null
  loading: boolean
  error: string | null

  // Actions
  initialize: () => (() => void) | void
  setProfile: (profile: Profile | null) => void
  signOut: () => Promise<void>
  clearError: () => void

  // Computed role helpers
  isAdmin: () => boolean
  isSupervisor: () => boolean
  canViewReports: () => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  loading: true,
  error: null,

  /**
   * Bootstrap the Supabase auth listener + fetch initial profile.
   * Call once at app mount. Returns cleanup fn.
   */
  initialize: () => {
    // Fetch current session immediately to avoid flash of unauthenticated state
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      // Set session/user immediately so AuthGuard can unblock the UI
      set({ session, user: session?.user ?? null, loading: false })
      // Then load profile in the background
      if (session) {
        const profile = await fetchProfile(session.user.id)
        set({ profile })
      }
    })

    // Subscribe to subsequent auth events (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Set session/user FIRST so AuthGuard and AuthRedirect react immediately.
        // Awaiting fetchProfile before setting session causes a race: navigate('/dashboard')
        // fires while session is still null → AuthGuard bounces user back to /login.
        //
        // Events that should NOT wipe the profile before the new one arrives:
        //   TOKEN_REFRESHED — same user, token silently rotated, profile unchanged
        //   USER_UPDATED    — same user, re-fetch in background but keep old profile visible
        // Events that should clear the profile:
        //   SIGNED_IN       — could be a different user, stale profile must go
        //   INITIAL_SESSION — first load, profile is null anyway
        //   SIGNED_OUT      — clear everything
        const shouldPreserveProfile =
          event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED'

        set((state) => ({
          session,
          user: session?.user ?? null,
          loading: false,
          profile: shouldPreserveProfile ? state.profile : null,
        }))

        // Re-fetch profile whenever there is a session, EXCEPT pure token refreshes
        // (profile data hasn't changed on TOKEN_REFRESHED)
        if (session && event !== 'TOKEN_REFRESHED') {
          const profile = await fetchProfile(session.user.id)
          set({ profile })
        }
      }
    )

    return () => subscription.unsubscribe()
  },

  setProfile: (profile) => set({ profile }),

  signOut: async () => {
    set({ loading: true })
    const { error } = await supabase.auth.signOut()
    if (error) {
      set({ error: error.message, loading: false })
    } else {
      set({ session: null, user: null, profile: null, loading: false, error: null })
    }
  },

  clearError: () => set({ error: null }),

  // ── Role helpers ────────────────────────────────────────────────────────────
  isAdmin: () => get().profile?.role === 'admin',

  isSupervisor: () => {
    const role = get().profile?.role
    return role ? ROLE_HIERARCHY[role] >= ROLE_HIERARCHY['supervisor'] : false
  },

  canViewReports: () => {
    const role = get().profile?.role
    return role ? ROLE_HIERARCHY[role] >= ROLE_HIERARCHY['supervisor'] : false
  },
}))

// ─── Helper — fetch profile row ──────────────────────────────────────────────
async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) {
    if (import.meta.env.DEV) console.warn('fetchProfile error:', error.message)
    return null
  }
  return data as Profile
}
