import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { verifyAuth } from '../_shared/auth.ts'

// ─── delete-user ──────────────────────────────────────────────────────────────
// Admin-only. Permanently deletes a user via the GoTrue admin API; the
// ON DELETE CASCADE foreign keys remove the profile, survey submission, and
// the user's own activity_log rows. The audit entry is written under the
// CALLING ADMIN's id so it survives the cascade.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req: Request) => {
  // CORS preflight
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed. Use POST.' }, 405)
  }

  let auth: Awaited<ReturnType<typeof verifyAuth>>
  try {
    auth = await verifyAuth(req)
  } catch {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }
  const { user, role, supabase } = auth

  if (role !== 'admin') {
    return jsonResponse({ error: 'Forbidden: admin role required' }, 403)
  }

  let body: { userId?: string } = {}
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const targetId = body.userId
  if (!targetId || typeof targetId !== 'string' || !UUID_RE.test(targetId)) {
    return jsonResponse({ error: '`userId` is required and must be a UUID' }, 400)
  }

  if (targetId === user.id) {
    return jsonResponse({ error: 'You cannot delete your own account' }, 400)
  }

  try {
    const { data: target } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('id', targetId)
      .maybeSingle()

    if (!target) {
      return jsonResponse({ error: 'User not found' }, 404)
    }

    // Audit before deleting — under the admin's id so the row is not cascaded.
    await supabase.from('activity_log').insert({
      user_id: user.id,
      action: 'delete_user',
      metadata: {
        target_user_id: targetId,
        target_email: target.email,
        target_role: target.role,
      },
    })

    const { error: deleteError } = await supabase.auth.admin.deleteUser(targetId)
    if (deleteError) {
      console.error('[delete-user] deleteUser error:', deleteError.message)
      return jsonResponse({ error: `Delete failed: ${deleteError.message}` }, 500)
    }

    return jsonResponse({ success: true }, 200)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[delete-user] error:', message)
    return jsonResponse({ error: 'Delete failed' }, 500)
  }
})
