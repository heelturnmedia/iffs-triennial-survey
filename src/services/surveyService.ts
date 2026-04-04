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
  // Hard 15-second timeout via Promise.race — the Supabase client's internal
  // JWT refresh can stall indefinitely when the refresh token has expired,
  // leaving the underlying fetch waiting forever. .abortSignal() requires a
  // newer postgrest-js than ^2.45.0 ships with, so we use Promise.race instead.
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('upsertSubmission timed out after 15 s')), 15_000)
  )
  const query = supabase
    .from('survey_submissions')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single()

  const { data, error } = await Promise.race([query, timeout])
  if (error) throw error
  return data as SurveySubmission
}

export async function submitSurvey(submissionId: string): Promise<SurveySubmission> {
  // Hard 20-second timeout via Promise.race — same reasoning as upsertSubmission.
  // A simple UPDATE should complete in <500 ms; 20 s is the absolute ceiling
  // before we give up and let the catch block show an error toast.
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('submitSurvey timed out after 20 s')), 20_000)
  )
  const query = supabase
    .from('survey_submissions')
    .update({
      status:       'submitted',
      submitted_at: new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    })
    .eq('id', submissionId)
    .select()
    .single()

  const { data, error } = await Promise.race([query, timeout])
  if (error) throw error
  return data as SurveySubmission
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
// Used exclusively by ChoroplethMap.
// Source: survey_submissions.data->>'Country' ONLY — the answer the participant
// gave in Section 1 of the survey. We do NOT join profiles because profiles.country
// is NULL for virtually every user (signUp() never sets it) and the survey answer
// is the authoritative source.
//
// The Country question uses choicesByUrl with valueName:'cca2', so SurveyJS stores
// a plain ISO-2 code like "IN". Older submissions may have stored the full country
// object — resolveCountryToIso2() in ChoroplethMap handles both formats.

export async function getMapSubmissions(): Promise<MapSubmission[]> {
  const { data, error } = await supabase
    .from('survey_submissions')
    // data->>Country: PostgREST ->> operator extracts the text value of the
    // 'Country' key from the JSONB data column. With valueName:'cca2' on the
    // SurveyJS question this returns a plain ISO-2 string like "IN".
    .select('status, Country:data->>Country')
  if (error) throw error

  return ((data ?? []) as unknown[]).map((row: unknown) => {
    const r = row as Record<string, unknown>
    const country = (r['Country'] as string | null | undefined) ?? null
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
