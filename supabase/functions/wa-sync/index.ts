import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Redis } from 'https://esm.sh/@upstash/redis@1'
import { Ratelimit } from 'https://esm.sh/@upstash/ratelimit@1'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { verifyAuth } from '../_shared/auth.ts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WaContact {
  Email: string
  DisplayName: string
  MembershipStatus: string
}

interface WaContactsResponse {
  Contacts: WaContact[]
}

interface WaTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  Permissions: string[]
  account_id: string
}

interface RequestBody {
  email?: string
  testOnly?: boolean
}

interface WaSettings {
  id: string
  api_key: string
  account_id: string
}

// ─── WA API helpers ───────────────────────────────────────────────────────────

async function getWaAccessToken(apiKey: string): Promise<string> {
  const credentials = btoa(`${apiKey}:${apiKey}`)

  const res = await fetch('https://oauth.wildapricot.org/auth/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=auto',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`WildApricot auth failed (${res.status}): ${text}`)
  }

  const data: WaTokenResponse = await res.json()
  return data.access_token
}

async function fetchActiveWaMembers(
  accessToken: string,
  accountId: string
): Promise<WaContact[]> {
  const url = `https://api.wildapricot.org/v2.1/accounts/${accountId}/contacts?$async=false&$filter=MembershipStatus%20eq%20'Active'`

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`WildApricot contacts fetch failed (${res.status}): ${text}`)
  }

  const data: WaContactsResponse = await res.json()
  return data.Contacts ?? []
}

async function fetchSingleWaMember(
  accessToken: string,
  accountId: string,
  email: string
): Promise<WaContact | null> {
  const encodedEmail = encodeURIComponent(email)
  const url = `https://api.wildapricot.org/v2.1/accounts/${accountId}/contacts?$async=false&$filter=Email%20eq%20'${encodedEmail}'`

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`WildApricot single member fetch failed (${res.status}): ${text}`)
  }

  const data: WaContactsResponse = await res.json()
  const contacts = data.Contacts ?? []
  return contacts.length > 0 ? contacts[0] : null
}

// ─── Rate limiter ─────────────────────────────────────────────────────────────

function buildRateLimiter(): Ratelimit | null {
  const upstashUrl = Deno.env.get('UPSTASH_REDIS_REST_URL')
  const upstashToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN')

  if (!upstashUrl || !upstashToken) {
    console.warn('Upstash env vars not set — rate limiting disabled')
    return null
  }

  const redis = new Redis({ url: upstashUrl, token: upstashToken })

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    analytics: true,
    prefix: 'wa-sync',
  })
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  // CORS preflight
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    // Auth: only admins may call this function
    const { user, role } = await verifyAuth(req)

    if (role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Rate limiting
    const rateLimiter = buildRateLimiter()
    if (rateLimiter) {
      const { success, remaining, reset } = await rateLimiter.limit(user.id)
      if (!success) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded', remaining: 0, reset }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(reset),
            },
          }
        )
      }
    }

    // Parse request body (optional)
    let body: RequestBody = {}
    if (req.headers.get('content-type')?.includes('application/json')) {
      try {
        body = await req.json()
      } catch {
        // no body is fine
      }
    }

    // Service-role Supabase client for reading wa_settings and upserting profiles
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Read WA credentials from wa_settings
    const { data: waSettings, error: settingsError } = await supabase
      .from('wa_settings')
      .select('id, api_key, account_id')
      .single<WaSettings>()

    if (settingsError || !waSettings) {
      return new Response(
        JSON.stringify({ error: 'WA settings not found' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!waSettings.api_key || !waSettings.account_id) {
      return new Response(
        JSON.stringify({ error: 'WA credentials are not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Obtain a WA access token
    const accessToken = await getWaAccessToken(waSettings.api_key)

    // ── testOnly: verify connection ───────────────────────────────────────────
    if (body.testOnly) {
      // Fetch account info to get the account name
      const accountRes = await fetch(
        `https://api.wildapricot.org/v2.1/accounts/${waSettings.account_id}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        }
      )

      if (!accountRes.ok) {
        return new Response(
          JSON.stringify({ success: false, error: 'Could not reach WildApricot account' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const accountData = await accountRes.json()
      return new Response(
        JSON.stringify({ success: true, accountName: accountData.Name ?? accountData.PrimaryDomainName ?? waSettings.account_id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── email lookup: check single member ─────────────────────────────────────
    if (body.email) {
      const member = await fetchSingleWaMember(accessToken, waSettings.account_id, body.email)
      const isActiveMember = member !== null && member.MembershipStatus === 'Active'

      return new Response(
        JSON.stringify({ role: isActiveMember ? 'iffs-member' : 'user' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── full sync ─────────────────────────────────────────────────────────────
    const members = await fetchActiveWaMembers(accessToken, waSettings.account_id)

    let upsertedCount = 0
    let errorCount = 0
    const errors: string[] = []

    // Process in batches of 50 to avoid hitting Supabase limits
    const batchSize = 50
    for (let i = 0; i < members.length; i += batchSize) {
      const batch = members.slice(i, i + batchSize)

      // Only upsert profiles that already exist (matched by email).
      // We do NOT create new auth users here — signup is handled separately.
      // For each email in the batch, find the profile and set role to iffs-member.
      const emails = batch.map((m) => m.Email.toLowerCase())

      const { data: existingProfiles, error: fetchError } = await supabase
        .from('profiles')
        .select('id, email')
        .in('email', emails)

      if (fetchError) {
        errorCount += batch.length
        errors.push(`Batch ${i / batchSize + 1} fetch error: ${fetchError.message}`)
        continue
      }

      if (!existingProfiles || existingProfiles.length === 0) continue

      // Build upsert payload: update role to iffs-member for matched profiles
      const upsertPayload = existingProfiles.map((profile) => {
        const waContact = batch.find(
          (m) => m.Email.toLowerCase() === profile.email.toLowerCase()
        )
        return {
          id: profile.id,
          role: 'iffs-member' as const,
          name: waContact?.DisplayName ?? undefined,
        }
      })

      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert(upsertPayload, { onConflict: 'id' })

      if (upsertError) {
        errorCount += upsertPayload.length
        errors.push(`Batch ${i / batchSize + 1} upsert error: ${upsertError.message}`)
      } else {
        upsertedCount += upsertPayload.length
      }
    }

    // Update last_sync_at on wa_settings
    await supabase
      .from('wa_settings')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', waSettings.id)

    // Log the sync action in activity_log
    await supabase.from('activity_log').insert({
      user_id: user.id,
      action: 'wa_full_sync',
      metadata: {
        total_wa_members: members.length,
        profiles_updated: upsertedCount,
        errors: errorCount,
      },
    })

    return new Response(
      JSON.stringify({
        success: true,
        totalWaMembers: members.length,
        profilesUpdated: upsertedCount,
        errors: errorCount > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[wa-sync] Unhandled error:', message)

    const status = message.includes('No authorization header') || message.includes('Invalid token')
      ? 401
      : 500

    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
