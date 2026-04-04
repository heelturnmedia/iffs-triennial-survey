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

    // Subscribe to subsequent auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          // Explicit sign-out — clear everything immediately, no profile needed
          set({ session: null, user: null, loading: false, profile: null })
          return
        }

        if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
          // INITIAL_SESSION: session recovered from localStorage on page load — same user.
          //   The parallel getSession()→fetchProfile path already owns the profile load.
          //   Do NOT clear profile here or the admin view flashes away while the network
          //   round-trip (Supabase verifying the token) completes (~1-2 s after load).
          // TOKEN_REFRESHED: silent token rotation — same user, profile unchanged.
          // In both cases: update session/user, preserve whatever profile is in state.
          set((state) => ({
            session,
            user: session?.user ?? null,
            loading: false,
            profile: state.profile,
          }))
          return
        }

        // SIGNED_IN / USER_UPDATED / PASSWORD_RECOVERY / any future event:
        // Could be a different user (SIGNED_IN) or stale data (USER_UPDATED).
        // Set session immediately so AuthGuard unblocks, then fetch fresh profile.
        set({ session, user: session?.user ?? null, loading: false, profile: null })
        if (session) {
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
