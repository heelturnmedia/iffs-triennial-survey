-- Fix "Reset Survey" failing for submitted surveys.
--
-- ROOT CAUSE: Migration 009's prevent_status_downgrade trigger rejects ANY
-- submitted/reviewed → draft update — including the admin reset RPCs, which
-- are the one legitimate downgrade path. Every reset of a submitted survey
-- failed with P0001 and the admin saw a generic "Failed to reset survey".
--
-- Fix: the reset RPCs set a transaction-local flag via set_config(..., true)
-- before their UPDATE; the trigger lets the downgrade through only when that
-- flag is set. Plain UPDATEs (e.g. the autosave race 009 was written for)
-- never set the flag and remain blocked.
--
-- Also pins search_path on all three functions (Supabase security advisor:
-- function_search_path_mutable). All object references are schema-qualified;
-- pg_catalog built-ins resolve implicitly.

create or replace function public.prevent_submission_status_downgrade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (old.status in ('submitted', 'reviewed') and new.status = 'draft') then
    -- Transaction-local flag set only by the admin reset RPCs below.
    if coalesce(current_setting('app.allow_status_downgrade', true), '') = 'on' then
      return new;
    end if;
    raise exception
      'Cannot downgrade survey submission status from "%" to "draft" for user %',
      old.status, old.user_id
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function public.reset_user_submission(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select public.get_user_role(auth.uid())) != 'admin' then
    raise exception 'Only admins can reset submissions';
  end if;

  -- third arg true = local to this transaction only
  perform set_config('app.allow_status_downgrade', 'on', true);

  update public.survey_submissions
  set
    status       = 'draft',
    page_no      = 0,
    data         = '{}',
    saved_at     = now(),
    submitted_at = null,
    reviewed_at  = null,
    updated_at   = now()
  where user_id = target_user_id;

  insert into public.activity_log (user_id, action, metadata)
  values (auth.uid(), 'reset_submission', jsonb_build_object('target_user_id', target_user_id));
end;
$$;

create or replace function public.reset_all_submissions()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select public.get_user_role(auth.uid())) != 'admin' then
    raise exception 'Only admins can reset all submissions';
  end if;

  perform set_config('app.allow_status_downgrade', 'on', true);

  update public.survey_submissions
  set
    status       = 'draft',
    page_no      = 0,
    data         = '{}',
    saved_at     = now(),
    submitted_at = null,
    reviewed_at  = null,
    updated_at   = now()
  where status != 'reviewed';

  insert into public.activity_log (user_id, action, metadata)
  values (auth.uid(), 'reset_all_submissions', '{}'::jsonb);
end;
$$;
