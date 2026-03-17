import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { verifyAuth } from '../_shared/auth.ts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Profile {
  id: string
  email: string
  name: string
  role: string
}

interface Submission {
  id: string
  user_id: string
  status: string
  page_no: number
  data: Record<string, unknown>
  submitted_at: string | null
  created_at: string
  profiles: Profile | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Escape a single CSV field value.
 * Wraps in double-quotes and escapes internal double-quotes if needed.
 */
function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  // If the value contains a comma, double-quote, or newline it must be quoted
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Calculate a rough survey completion percentage.
 *
 * Strategy: count the number of non-null / non-empty values in the `data`
 * JSONB object and express that as a percentage of the total number of keys.
 * When there is no data at all we return 0. Submitted surveys are always 100%.
 */
function completionPercent(submission: Submission): number {
  if (submission.status === 'submitted' || submission.status === 'reviewed') return 100

  const data = submission.data
  if (!data || typeof data !== 'object') return 0

  const entries = Object.entries(data)
  if (entries.length === 0) return 0

  const answered = entries.filter(([, v]) => {
    if (v === null || v === undefined) return false
    if (typeof v === 'string' && v.trim() === '') return false
    if (Array.isArray(v) && v.length === 0) return false
    return true
  })

  return Math.round((answered.length / entries.length) * 100)
}

/**
 * Extract country from submission data. We look for common field names used
 * in survey JSON blobs in priority order.
 */
function extractCountry(data: Record<string, unknown>): string {
  const candidates = ['country', 'Country', 'nation', 'Nation', 'countryOfResidence']
  for (const key of candidates) {
    const val = data[key]
    if (val && typeof val === 'string' && val.trim()) return val.trim()
  }
  return ''
}

/**
 * Format an ISO timestamptz as a human-readable UTC string for the CSV.
 * Returns empty string for null/undefined.
 */
function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    return new Date(iso).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')
  } catch {
    return iso
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  // CORS preflight
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Use GET.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Auth: only admins and supervisors may export data
    const { role } = await verifyAuth(req)

    if (role !== 'admin' && role !== 'supervisor') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: admin or supervisor role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse optional query parameters
    const url = new URL(req.url)
    const statusFilter = url.searchParams.get('status')   // e.g. draft | submitted | reviewed
    const regionFilter = url.searchParams.get('region')   // matched against data->>'country'

    // Service-role client so we bypass RLS for the export
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Build the query — join profiles via the foreign key
    let query = supabase
      .from('survey_submissions')
      .select(`
        id,
        user_id,
        status,
        page_no,
        data,
        submitted_at,
        created_at,
        profiles (
          id,
          email,
          name,
          role
        )
      `)
      .order('created_at', { ascending: true })

    // Apply status filter if provided and valid
    const validStatuses = ['draft', 'submitted', 'reviewed']
    if (statusFilter && validStatuses.includes(statusFilter)) {
      query = query.eq('status', statusFilter)
    }

    const { data: submissions, error } = await query

    if (error) {
      console.error('[export-report] Query error:', error.message)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch submissions', detail: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Cast because Supabase types the join loosely
    let rows = (submissions ?? []) as unknown as Submission[]

    // Apply region/country filter in-process (avoids complex JSONB query)
    if (regionFilter && regionFilter.trim() !== '') {
      const normalised = regionFilter.trim().toLowerCase()
      rows = rows.filter((row) => {
        const country = extractCountry(row.data).toLowerCase()
        return country.includes(normalised)
      })
    }

    // ── Build CSV ─────────────────────────────────────────────────────────────
    const headers = ['email', 'name', 'country', 'status', 'completion_%', 'submitted_at']
    const csvLines: string[] = [headers.map(csvField).join(',')]

    for (const row of rows) {
      const profile = row.profiles
      const email = profile?.email ?? ''
      const name = profile?.name ?? ''
      const country = extractCountry(row.data)
      const status = row.status
      const completion = completionPercent(row)
      const submittedAt = formatDate(row.submitted_at)

      csvLines.push(
        [
          csvField(email),
          csvField(name),
          csvField(country),
          csvField(status),
          csvField(completion),
          csvField(submittedAt),
        ].join(',')
      )
    }

    const csvContent = csvLines.join('\r\n')

    // Generate a filename with the current UTC date
    const dateStamp = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const filename = `iffs-survey-report-${dateStamp}.csv`

    return new Response(csvContent, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[export-report] Unhandled error:', message)

    const status =
      message.includes('No authorization header') || message.includes('Invalid token')
        ? 401
        : 500

    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
