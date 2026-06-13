-- Admin email notifications: notify all admins when a new user signs up and
-- when a participant submits their survey. DB triggers fire the notify-admins
-- edge function asynchronously via pg_net, so a mail failure can never block a
-- signup or submission.
--
-- Auth: the edge function is secured by a shared secret stored in Vault
-- (notify_admins_secret). Triggers read it directly; the edge function reads it
-- via get_notify_secret() (service_role only) and compares the request header.

-- ── Secret reader for the edge function (service_role only) ──────────────────
create or replace function public.get_notify_secret()
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'notify_admins_secret';
$$;

revoke all on function public.get_notify_secret() from public;
revoke all on function public.get_notify_secret() from anon;
revoke all on function public.get_notify_secret() from authenticated;
grant execute on function public.get_notify_secret() to service_role;

-- ── Fire-and-forget POST to the notify-admins edge function ──────────────────
create or replace function public.notify_admins_event(event_type text, payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret text;
begin
  select decrypted_secret into secret
  from vault.decrypted_secrets
  where name = 'notify_admins_secret';

  -- Queue the HTTP call; pg_net runs it after this transaction commits.
  perform net.http_post(
    url     := 'https://njvvktgtnadvooxhqhwf.supabase.co/functions/v1/notify-admins',
    headers := jsonb_build_object(
      'Content-Type',    'application/json',
      'x-notify-secret', coalesce(secret, '')
    ),
    body    := jsonb_build_object('type', event_type) || payload
  );
end;
$$;

-- ── New signup → notify ──────────────────────────────────────────────────────
create or replace function public.on_profile_created_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_admins_event('signup', jsonb_build_object(
    'user_id',    new.id,
    'email',      new.email,
    'first_name', new.first_name,
    'last_name',  new.last_name
  ));
  return new;
end;
$$;

drop trigger if exists trg_profile_created_notify on public.profiles;
create trigger trg_profile_created_notify
  after insert on public.profiles
  for each row execute function public.on_profile_created_notify();

-- ── Survey submitted → notify (fires once, on the draft→submitted transition) ─
create or replace function public.on_submission_submitted_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_admins_event('completion', jsonb_build_object(
    'user_id',       new.user_id,
    'submission_id', new.id,
    'submitted_at',  new.submitted_at,
    'country',       new.data->>'Country'
  ));
  return new;
end;
$$;

drop trigger if exists trg_submission_submitted_notify on public.survey_submissions;
create trigger trg_submission_submitted_notify
  after update on public.survey_submissions
  for each row
  when (old.status::text is distinct from 'submitted' and new.status::text = 'submitted')
  execute function public.on_submission_submitted_notify();
