import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── notify-admins ────────────────────────────────────────────────────────────
// Invoked by DB triggers (pg_net) on new signups and survey submissions. Emails
// every admin via the Resend API. Not browser-facing — secured by a shared
// secret (Vault: notify_admins_secret) sent in the x-notify-secret header.

interface Payload {
  type?: 'signup' | 'completion'
  user_id?: string
  email?: string
  first_name?: string
  last_name?: string
  submitted_at?: string | null
  country?: string | null
}

function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string)
  )
}

function emailTemplate(heading: string, intro: string, rows: Array<[string, string]>): string {
  const cells = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;color:#7a8a96;font-size:13px;width:120px">${esc(k)}</td>` +
        `<td style="padding:6px 0;color:#0d1117;font-size:13px;font-weight:600">${esc(v || '—')}</td></tr>`
    )
    .join('')
  return `<!doctype html><html><body style="margin:0;background:#f0f4f1;padding:24px;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e2ebe4;border-radius:14px;overflow:hidden">
      <tr><td style="background:#1d7733;padding:16px 24px;color:#fff;font-size:13px;font-weight:700;letter-spacing:1px">IFFS 2026 TRIENNIAL SURVEY</td></tr>
      <tr><td style="padding:24px">
        <h1 style="margin:0 0 8px;font-size:18px;color:#0d1117">${esc(heading)}</h1>
        <p style="margin:0 0 16px;font-size:14px;color:#3d4a52;line-height:1.5">${esc(intro)}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eef2ef;border-bottom:1px solid #eef2ef">${cells}</table>
        <p style="margin:16px 0 0;font-size:12px;color:#b0bec5">You're receiving this because you are an administrator of the IFFS survey platform.</p>
      </td></tr>
    </table>
  </td></tr></table>
  </body></html>`
}

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // ── Verify the shared secret (constant-time-ish compare) ───────────────────
  const incoming = req.headers.get('x-notify-secret') ?? ''
  const { data: expected } = await supabase.rpc('get_notify_secret')
  if (!expected || typeof expected !== 'string' || incoming.length !== expected.length) {
    return json({ error: 'Unauthorized' }, 401)
  }
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= incoming.charCodeAt(i) ^ expected.charCodeAt(i)
  if (diff !== 0) return json({ error: 'Unauthorized' }, 401)

  let body: Payload
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    console.error('[notify-admins] RESEND_API_KEY is not set')
    return json({ error: 'Email is not configured (RESEND_API_KEY missing)' }, 503)
  }

  // ── Recipients: every admin ────────────────────────────────────────────────
  const { data: admins } = await supabase.from('profiles').select('email').eq('role', 'admin')
  const to = (admins ?? []).map((a) => a.email as string).filter(Boolean)
  if (to.length === 0) return json({ skipped: 'no admins' }, 200)

  // ── Compose by event type ──────────────────────────────────────────────────
  let subject: string
  let html: string

  if (body.type === 'signup') {
    const name = `${body.first_name ?? ''} ${body.last_name ?? ''}`.trim() || body.email || 'A new user'
    subject = `New survey registration — ${name}`
    html = emailTemplate(
      'New user registered',
      'A new participant has created an account on the IFFS 2026 Triennial Survey.',
      [
        ['Name', name],
        ['Email', body.email ?? ''],
      ]
    )
  } else if (body.type === 'completion') {
    const { data: p } = await supabase
      .from('profiles')
      .select('email, first_name, last_name')
      .eq('id', body.user_id ?? '')
      .maybeSingle()
    const name =
      `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim() || p?.email || 'A participant'
    subject = `Survey completed — ${name}`
    html = emailTemplate(
      'Survey completed',
      `${name} has submitted their completed survey.`,
      [
        ['Name', name],
        ['Email', p?.email ?? ''],
        ['Country', body.country ?? '—'],
        ['Submitted', body.submitted_at ? new Date(body.submitted_at).toUTCString() : '—'],
      ]
    )
  } else {
    return json({ error: 'Unknown event type' }, 400)
  }

  // ── Send via Resend ────────────────────────────────────────────────────────
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'IFFS Survey <info@iffssurvey.com>',
      to,
      subject,
      html,
    }),
  })

  if (!res.ok) {
    const detail = await res.text()
    console.error('[notify-admins] Resend error', res.status, detail)
    return json({ error: 'Send failed', detail }, 502)
  }

  return json({ sent: to.length, type: body.type }, 200)
})
