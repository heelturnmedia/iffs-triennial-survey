-- Add missing columns to survey_submissions that the app code references
-- (reviewed_at, updated_at) and wire up the updated_at auto-trigger.

alter table public.survey_submissions
  add column if not exists reviewed_at  timestamptz,
  add column if not exists updated_at   timestamptz not null default now();

-- Auto-update updated_at on every row change
create trigger survey_submissions_updated_at
  before update on public.survey_submissions
  for each row execute function update_updated_at();

-- Index for admin sort-by-updated_at queries
create index if not exists idx_submissions_updated_at
  on public.survey_submissions(updated_at desc);

-- Also update reset_user_submission function to clear reviewed_at
create or replace function public.reset_user_submission(target_user_id uuid)
returns void language plpgsql security definer as $$
begin
  if (select public.get_user_role(auth.uid())) != 'admin' then
    raise exception 'Only admins can reset submissions';
  end if;

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
  values (auth.uid(), 'reset_submission', json_build_object('target_user_id', target_user_id));
end;
$$;
