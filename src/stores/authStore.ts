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
    // ROOT CAUSE FIX (page refresh glitch):
    // Previously this called BOTH getSession() AND subscribed to
    // onAuthStateChange. Both fired on load and raced each other — getSession()
    // set state, then INITIAL_SESSION fired and set it again, producing 3-4
    // rapid re-renders and visible flicker/glitch on every page refresh.
    //
    // Fix: use ONLY onAuthStateChange as the single source of truth. The
    // INITIAL_SESSION event fires immediately from localStorage (no network),
    // so there is no additional delay. getSession() is removed entirely.
    //
    // Core rule: profile must NEVER go null while a session exists.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          set({ session: null, user: null, loading: false, profile: null })
          return
        }

        // Update session/user immediately, keep existing profile in place.
        // Never null the profile mid-session — that is what caused the admin
        // panel to flash back to the user view.
        set((state) => ({
          session,
          user: session?.user ?? null,
          loading: false,
          profile: state.profile,
        }))

        // Fetch profile on INITIAL_SESSION (page load), SIGNED_IN, and
        // USER_UPDATED. TOKEN_REFRESHED is excluded — the user hasn't
        // changed, so re-fetching is unnecessary churn.
        if (session && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
          const profile = await fetchProfile(session.user.id)
          if (profile) set({ profile })
        }
      }
    )

    return () => subscription.unsubscribe()
  },

  setProfile: (profile) => set({ profile }),

  signOut: async () => {
    // ROOT CAUSE FIX (sign-out spinner/hang):
    // Previously signOut() called set({ loading: true }) first, which
    // immediately triggered AuthGuard to show the full-screen PageLoader
    // spinner. Then it awaited supabase.auth.signOut() — a network call that
    // can hang indefinitely when the auth server is slow or the token is
    // already dead. The user was trapped staring at the spinner with no escape.
    //
    // Fix — three steps, in this exact order:
    //
    // 1. Clear Zustand state RIGHT NOW (synchronous). AuthGuard sees
    //    session: null and redirects. No loading flag, no spinner.
    set({ session: null, user: null, profile: null, loading: false, error: null })

    // 2. Wipe the Supabase session token from localStorage directly and
    //    synchronously. The SDK stores it under 'sb-<projectRef>-auth-token'.
    //    This guarantees the token is gone before we navigate, so the next
    //    page load cannot read a stale session regardless of whether the
    //    network call below completes.
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
          localStorage.removeItem(key)
        }
      }
    } catch { /* localStorage unavailable — ignore */ }

    // 3. Tell the server to revoke the token — fire-and-forget, no await.
    //    If this hangs or fails, it doesn't matter: local state is already
    //    gone and the user is being redirected.
    supabase.auth.signOut({ scope: 'local' }).catch(() => { /* ignore */ })
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
