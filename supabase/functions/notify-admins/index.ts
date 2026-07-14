import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── notify-admins ────────────────────────────────────────────────────────────
// Invoked by DB triggers (pg_net) on auth/survey events.
//  • signup         → emails every admin
//  • completion     → emails every admin AND sends a branded thank-you to the
//                     participant, quoting their survey reference number.
//  • password_reset → emails every admin (the reset link itself goes to the
//                     user via Supabase Auth SMTP).
// Not browser-facing — secured by a shared secret (Vault: notify_admins_secret)
// sent in the x-notify-secret header.

const LOGO_URL = 'https://iffssurvey.com/iffs-logo.png'
const FROM = 'IFFS Survey <info@iffssurvey.com>'

interface Payload {
  type?: 'signup' | 'completion' | 'password_reset'
  user_id?: string
  email?: string
  first_name?: string
  last_name?: string
  submitted_at?: string | null
  country?: string | null
  reference_no?: string | null
  requested_at?: string | null
}

function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string)
  )
}

// Internal admin notification — compact data table.
function adminTemplate(heading: string, intro: string, rows: Array<[string, string]>): string {
  const cells = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;color:#7a8a96;font-size:13px;width:130px">${esc(k)}</td>` +
        `<td style="padding:6px 0;color:#0d1117;font-size:13px;font-weight:600">${esc(v || '—')}</td></tr>`
    )
    .join('')
  return `<!doctype html><html><body style="margin:0;background:#f0f4f1;padding:24px;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e2ebe4;border-radius:14px;overflow:hidden">
      <tr><td style="background:#1d7733;padding:16px 24px;color:#fff;font-size:13px;font-weight:700;letter-spacing:1px">IFFS 2026 BIENNIAL SURVEY</td></tr>
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

// Participant-facing branded thank-you, with logo + reference number.
function thankYouTemplate(firstName: string, referenceNo: string | null): string {
  const refBlock = referenceNo
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0">
         <tr><td align="center" style="background:#e8f5ec;border:1px solid #afc7b4;border-radius:12px;padding:18px">
           <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#0e5921;font-weight:700">Your survey reference number</div>
           <div style="font-size:26px;font-weight:800;color:#0e5921;letter-spacing:1px;margin-top:6px;font-family:'Courier New',monospace">${esc(referenceNo)}</div>
           <div style="font-size:12px;color:#5a7263;margin-top:6px">Please keep this number for your records.</div>
         </td></tr>
       </table>`
    : ''
  const greeting = firstName ? `Thank you, ${esc(firstName)}!` : 'Thank you!'
  return `<!doctype html><html><body style="margin:0;background:#f0f4f1;padding:24px;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e2ebe4;border-radius:16px;overflow:hidden">
      <tr><td align="center" style="background:#1d7733;padding:24px">
        <img src="${LOGO_URL}" alt="IFFS" width="64" height="64" style="display:block;border:0;outline:none;background:#fff;border-radius:50%;padding:6px" />
        <div style="color:#fff;font-size:13px;font-weight:700;letter-spacing:2px;margin-top:10px">IFFS 2026 BIENNIAL SURVEY</div>
      </td></tr>
      <tr><td style="padding:28px 32px">
        <h1 style="margin:0 0 12px;font-size:22px;color:#0d1117">${greeting}</h1>
        <p style="margin:0 0 14px;font-size:15px;color:#3d4a52;line-height:1.6">
          Your response to the IFFS 2026 Biennial Survey has been received. On behalf of the
          International Federation of Fertility Societies, thank you for contributing to this global
          effort to advance the understanding and practice of reproductive medicine.
        </p>
        ${refBlock}
        <p style="margin:14px 0 0;font-size:14px;color:#3d4a52;line-height:1.6">
          If you have any questions about your submission, simply reply to this email or contact us at
          <a href="mailto:info@iffssurvey.com" style="color:#1d7733;text-decoration:none;font-weight:600">info@iffssurvey.com</a>.
        </p>
        <p style="margin:20px 0 0;font-size:14px;color:#0d1117;font-weight:600">— The IFFS Survey Team</p>
      </td></tr>
      <tr><td style="padding:16px 32px;border-top:1px solid #eef2ef;color:#b0bec5;font-size:11px">
        International Federation of Fertility Societies · 2026 Biennial Survey on ART
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

async function sendEmail(
  resendKey: string,
  to: string[],
  subject: string,
  html: string
): Promise<{ ok: boolean; detail?: string }> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })
  if (!res.ok) {
    const detail = await res.text()
    console.error('[notify-admins] Resend error', res.status, detail)
    return { ok: false, detail }
  }
  return { ok: true }
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

  // ── Admin recipients ───────────────────────────────────────────────────────
  const { data: admins } = await supabase.from('profiles').select('email').eq('role', 'admin')
  const adminTo = (admins ?? []).map((a) => a.email as string).filter(Boolean)

  // ── Signup ─────────────────────────────────────────────────────────────────
  if (body.type === 'signup') {
    if (adminTo.length === 0) return json({ skipped: 'no admins' }, 200)
    const name = `${body.first_name ?? ''} ${body.last_name ?? ''}`.trim() || body.email || 'A new user'
    const r = await sendEmail(
      resendKey,
      adminTo,
      `New survey registration — ${name}`,
      adminTemplate(
        'New user registered',
        'A new participant has created an account on the IFFS 2026 Biennial Survey.',
        [
          ['Name', name],
          ['Email', body.email ?? ''],
        ]
      )
    )
    return r.ok ? json({ sent: adminTo.length, type: 'signup' }, 200) : json({ error: 'Send failed', detail: r.detail }, 502)
  }

  // ── Completion ─────────────────────────────────────────────────────────────
  if (body.type === 'completion') {
    const { data: p } = await supabase
      .from('profiles')
      .select('email, first_name, last_name')
      .eq('id', body.user_id ?? '')
      .maybeSingle()
    const name = `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim() || p?.email || 'A participant'
    const ref = body.reference_no ?? null

    // 1) Admin notification
    let adminSent = 0
    if (adminTo.length > 0) {
      const r = await sendEmail(
        resendKey,
        adminTo,
        `Survey completed — ${name}${ref ? ` (${ref})` : ''}`,
        adminTemplate('Survey completed', `${name} has submitted their completed survey.`, [
          ['Name', name],
          ['Email', p?.email ?? ''],
          ['Country', body.country ?? '—'],
          ['Reference', ref ?? '—'],
          ['Submitted', body.submitted_at ? new Date(body.submitted_at).toUTCString() : '—'],
        ])
      )
      if (r.ok) adminSent = adminTo.length
    }

    // 2) Participant thank-you
    let thankYouSent = false
    if (p?.email) {
      const r = await sendEmail(
        resendKey,
        [p.email as string],
        'Thank you for completing the IFFS 2026 Biennial Survey',
        thankYouTemplate((p.first_name as string) ?? '', ref)
      )
      thankYouSent = r.ok
    }

    return json({ type: 'completion', adminSent, thankYouSent, reference_no: ref }, 200)
  }

  // ── Password reset requested ───────────────────────────────────────────────
  // The reset email itself is sent to the user by Supabase Auth (SMTP); this
  // only informs the admins that a reset was requested.
  if (body.type === 'password_reset') {
    if (adminTo.length === 0) return json({ skipped: 'no admins' }, 200)
    const { data: p } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', body.user_id ?? '')
      .maybeSingle()
    const name = `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim() || body.email || 'A user'
    const r = await sendEmail(
      resendKey,
      adminTo,
      `Password reset requested — ${name}`,
      adminTemplate(
        'Password reset requested',
        'A user has requested a password reset link for their IFFS 2026 Biennial Survey account.',
        [
          ['Name', name],
          ['Email', body.email ?? ''],
          ['Requested', body.requested_at ? new Date(body.requested_at).toUTCString() : new Date().toUTCString()],
        ]
      )
    )
    return r.ok
      ? json({ sent: adminTo.length, type: 'password_reset' }, 200)
      : json({ error: 'Send failed', detail: r.detail }, 502)
  }

  return json({ error: 'Unknown event type' }, 400)
})
