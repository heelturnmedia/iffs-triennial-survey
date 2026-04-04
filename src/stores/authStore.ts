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

    // Subscribe to subsequent auth events.
    //
    // Core rule: profile must NEVER go null while a session exists.
    // Wiping profile before the re-fetch completes is what causes the admin
    // view to flash back to "User". Instead we keep the existing profile
    // visible until a confirmed fresh one arrives, and only clear on
    // SIGNED_OUT (the one event where there genuinely is no profile).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          set({ session: null, user: null, loading: false, profile: null })
          return
        }

        // For every other event: update session/user immediately, keep existing
        // profile in place. We re-fetch only when the user might actually be
        // different (SIGNED_IN, USER_UPDATED). For INITIAL_SESSION and
        // TOKEN_REFRESHED the getSession() path or the token rotation already
        // has the right data — a re-fetch would just race unnecessarily.
        set((state) => ({
          session,
          user: session?.user ?? null,
          loading: false,
          profile: state.profile, // keep old profile — never null mid-session
        }))

        if (session && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
          // Re-fetch to get the correct profile for this specific user.
          // We set it only when it arrives — no intermediate null state.
          const profile = await fetchProfile(session.user.id)
          if (profile) set({ profile })
        }
      }
    )

    return () => subscription.unsubscribe()
  },

  setProfile: (profile) => set({ profile }),

  signOut: async () => {
    // ROOT CAUSE FIX: supabase.auth.signOut() makes a network call to revoke
    // the server-side refresh token. If the token is already expired or
    // invalidated (AuthApiError: Invalid Refresh Token), that call fails and
    // the error branch was preserving the session in the Zustand store while
    // Supabase's client left the token in localStorage. On next page load,
    // getSession() read the stale token and the user appeared still logged in.
    // The only escape was clearing browser cache.
    //
    // Fix: scope:'local' tells the Supabase client to clear the session from
    // memory and localStorage immediately WITHOUT making any network call.
    // Sign-out now always succeeds regardless of token validity or connectivity.
    set({ loading: true })
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch {
      // Even if something unexpected throws, we still clear local state.
    }
    set({ session: null, user: null, profile: null, loading: false, error: null })
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
