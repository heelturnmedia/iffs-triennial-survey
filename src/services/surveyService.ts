// ─────────────────────────────────────────────────────────────────────────────
// Survey Service — Supabase operations for submissions & definitions
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase'
import type { SurveySubmission, SurveyDefinition, SubmissionRow, MapSubmission, SurveyStatus } from '../types'

// ─── Submissions ─────────────────────────────────────────────────────────────

export async function getSubmission(userId: string): Promise<SurveySubmission | null> {
  const { data, error } = await supabase
    .from('survey_submissions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    if (import.meta.env.DEV) console.warn('getSubmission error:', error.message)
    return null
  }
  return data as SurveySubmission | null
}

export async function upsertSubmission(
  userId: string,
  updates: Partial<SurveySubmission>
): Promise<SurveySubmission> {
  const payload = {
    user_id: userId,
    ...updates,
    updated_at: new Date().toISOString(),
  }
  // 15-second hard timeout — same reasoning as submitSurvey: the Supabase
  // client's JWT refresh can stall indefinitely if the refresh token has
  // expired, leaving the fetch call waiting forever with no timeout.
  const controller = new AbortController()
  const watchdog   = setTimeout(() => controller.abort(), 15_000)

  try {
    const { data, error } = await supabase
      .from('survey_submissions')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single()
      .abortSignal(controller.signal)
    if (error) throw error
    return data as SurveySubmission
  } finally {
    clearTimeout(watchdog)
  }
}

export async function submitSurvey(submissionId: string): Promise<SurveySubmission> {
  // AbortController gives the fetch a hard 20-second deadline.
  // Without this, the browser's native fetch has NO timeout — if the Supabase
  // client's internal JWT refresh stalls (e.g. expired refresh token), or if
  // there is any network-layer hang, the call waits forever and the spinner
  // never stops. 20 s is generous for a simple UPDATE; typical is <500 ms.
  const controller = new AbortController()
  const watchdog   = setTimeout(() => controller.abort(), 20_000)

  try {
    const { data, error } = await supabase
      .from('survey_submissions')
      .update({
        status:       'submitted',
        submitted_at: new Date().toISOString(),
        updated_at:   new Date().toISOString(),
      })
      .eq('id', submissionId)
      .select()
      .single()
      .abortSignal(controller.signal)

    if (error) throw error
    return data as SurveySubmission
  } finally {
    clearTimeout(watchdog)
  }
}

export async function resetSubmission(userId: string): Promise<void> {
  const { error } = await supabase.rpc('reset_user_submission', { target_user_id: userId })
  if (error) throw error
}

export async function resetAllSubmissions(): Promise<void> {
  const { error } = await supabase.rpc('reset_all_submissions')
  if (error) throw error
}

// ─── Admin: List all submissions (joined with profiles) ──────────────────────

export async function getSubmissions(): Promise<SubmissionRow[]> {
  const { data, error } = await supabase
    .from('survey_submissions')
    .select(`
      *,
      profile:profiles (
        id, email, first_name, last_name, role, country, institution, wa_verified
      )
    `)
    .order('updated_at', { ascending: false })
    .limit(500)
  if (error) throw error

  return ((data ?? []) as unknown[]).map((row: unknown) => {
    const r = row as Record<string, unknown>
    const profile = r['profile'] as Record<string, unknown> | undefined
    return {
      ...(r as unknown as SurveySubmission),
      profile: profile as SubmissionRow['profile'],
      first_name: profile?.first_name as string | undefined,
      last_name: profile?.last_name as string | undefined,
      email: profile?.email as string | undefined,
      country: profile?.country as string | undefined,
      institution: profile?.institution as string | undefined,
    } as SubmissionRow
  })
}

// ─── Lightweight map data — country + status only, no full survey JSON ────────
// Used exclusively by ChoroplethMap. Extracts:
//   1. profiles.country  — set if the user updated their profile
//   2. data->>'Country'  — the survey Section 1 answer (PostgREST JSON extraction)
// Most users have profiles.country = NULL because signUp() doesn't set it.
// The survey answer is the reliable source.

export async function getMapSubmissions(): Promise<MapSubmission[]> {
  const { data, error } = await supabase
    .from('survey_submissions')
    // data->>Country: extracts the text value of the 'Country' key from the JSONB
    // data column using PostgreSQL's ->> operator via PostgREST. Result field is 'Country'.
    .select('status, Country:data->>Country, profile:profiles(country)')
  if (error) throw error

  return ((data ?? []) as unknown[]).map((row: unknown) => {
    const r = row as Record<string, unknown>
    // PostgREST returns the joined row as an object (or null if no profile)
    const pRaw = r['profile']
    const profile = Array.isArray(pRaw)
      ? (pRaw[0] as Record<string, unknown> | undefined)
      : (pRaw as Record<string, unknown> | null | undefined)

    // Priority: profile.country (explicit), then survey answer (reliable for most users)
    const country =
      (profile?.country as string | null | undefined) ??
      (r['Country'] as string | null | undefined) ??
      null

    return {
      status:  r['status'] as SurveyStatus,
      country,
    } as MapSubmission
  })
}

// ─── Survey Definitions ──────────────────────────────────────────────────────

export async function getSurveyDefinitions(): Promise<SurveyDefinition[]> {
  const { data, error } = await supabase
    .from('survey_definitions')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as SurveyDefinition[]
}

export async function getActiveDefinition(): Promise<SurveyDefinition | null> {
  const { data, error } = await supabase
    .from('survey_definitions')
    .select('*')
    .eq('is_active', true)
    .maybeSingle()
  if (error) {
    if (import.meta.env.DEV) console.warn('getActiveDefinition error:', error.message)
    return null
  }
  return data as SurveyDefinition | null
}

export async function saveSurveyDefinition(
  name: string,
  definition: Record<string, unknown>,
  createdBy?: string
): Promise<SurveyDefinition> {
  const { data, error } = await supabase
    .from('survey_definitions')
    .insert({
      name,
      definition,
      is_active: false,
      created_by: createdBy,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()
  if (error) throw error
  return data as SurveyDefinition
}

export async function updateSurveyDefinition(
  id: string,
  definition: Record<string, unknown>
): Promise<SurveyDefinition> {
  const { data, error } = await supabase
    .from('survey_definitions')
    .update({ definition, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as SurveyDefinition
}

export async function setActiveDefinition(id: string): Promise<void> {
  // Deactivate all
  await supabase
    .from('survey_definitions')
    .update({ is_active: false })
    .neq('id', id)
  // Activate target
  const { error } = await supabase
    .from('survey_definitions')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
