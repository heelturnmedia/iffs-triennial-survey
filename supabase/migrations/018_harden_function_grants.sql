-- Lock down the RPC surface. PostgREST exposes every function in `public` to
-- anon/authenticated by default; most of ours are internal/trigger functions.
--
-- The real finding: notify_admins_event() was anon-callable via
-- /rest/v1/rpc/notify_admins_event — and because it reads the Vault secret
-- itself, it produced VALIDLY-SIGNED calls to the notify-admins edge function.
-- Anyone with the (public) anon key could forge admin notification emails.
--
-- Note: revoking EXECUTE on trigger functions does NOT break the triggers —
-- trigger firing doesn't check the DML user's EXECUTE privilege.

-- Forgery vector — nobody but the trigger path (runs as owner) needs this.
revoke execute on function public.notify_admins_event(text, jsonb) from public, anon, authenticated;

-- Internal helpers / trigger functions — never caller-invokable.
revoke execute on function public.generate_survey_reference() from public, anon, authenticated;
revoke execute on function public.assign_survey_reference() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.update_updated_at() from public, anon, authenticated;
revoke execute on function public.prevent_submission_status_downgrade() from public, anon, authenticated;
revoke execute on function public.protect_profile_columns() from public, anon, authenticated;
revoke execute on function public.on_profile_created_notify() from public, anon, authenticated;
revoke execute on function public.on_submission_submitted_notify() from public, anon, authenticated;
revoke execute on function public.on_recovery_requested_notify() from public, anon, authenticated;

-- get_user_role is referenced by the RLS policies on profiles/survey_submissions.
-- BOTH anon and authenticated must keep EXECUTE, otherwise an anon read of those
-- tables ERRORS (permission denied) instead of returning an empty set. Revoke
-- only from PUBLIC. (Role-enumeration risk is negligible: needs a known UUID and
-- returns only a role enum; RLS still yields zero rows for anon.)
revoke execute on function public.get_user_role(uuid) from public;

-- Admin RPCs stay callable by authenticated (they role-check internally);
-- anon has no business with them.
revoke execute on function public.reset_user_submission(uuid) from public, anon;
revoke execute on function public.reset_all_submissions() from public, anon;

-- Pin search_path on the remaining advisor-flagged functions.
alter function public.get_user_role(uuid) set search_path = '';
alter function public.handle_new_user() set search_path = '';
alter function public.update_updated_at() set search_path = '';

-- Platform-owned event-trigger function; revoke if we're allowed to.
do $$ begin
  revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
exception when others then null; end $$;
