import { createClient } from '@supabase/supabase-js'

// In production (Docker), env vars are injected at runtime via env-config.js
// into window.__env. In local dev they come from import.meta.env (.env file).
declare const window: Window & { __env?: Record<string, string> }

const supabaseUrl =
  (typeof window !== 'undefined' && window.__env?.VITE_SUPABASE_URL) ||
  import.meta.env.VITE_SUPABASE_URL

const supabaseAnonKey =
  (typeof window !== 'undefined' && window.__env?.VITE_SUPABASE_ANON_KEY) ||
  import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

// ─── Ephemeral client factory ────────────────────────────────────────────────
// For one-shot operations that must NOT share storage with the main app,
// e.g. verifying a user's current password via signInWithPassword without
// clobbering the active session, firing SIGNED_IN on the main listener,
// or resetting the session expiry clock.
export function createEphemeralClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
