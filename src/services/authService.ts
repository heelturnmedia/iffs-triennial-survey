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

// ─── Reset Password ───────────────────────────────────────────────────────────

export async function resetPasswordForEmail(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth?mode=reset`,
  })
  if (error) throw error
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
