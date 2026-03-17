import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Redis } from 'https://esm.sh/@upstash/redis@1'
import { Ratelimit } from 'https://esm.sh/@upstash/ratelimit@1'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RateLimitRequestBody {
  identifier: string
  action: string
  limit?: number
  window?: string
}

// ─── Window string validator ──────────────────────────────────────────────────
// Upstash Ratelimit supports window strings like "10 s", "1 m", "1 h", "1 d".
// We accept user-supplied window strings but fall back to "1 m" if the format
// is not one of the known safe values.

const WINDOW_PATTERN = /^\d+\s+(ms|s|m|h|d)$/

function sanitiseWindow(window?: string): `${number} ${'ms' | 's' | 'm' | 'h' | 'd'}` {
  if (window && WINDOW_PATTERN.test(window)) {
    return window as `${number} ${'ms' | 's' | 'm' | 'h' | 'd'}`
  }
  return '1 m'
}

// ─── Build a Ratelimit instance for the given limit + window ──────────────────

function buildLimiter(
  redis: Redis,
  limit: number,
  window: `${number} ${'ms' | 's' | 'm' | 'h' | 'd'}`,
  prefix: string
): Ratelimit {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    analytics: true,
    prefix,
  })
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  // CORS preflight
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Use POST.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Validate Upstash configuration
  const upstashUrl = Deno.env.get('UPSTASH_REDIS_REST_URL')
  const upstashToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN')

  if (!upstashUrl || !upstashToken) {
    console.error('[rate-limit] Upstash environment variables are not set')
    return new Response(
      JSON.stringify({ error: 'Rate limit service is not configured' }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Parse request body
  let body: RateLimitRequestBody
  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { identifier, action, limit = 10, window } = body

  if (!identifier || typeof identifier !== 'string' || identifier.trim() === '') {
    return new Response(
      JSON.stringify({ error: '`identifier` is required and must be a non-empty string' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (!action || typeof action !== 'string' || action.trim() === '') {
    return new Response(
      JSON.stringify({ error: '`action` is required and must be a non-empty string' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (typeof limit !== 'number' || limit < 1 || limit > 10_000) {
    return new Response(
      JSON.stringify({ error: '`limit` must be a number between 1 and 10000' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const sanitisedWindow = sanitiseWindow(window)

  // Build a unique Redis prefix per action so that different actions do not
  // share quotas even when the identifier is the same.
  const safeAction = action.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)
  const prefix = `rl:${safeAction}`

  try {
    const redis = new Redis({ url: upstashUrl, token: upstashToken })
    const rateLimiter = buildLimiter(redis, limit, sanitisedWindow, prefix)

    const key = `${identifier.trim()}`.slice(0, 512)
    const { success, remaining, reset } = await rateLimiter.limit(key)

    return new Response(
      JSON.stringify({ allowed: success, remaining, reset }),
      {
        status: success ? 200 : 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(reset),
        },
      }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[rate-limit] Redis error:', message)

    return new Response(
      JSON.stringify({ error: 'Rate limit check failed', detail: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
