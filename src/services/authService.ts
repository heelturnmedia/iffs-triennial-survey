// ─────────────────────────────────────────────────────────────────────────────
// Auth Service — wraps Supabase auth calls
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase'
import type { Profile, UserRole } from '../types'

export interface SignInParams {
  email: string
  password: string
}

export interface SignUpParams {
  email: string
  password: string
  firstName: string
  lastName: string
}

// ─── OAuth (Social) Sign In ───────────────────────────────────────────────────

export async function signInWithProvider(provider: 'google' | 'facebook' | 'linkedin_oidc') {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/dashboard`,
    },
  })
  if (error) throw error
  return data
}

// ─── Sign In ─────────────────────────────────────────────────────────────────

export async function signIn({ email, password }: SignInParams) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data
}

// ─── Sign Up ─────────────────────────────────────────────────────────────────

export async function signUp({ email, password, firstName, lastName }: SignUpParams) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
      },
    },
  })
  if (error) throw error

  // Create profile row after signup
  if (data.user) {
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: data.user.id,
      email,
      first_name: firstName,
      last_name: lastName,
      role: 'user' as UserRole,
    })
    // Non-fatal — profile can be created later
    if (profileError && import.meta.env.DEV) console.warn('Profile upsert error:', profileError.message)
  }

  return data
}

// ─── Sign Out ────────────────────────────────────────────────────────────────

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// ─── Get Profile ─────────────────────────────────────────────────────────────

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) {
    if (import.meta.env.DEV) console.warn('getProfile error:', error.message)
    return null
  }
  return data as Profile
}

// ─── Update Profile ───────────────────────────────────────────────────────────

export async function updateProfile(
  userId: string,
  updates: Partial<Omit<Profile, 'id' | 'created_at'>>
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data as Profile
}

// ─── Update Password ──────────────────────────────────────────────────────────

export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

// ─── Verify + Update Password ────────────────────────────────────────────────
// Re-authenticates the user with the main client (using signInWithPassword),
// then updates the password on the same client. Doing both on the main client
// avoids the navigator.locks contention that arises when a second (ephemeral)
// GoTrueClient instance runs signInWithPassword concurrently — that hangs the
// main client's subsequent updateUser() call indefinitely even after the
// server has already accepted it.
//
// The signInWithPassword call safely refreshes the existing session for the
// same user (no SIGNED_OUT event fires). On wrong password, Supabase returns
// an AuthApiError with message 'Invalid login credentials' — we surface this
// as a dedicated `WrongCurrentPasswordError` so the UI can show the right
// field error without leaking Supabase internals.

export class WrongCurrentPasswordError extends Error {
  constructor() {
    super('Current password is incorrect')
    this.name = 'WrongCurrentPasswordError'
  }
}

export async function verifyAndUpdatePassword(
  email: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  // Re-verify credentials on the main client. A successful call refreshes the
  // session for the same user — no onAuthStateChange disruption beyond the
  // usual TOKEN_REFRESHED / SIGNED_IN events the listener already handles.
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  })
  if (signInError) {
    const msg = (signInError.message ?? '').toLowerCase()
    if (msg.includes('invalid login credentials') || msg.includes('invalid') || signInError.status === 400) {
      throw new WrongCurrentPasswordError()
    }
    throw signInError
  }

  // Now update the password on the same client — no lock contention, no
  // second GoTrueClient instance.
  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
  if (updateError) throw updateError
}

// ─── Update Role ──────────────────────────────────────────────────────────────

export async function updateUserRole(userId: string, role: UserRole) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data as Profile
}

// ─── List All Profiles ───────────────────────────────────────────────────────

export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Profile[]
}
